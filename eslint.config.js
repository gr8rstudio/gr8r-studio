import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', '.wrangler/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser } },
  },
  {
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['worker/**/*.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
];
