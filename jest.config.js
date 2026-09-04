module.exports = {
  preset: 'react-native',
  modulePathIgnorePatterns: [
    '<rootDir>/RNGoogleMobileAdsExample/node_modules',
    '<rootDir>/packages/core/lib/',
    '<rootDir>/packages/_template/lib/',
    '<rootDir>/packages/applovin/lib/',
    '<rootDir>/packages/facebook/lib/',
    '<rootDir>/packages/unity/lib/',
    '<rootDir>/packages/pangle/lib/',
    '<rootDir>/packages/vungle/lib/',
  ],

  setupFiles: ['./jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/RNGoogleMobileAdsExample'],
  testRegex: '(/__tests__/.*\\.(test|spec))\\.[jt]sx?$',
};
