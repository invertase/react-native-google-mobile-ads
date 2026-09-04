import { NativeAd } from '../src/ads/native-ad/NativeAd';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';

jest.mock('../src/specs/modules/NativeGoogleMobileAdsNativeModule', () => ({
  __esModule: true,
  default: {
    load: jest.fn(),
    destroy: jest.fn(),
    onAdEvent: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

describe('NativeAd responseInfo', () => {
  it('stores nested responseInfo from the native load result', async () => {
    (NativeGoogleMobileAdsNativeModule.load as jest.Mock).mockResolvedValueOnce({
      responseId: 'native-ri',
      advertiser: null,
      body: 'body',
      callToAction: 'cta',
      headline: 'headline',
      price: null,
      store: null,
      starRating: null,
      icon: null,
      images: null,
      mediaContent: { aspectRatio: 1, hasVideoContent: false, duration: 0 },
      extras: null,
      responseInfo: {
        responseId: 'native-ri',
        adapterClassName: 'adapter',
        loadedAdapterResponse: null,
        adapterResponses: [],
        extras: {},
      },
    });

    const ad = await NativeAd.createForAdRequest('unit');
    expect(ad.responseId).toBe('native-ri');
    expect(ad.responseInfo?.responseId).toBe('native-ri');
    ad.destroy();
  });

  it('defaults responseInfo to null when native omits it', async () => {
    (NativeGoogleMobileAdsNativeModule.load as jest.Mock).mockResolvedValueOnce({
      responseId: 'native-ri-2',
      advertiser: null,
      body: 'body',
      callToAction: 'cta',
      headline: 'headline',
      price: null,
      store: null,
      starRating: null,
      icon: null,
      images: null,
      mediaContent: { aspectRatio: 1, hasVideoContent: false, duration: 0 },
      extras: null,
    });

    const ad = await NativeAd.createForAdRequest('unit');
    expect(ad.responseInfo).toBeNull();
    ad.destroy();
  });
});
