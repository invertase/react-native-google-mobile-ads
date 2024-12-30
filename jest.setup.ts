import * as ReactNative from 'react-native';

jest.doMock('react-native', () => {
  return Object.setPrototypeOf(
    {
      NativeModules: {
        ...ReactNative.NativeModules,
        RNAppModule: {
          addListener: jest.fn(),
          removeListeners: jest.fn(),
          eventsAddListener: jest.fn(),
          eventsNotifyReady: jest.fn(),
        },
        RNGoogleMobileAdsModule: {
          addListener: jest.fn(),
          removeListeners: jest.fn(),
          eventsAddListener: jest.fn(),
          eventsNotifyReady: jest.fn(),
        },
        RNGoogleMobileAdsRewardedModule: {},
        RNGoogleMobileAdsConsentModule: {},
      },
      TurboModuleRegistry: {
        ...ReactNative.TurboModuleRegistry,
        getEnforcing: moduleName => {
          if (moduleName === 'RNGoogleMobileAdsInterstitialModule') {
            return {
              interstitialLoad: jest.fn(),
            };
          }

          return {
            initialize: jest.fn(),
            setRequestConfiguration: jest.fn(),
            openAdInspector: jest.fn(),
            openDebugMenu: jest.fn(),
            setAppVolume: jest.fn(),
            setAppMuted: jest.fn(),
          };
        },
      },
    },
    ReactNative,
  );
});
jest.doMock('./src/specs/components/GoogleMobileAdsBannerViewNativeComponent', () => {
  return {
    __esModule: true,
    Commands: {},
    default: ReactNative.View,
  };
});
jest.doMock('./src/specs/components/GoogleMobileAdsNativeViewNativeComponent', () => {
  return {
    __esModule: true,
    Commands: {},
    default: ReactNative.View,
  };
});
