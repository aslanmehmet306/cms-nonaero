import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@shared-types/(.*)$': '<rootDir>/../../packages/shared-types/src/$1',
    '^@shared-types$': '<rootDir>/../../packages/shared-types/src',
    '^@airport-revenue/formula-engine$':
      '<rootDir>/../../packages/formula-engine/src/index.ts',
  },
};

export default config;
