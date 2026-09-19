import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['out/**', 'dist/**', 'node_modules/**', 'docs/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'electron', message: 'Renderer 不能引用 Electron。' },
            { name: 'fs', message: 'Renderer 不能访问 Node.js。' },
            { name: 'node:fs', message: 'Renderer 不能访问 Node.js。' },
            { name: 'serialport', message: 'Renderer 不能访问串口。' },
            { name: '@shared/svg/SvgParser', message: 'SVG 解析在 Main 完成。' },
            { name: '@shared/svg/bezier', message: 'Bezier 离散不属于 UI。' },
            { name: '@shared/svg/pathData', message: 'SVG 解析在 Main 完成。' },
            { name: '@shared/svg/SvgUnitConverter', message: '单位转换不属于 UI。' },
          ],
        },
      ],
    },
  },
)
