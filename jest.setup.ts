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
              interstitialShow: jest.fn(),
              interstitialDestroy: jest.fn(),
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
jest.doMock('./packages/core/src/specs/components/GoogleMobileAdsBannerViewNativeComponent', () => {
  return {
    __esModule: true,
    Commands: {},
    default: ReactNative.View,
  };
});
jest.doMock('./packages/core/src/specs/components/GoogleMobileAdsNativeViewNativeComponent', () => {
  return {
    __esModule: true,
    Commands: {},
    default: ReactNative.View,
  };
});
jest.doMock(
  './packages/core/src/specs/components/GoogleMobileAdsMultiFormatBannerViewNativeComponent',
  () => {
    return {
      __esModule: true,
      default: ReactNative.View,
    };
  },
);
jest.doMock('./packages/core/src/specs/modules/NativeGoogleMobileAdsNativeModule', () => {
  return {
    __esModule: true,
    default: {
      load: jest.fn(() =>
        Promise.resolve({
          responseId: 'native-response',
          advertiser: null,
          body: '',
          callToAction: '',
          headline: '',
          price: null,
          store: null,
          starRating: null,
          icon: null,
          images: null,
          mediaContent: { aspectRatio: 1, hasVideoContent: false, duration: 0 },
          extras: null,
          responseInfo: null,
        }),
      ),
      destroy: jest.fn(),
      loadMultiFormat: jest.fn(() =>
        Promise.resolve({
          format: 'none',
          responseInfo: null,
          error: null,
        }),
      ),
      destroyHandle: jest.fn(),
      onAdEvent: jest.fn(() => ({ remove: jest.fn() })),
    },
  };
});
jest.doMock('./packages/core/src/specs/modules/NativeInterstitialModule', () => {
  return {
    __esModule: true,
    Commands: {},
    default: {
      interstitialLoad: jest.fn(),
      interstitialShow: jest.fn(),
      interstitialDestroy: jest.fn(),
    },
  };
});
jest.doMock('./packages/core/src/specs/modules/NativeRewardedModule', () => {
  return {
    __esModule: true,
    Commands: {},
    default: {
      rewardedLoad: jest.fn(),
      rewardedShow: jest.fn(),
      rewardedDestroy: jest.fn(),
    },
  };
});
jest.doMock('./packages/core/src/specs/modules/NativeAppOpenModule', () => {
  return {
    __esModule: true,
    Commands: {},
    default: {
      appOpenLoad: jest.fn(),
      appOpenShow: jest.fn(),
      appOpenDestroy: jest.fn(),
    },
  };
});
jest.doMock('./packages/core/src/specs/modules/NativeRewardedInterstitialModule', () => {
  return {
    __esModule: true,
    Commands: {},
    default: {
      rewardedInterstitialLoad: jest.fn(),
      rewardedInterstitialShow: jest.fn(),
      rewardedInterstitialDestroy: jest.fn(),
    },
  };
});
jest.doMock('./packages/core/src/specs/modules/NativeAppModule', () => {
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
