import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', '**/*.backup-*', '.agents/**', '.codex/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { global: 'readonly', console: 'readonly' } },
  },
  { files: ['tests/**/*.js', 'eslint.config.js'], languageOptions: { globals: globals.node } },
];
