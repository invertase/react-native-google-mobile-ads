module.exports = {
  preset: 'react-native',
  modulePathIgnorePatterns: ['<rootDir>/RNGoogleMobileAdsExample/node_modules', '<rootDir>/lib/'],
  setupFiles: ['./jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/RNGoogleMobileAdsExample'],
  testRegex: '(/__tests__/.*\\.(test|spec))\\.[jt]sx?$',
};
