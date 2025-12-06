import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.vite', '**/*.js'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // 1. Biarkan penggunaan 'any' (matikan warning/error)
      '@typescript-eslint/no-explicit-any': 'off',

      // 2. Biarkan variabel tidak terpakai (matikan warning/error)
      '@typescript-eslint/no-unused-vars': 'off',

      // 3. Matikan aturan aksesibilitas (jika ada plugin jsx-a11y)
      'jsx-a11y/anchor-has-content': 'off',

      // 4. Matikan aturan react-refresh jika mengganggu
      'react-refresh/only-export-components': 'off',
    },
  },
  eslintConfigPrettier,
)
