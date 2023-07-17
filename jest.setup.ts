import * as ReactNative from 'react-native';

jest.doMock('react-native', () => {
  return Object.setPrototypeOf(
    {
      Platform: {
        OS: 'android',
        select: () => {},
      },
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
    },
    ReactNative,
  );
});
