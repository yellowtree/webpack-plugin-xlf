import type { Compiler, WebpackPluginInstance } from 'webpack'
import glob from 'glob'
import compact from 'lodash/compact'
import uniq from 'lodash/uniq'
import { resolve } from 'path'
import { create as createXML } from 'xmlbuilder2'
import { readFileSync } from 'fs'

export type XLiffPluginOptions = {
  sourceDir: string
  outputDir: string
  baseLanguage: string
  productName: string
  languageNames: Record<string, string>
}

export class XLiffPlugin implements WebpackPluginInstance {
  private options: XLiffPluginOptions

  constructor(args: Partial<XLiffPluginOptions>) {
    this.options = {
      sourceDir: './i18n',
      outputDir: './i18n',
      baseLanguage: 'en',
      productName: '',
      languageNames: {},
      ...args
    }
  }

  apply(compiler: Compiler) {
    const pluginName = XLiffPlugin.name
    const { webpack } = compiler
    const { Compilation } = webpack
    const { RawSource } = webpack.sources

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: pluginName, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS },
        () => {
          const files = uniq(compact(glob.sync(this.options.sourceDir + '/*.json').map((x) => resolve(x))))
          for (const file of files) {
            compilation.fileDependencies.add(file)
          }

          const baseFile = files.find((x) => x.endsWith('/' + this.options.baseLanguage + '.json')) ?? files[0]
          if (!baseFile) {
            return
          }
          const baseLanguage = baseFile.split('/').slice(-1)[0].split('.')[0]
          const locallangXml = createXML({ encoding: 'utf-8', standalone: true })
            .ele('xliff', {
              version: '1.2',
              xmlns: 'urn:oasis:names:tc:xliff:document:1.2'
            })
            .ele('file', {
              'source-language': baseLanguage,
              'target-language': baseLanguage,
              datatype: 'plaintext',
              'product-name': this.options.productName
            })
          locallangXml.ele('header')
          const locallangXmlBody = locallangXml.ele('body')

          const baseTranslations: Record<string, string> = {}
          for (const [key, value] of Object.entries(JSON.parse(readFileSync(baseFile).toString()))) {
            if (typeof value === 'string') {
              const unit = locallangXmlBody.ele('trans-unit', { id: key })
              unit.ele('source').txt(value)
              unit.ele('target').txt(value)
              baseTranslations[key] = value
            }
          }
          compilation.emitAsset(
            this.options.outputDir + '/locallang.xlf',
            new RawSource(locallangXml.end({ prettyPrint: true }))
          )

          const languages = [baseLanguage]
          for (const file of files.filter((x) => x !== baseFile)) {
            const language = file.split('/').slice(-1)[0].split('.')[0]
            languages.push(language)
            const locallangXml = createXML({ encoding: 'utf-8', standalone: true })
              .ele('xliff', {
                version: '1.2',
                xmlns: 'urn:oasis:names:tc:xliff:document:1.2'
              })
              .ele('file', {
                'source-language': baseLanguage,
                'target-language': this.options.languageNames[language] ?? language,
                datatype: 'plaintext',
                'product-name': this.options.productName
              })
            locallangXml.ele('header')
            const locallangXmlBody = locallangXml.ele('body')

            const data = JSON.parse(readFileSync(file).toString())
            for (const [key, value] of Object.entries(baseTranslations)) {
              const unit = locallangXmlBody.ele('trans-unit', { id: key })
              unit.ele('source').txt(value)
              unit.ele('target').txt(data[key] ?? '')
            }
            compilation.emitAsset(
              this.options.outputDir + '/' + language + '.locallang.xlf',
              new RawSource(locallangXml.end({ prettyPrint: true }))
            )
          }

          compilation.emitAsset(
            this.options.outputDir + '/translation_summary.json',
            new RawSource(
              JSON.stringify({ baseLanguage, languages, keys: Object.keys(baseTranslations) }, undefined, 2)
            )
          )
        }
      )
    })
  }
}
