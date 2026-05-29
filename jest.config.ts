import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  roots: ['<rootDir>/src'],

  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts',
  ],

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,

  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],

  coverageDirectory: '<rootDir>/coverage',

  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary',
  ],

  collectCoverageFrom: [
    'src/app/api/**/*.ts',
    'src/lib/**/*.ts',

    '!src/**/*.d.ts',

    // Test files
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',

    // Next.js UI/pages are not backend API coverage target
    '!src/app/**/*.tsx',
    '!src/app/layout.tsx',
    '!src/app/page.tsx',
    '!src/app/not-found.tsx',

    // Static/generated/API docs and local-only diagnostics
    '!src/app/api/docs/**',
    '!src/app/api/test-data/**',

    // DB scripts/migrations are better tested separately if needed
    '!src/lib/db/migrate.ts',
    '!src/lib/db/seed.ts',
  ],

  coverageThreshold: {
    global: {
      statements: 75,
      branches: 65,
      functions: 75,
      lines: 75,
    },
  },
};

export default config;
