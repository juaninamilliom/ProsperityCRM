module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  parserOptions: {
    sourceType: 'module',
  },
  ignorePatterns: ['dist', 'build', 'node_modules'],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
};
