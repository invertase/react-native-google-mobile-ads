module.exports = {
  preset: 'react-native',
  modulePathIgnorePatterns: ['<rootDir>/example/node_modules', '<rootDir>/lib/'],
  setupFiles: ['./jest.setup.ts'],
  testRegex: '(/^__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
};
