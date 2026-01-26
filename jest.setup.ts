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
jest.doMock('./src/specs/modules/NativeInterstitialModule', () => {
  return {
    __esModule: true,
    Commands: {},
    default: {
      interstitialLoad: jest.fn(),
      interstitialShow: jest.fn(),
    },
  };
});
jest.doMock('./src/specs/modules/NativeAppModule', () => {
  return {
    __esModule: true,
    default: {
      addListener: jest.fn(),
      removeListeners: jest.fn(),
      eventsAddListener: jest.fn(),
      eventsRemoveListener: jest.fn(),
      eventsNotifyReady: jest.fn(),
      initializeApp: jest.fn(),
      setAutomaticDataCollectionEnabled: jest.fn(),
      deleteApp: jest.fn(),
      eventsGetListeners: jest.fn(),
      eventsPing: jest.fn(),
      metaGetAll: jest.fn(),
      jsonGetAll: jest.fn(),
      preferencesSetBool: jest.fn(),
      preferencesSetString: jest.fn(),
      preferencesGetAll: jest.fn(),
      preferencesClearAll: jest.fn(),
    },
  };
});
