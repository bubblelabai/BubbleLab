module.exports = {
  extends: ['./base.js'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    'no-console': 'off', // Console is fine in Node.js
    '@typescript-eslint/no-var-requires': 'off', // CommonJS requires are fine
  },
};