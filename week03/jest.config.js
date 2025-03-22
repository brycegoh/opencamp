module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: ['**/tests/**/*.test.(ts|js)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '*.real-db.test.(ts|js)'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{ts,js}', '!src/tests/**/*.{ts,js}'],
  coverageReporters: ['text', 'lcov'],
  coverageDirectory: 'coverage',
}; 