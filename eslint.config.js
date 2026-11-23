import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import functional from 'eslint-plugin-functional';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'out', 'node_modules']),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'no-param-reassign': ['error', { props: true }],
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },

  // Functional, immutable code everywhere we author TypeScript.
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    plugins: { functional },
    rules: {
      'functional/immutable-data': 'error',
      'functional/no-classes': 'error',
      'functional/no-let': 'error',
      'functional/no-loop-statements': 'error',
      'functional/no-this-expressions': 'error',
      'functional/prefer-property-signatures': 'error',
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [jsxA11y.flatConfigs.strict],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  {
    files: ['scripts/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },

  prettier,
]);
