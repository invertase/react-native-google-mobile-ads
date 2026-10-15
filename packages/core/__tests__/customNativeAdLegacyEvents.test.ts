import { DeviceEventEmitter, Platform } from 'react-native';

/**
 * Old-architecture fallback: when the TurboModule has no typed `onAdEvent` emitter, CustomNativeAd
 * subscribes to the shared `RNGMANativeAdEvent` channel (same strategy as NativeAd).
 */
describe('CustomNativeAd without a typed onAdEvent emitter', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    jest.resetModules();
  });

  it.each(['ios', 'android'] as const)(
    'receives events from the RNGMANativeAdEvent channel on %s',
    async os => {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
      jest.doMock('../src/specs/modules/NativeGoogleMobileAdsNativeModule', () => ({
        __esModule: true,
        default: {
          loadCustomNative: jest.fn(() =>
            Promise.resolve({
              adId: 'legacy-ad',
              responseId: null,
              customFormatId: '12345678',
              availableAssetNames: [],
              assets: {},
              mediaContent: null,
              responseInfo: null,
            }),
          ),
          destroy: jest.fn(),
          addListener: jest.fn(),
          removeListeners: jest.fn(),
        },
      }));

      let CustomNativeAd!: typeof import('../src/ads/native-ad/CustomNativeAd').CustomNativeAd;
      let NativeAdEventType!: typeof import('../src/NativeAdEventType').NativeAdEventType;
      jest.isolateModules(() => {
        ({ CustomNativeAd } = require('../src/ads/native-ad/CustomNativeAd'));
        ({ NativeAdEventType } = require('../src/NativeAdEventType'));
      });

      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
      });
      const onClicked = jest.fn();
      ad.addAdEventListener(NativeAdEventType.CLICKED, onClicked);

      DeviceEventEmitter.emit('RNGMANativeAdEvent', { responseId: 'legacy-ad', type: 'clicked' });
      DeviceEventEmitter.emit('RNGMANativeAdEvent', { responseId: 'other', type: 'clicked' });
      expect(onClicked).toHaveBeenCalledTimes(1);

      ad.destroy();
      DeviceEventEmitter.emit('RNGMANativeAdEvent', { responseId: 'legacy-ad', type: 'clicked' });
      expect(onClicked).toHaveBeenCalledTimes(1);
    },
  );
});
