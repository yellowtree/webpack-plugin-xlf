import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import commonjs from '@rollup/plugin-commonjs'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const onwarn = (warning, warn) => {
  // Silence circular dependency warning for node_modules package
  if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.importer.startsWith('node_modules')) {
    return
  }

  warn(warning)
}

export default {
  input: 'src/index.ts',
  onwarn,
  plugins: [
    commonjs(),
    resolve({
      preferBuiltins: true
    }),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
      exclude: ['**/__tests__/**/*', '**/__mocks__/**/*', '**/?(*.)+(spec|test).+(ts|tsx|js)']
    }),
    terser()
  ],
  output: {
    dir: 'dist',
    format: 'cjs',
    sourcemap: true
  }
}
