module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
  moduleNameMapper: {
    '^jira\\.js$': '<rootDir>/tests/__mocks__/jira.js.ts',
    '^mdast-util-from-adf$': '<rootDir>/tests/__mocks__/mdast-util-from-adf.ts',
    '^mdast-util-to-markdown$': '<rootDir>/tests/__mocks__/mdast-util-to-markdown.ts',
    '^marklassian$': '<rootDir>/tests/__mocks__/marklassian.ts'
  }
};
