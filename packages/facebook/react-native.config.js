/**
 * Autolinking entry for the GAM facebook adapter package.
 * Registers the Meta privacy NativeModule (advertiser tracking / data-processing options).
 */
module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath:
          'import io.invertase.googlemobileads.adapters.facebook.RNGoogleMobileAdsAdapterFacebookPackage;',
        packageInstance: 'new RNGoogleMobileAdsAdapterFacebookPackage()',
      },
      ios: {},
    },
  },
};
