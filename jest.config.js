module.exports = {
  maxConcurrency: 10,
  preset: './node_modules/react-native/jest-preset.js',
  transform: {
    '^.+\\.(js)$': '<rootDir>/node_modules/babel-jest',
    '\\.(ts|tsx)$': 'ts-jest',
  },
  setupFiles: ['./jest.setup.ts'],
  testRegex: '(/^__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  modulePaths: ['node_modules'],
  moduleDirectories: ['node_modules'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
};
