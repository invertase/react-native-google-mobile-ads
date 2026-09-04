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
jest.doMock('./packages/core/src/specs/modules/NativeGoogleMobileAdsPoolModule', () => {
  const pools = new Map();
  return {
    __esModule: true,
    default: {
      poolStart: jest.fn(async (preloadId, format, adUnitId, bufferSize) => {
        pools.set(`${format}::${preloadId}`, { count: Number(bufferSize) > 0 ? 1 : 0, adUnitId });
        return { started: true, effectiveBufferSize: Number(bufferSize) || 2 };
      }),
      poolGetAvailability: jest.fn(async (preloadId, format) => {
        const entry = pools.get(`${format}::${preloadId}`);
        const observedCount = entry?.count ?? 0;
        return { available: observedCount > 0, observedCount };
      }),
      poolPeekResponseInfo: jest.fn(async () => null),
      poolPoll: jest.fn(async (preloadId, format, requestId) => {
        const key = `${format}::${preloadId}`;
        const entry = pools.get(key);
        if (!entry || entry.count <= 0) {
          return { filled: false };
        }
        entry.count -= 1;
        return {
          filled: true,
          requestId,
          responseId: `resp-${requestId}`,
          responseInfo: { responseId: `resp-${requestId}` },
        };
      }),
      poolDestroy: jest.fn((preloadId, format) => {
        pools.delete(`${format}::${preloadId}`);
      }),
      addListener: jest.fn(),
      removeListeners: jest.fn(),
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
