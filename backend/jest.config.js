module.exports = {
  testEnvironment: 'node',
  // testEnvironment: 'node',
  setupFiles: ['dotenv/config'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',
    '!src/config/**',
    '!**/node_modules/**'
  ],
  // setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  testTimeout: 30000,
  verbose: true
};
