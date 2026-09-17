const project = (() => {
  try {
    const { configureProjects } = require('react-native-test-app');
    return configureProjects({
      android: {
        sourceDir: 'android',
      },
      ios: {
        sourceDir: 'ios',
      },
      windows: {
        sourceDir: 'windows',
        solutionFile: 'windows/RNGoogleMobileAdsExample.sln',
      },
    });
  } catch (_) {
    return undefined;
  }
})();

const androidOnlyAdapters = [
  'applovin',
  'facebook',
  'inmobi',
  'mintegral',
  'moloco',
  'pangle',
  'unity',
  'vungle',
  'yandex',
];

module.exports = {
  ...(project ? { project } : undefined),
  dependencies: Object.fromEntries(
    androidOnlyAdapters.map(adapter => [
      `@react-native-google-mobile-ads/${adapter}`,
      { platforms: { ios: null } },
    ]),
  ),
};
