/**
 * Pattern C — dedicated test harness (RNGoogleMobileAdsExample) only.
 * Consumes published react-native-coverage; do not copy RNFB scripts.
 *
 * @type {import('react-native-coverage/node').CoverageConfig}
 */
module.exports = {
  nativeModuleName: 'Coverage',
  app: {
    androidApplicationId: 'com.microsoft.reacttestapp',
    iosBundleId: 'com.microsoft.ReactTestApp',
    iosProductName: 'ReactTestApp',
  },
  ios: {
    // Pod / framework basename for packages/core (RNGoogleMobileAds.podspec).
    // Google-Mobile-Ads-SDK is intentionally excluded.
    frameworkNamePrefixes: ['RNGoogleMobileAds'],
  },
  android: {
    // Autolinked Gradle project name (see android/app/build/generated/rnta/autolinking.json).
    libraryProjectMatchers: ['react-native-google-mobile-ads'],
    detoxStagingPath: '/data/local/tmp/coverage/coverage.ec',
    coverageRelativePath: 'files/coverage.ec',
    jacocoReportXml: 'android/app/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml',
  },
  sourcePathRewrite: [
    { kind: 'after-marker', marker: '/packages/', includeMarker: true },
    {
      kind: 'regex',
      pattern: '^.*/react-native-google-mobile-ads/(.+)$',
      replacement: 'packages/core/$1',
    },
  ],
  strict: true,
  assert: {
    lcovPathIncludes: ['packages/'],
    // Owned bridge package only — not Google GMA/adapter SDK packages.
    jacocoPackageIncludes: ['io/invertase/googlemobileads'],
    defaultLcovPath: 'coverage/ios-native/lcov.info',
    defaultJacocoXmlPath: 'android/app/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml',
  },
};
