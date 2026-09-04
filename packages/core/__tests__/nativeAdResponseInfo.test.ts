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

  it('enriches native load rejection with reason/phase (keeps ERROR_LOAD code)', async () => {
    const rejection = Object.assign(new Error('no inventory'), {
      code: 'ERROR_LOAD',
      message: 'no inventory',
      userInfo: {
        code: 'ERROR_LOAD',
        message: 'no inventory',
        reason: 'no-fill',
        phase: 'load' as const,
        responseInfo: {
          responseId: 'err-ri',
          adapterClassName: null,
          loadedAdapterResponse: null,
          adapterResponses: [],
          extras: {},
        },
      },
    });
    (NativeGoogleMobileAdsNativeModule.load as jest.Mock).mockRejectedValueOnce(rejection);

    await expect(NativeAd.createForAdRequest('unit')).rejects.toMatchObject({
      code: 'googleMobileAds/ERROR_LOAD',
      reason: 'no-fill',
      phase: 'load',
      responseInfo: { responseId: 'err-ri' },
    });
  });

  it('maps Android fullscreen vocabulary rejection without inventing SHOW_FAILED', async () => {
    const rejection = Object.assign(new Error('empty'), {
      code: 'no-fill',
      message: 'empty',
      userInfo: {
        code: 'no-fill',
        message: 'empty',
        reason: 'no-fill',
        phase: 'load' as const,
      },
    });
    (NativeGoogleMobileAdsNativeModule.load as jest.Mock).mockRejectedValueOnce(rejection);

    await expect(NativeAd.createForAdRequest('unit')).rejects.toMatchObject({
      code: 'googleMobileAds/no-fill',
      reason: 'no-fill',
      phase: 'load',
    });
  });

  it('strips namespaced reject codes and defaults missing userInfo', async () => {
    const rejection = Object.assign(new Error('bare'), {
      code: 'googleMobileAds/network-error',
      message: 'bare',
    });
    (NativeGoogleMobileAdsNativeModule.load as jest.Mock).mockRejectedValueOnce(rejection);

    await expect(NativeAd.createForAdRequest('unit')).rejects.toMatchObject({
      code: 'googleMobileAds/network-error',
      reason: 'network-error',
      phase: 'load',
    });
  });

  it('defaults unknown wire code when rejection has no code fields', async () => {
    (NativeGoogleMobileAdsNativeModule.load as jest.Mock).mockRejectedValueOnce({});

    await expect(NativeAd.createForAdRequest('unit')).rejects.toMatchObject({
      code: 'googleMobileAds/unknown',
      reason: 'unknown',
      phase: 'load',
    });
  });
});
