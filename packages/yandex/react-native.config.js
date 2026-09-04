/**
 * Autolinking entry for the Yandex GAM adapter package.
 * iOS-only: Android is disabled (Google has no official Android Yandex GAM artifact;
 * Character inventory is iOS-focused). No TurboModule / Fabric view.
 */
module.exports = {
  dependency: {
    platforms: {
      android: null,
      ios: {},
    },
  },
};
