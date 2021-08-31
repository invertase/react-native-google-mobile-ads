module.exports = {
  maxConcurrency: 10,
  preset: './tests/node_modules/react-native-web/jest-preset.js',
  transform: {
    '^.+\\.(js)$': '<rootDir>/node_modules/babel-jest',
    '\\.(ts|tsx)$': 'ts-jest',
  },
  setupFiles: ['./jest.setup.ts'],
  testMatch: ['__tests__/**/*.test.(ts|js)'],
  modulePaths: ['node_modules'],
  moduleDirectories: ['node_modules'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
};
