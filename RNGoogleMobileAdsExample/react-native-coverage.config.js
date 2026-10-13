/**
 * Pattern C — dedicated test harness (RNGoogleMobileAdsExample) only.
 * Consumes published react-native-coverage; do not copy RNFB scripts.
 *
 * Jacoco XML lives under the backend-isolated Gradle layout from
 * `android/build.gradle`: `reports/jacoco/<backend>/<report.name>/…`.
 * `rn-coverage android report` runs `jacocoTestReport`; keep assert paths in
 * sync. Select backend with the same `RNGMA_ANDROID_BACKEND` used for Appium
 * builds (`classic` default; `nextgen` when selected; `legacy` → classic).
 *
 * @type {import('react-native-coverage/node').CoverageConfig}
 */

function resolveAndroidBackend() {
  const raw = (process.env.RNGMA_ANDROID_BACKEND || 'classic').toLowerCase();
  return raw === 'nextgen' ? 'nextgen' : 'classic';
}

/** Matches the Gradle task invoked by `rn-coverage android report`. */
const JACOCO_REPORT_TASK = 'jacocoTestReport';

const androidBackend = resolveAndroidBackend();
const jacocoXmlPath = `android/app/build/reports/jacoco/${androidBackend}/${JACOCO_REPORT_TASK}/${JACOCO_REPORT_TASK}.xml`;

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
    jacocoReportXml: jacocoXmlPath,
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
    defaultJacocoXmlPath: jacocoXmlPath,
  },
};
