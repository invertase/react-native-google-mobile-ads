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
        RNGoogleMobileAdsInterstitialModule: {
          interstitialLoad: jest.fn(),
        },
        RNGoogleMobileAdsRewardedModule: {},
        RNGoogleMobileAdsConsentModule: {},
      },
      TurboModuleRegistry: {
        ...ReactNative.TurboModuleRegistry,
        getEnforcing: () => {
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
