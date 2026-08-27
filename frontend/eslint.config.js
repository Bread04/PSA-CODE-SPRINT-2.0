// Flat ESLint config (ESLint 9). Lints the TS/React source; formatting is
// delegated to Prettier (eslint-config-prettier turns off stylistic rules).
// The design-token / hex / border-radius / font-size / opacity discipline is
// enforced by src/theme/tokens.test.ts guardrail #6, not here (ESLint does not
// lint .css files).

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          // Small co-located constants a component owns and tests import.
          allowExportNames: ['DEFAULT_SUGGESTIONS'],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  // Test + setup files: Node + Vitest environment, and the barrel/default-export
  // and console rules do not apply.
  {
    files: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/test/**/*.{ts,tsx}',
      'vitest.setup.ts',
      '*.config.{ts,js}',
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  prettier,
);
