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

const nativeAdProps = {
  responseId: 'response-1',
  advertiser: 'Advertiser',
  body: 'Body',
  callToAction: 'Install',
  headline: 'Headline',
  price: null,
  store: null,
  starRating: null,
  icon: null,
  images: null,
  mediaContent: {
    aspectRatio: 1,
    hasVideoContent: false,
    duration: 0,
  },
  extras: null,
};

/**
 * #870 / #755: createForAdRequest must settle (resolve or reject). A never-settling
 * native load is the historic hang — JS must surface native rejects, not hang.
 */
describe('NativeAd.createForAdRequest settle (#870)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('resolves when native load succeeds', async () => {
    (NativeGoogleMobileAdsNativeModule.load as jest.Mock).mockResolvedValueOnce(nativeAdProps);

    const ad = await NativeAd.createForAdRequest('abc');
    expect(ad.responseId).toBe('response-1');
    expect(ad.headline).toBe('Headline');
    expect(NativeGoogleMobileAdsNativeModule.load).toHaveBeenCalledWith(
      'abc',
      expect.objectContaining({ requestAgent: expect.any(String) }),
    );
    ad.destroy();
  });

  it('rejects when native load fails (must not hang)', async () => {
    (NativeGoogleMobileAdsNativeModule.load as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('The ad request was invalid'), {
        code: 'invalid-request',
        userInfo: {
          code: 'invalid-request',
          message: 'The ad request was invalid',
          reason: 'invalid-request',
          phase: 'load' as const,
        },
      }),
    );

    await expect(NativeAd.createForAdRequest('invalid-unit')).rejects.toMatchObject({
      code: 'googleMobileAds/invalid-request',
      reason: 'invalid-request',
      phase: 'load',
    });
  });

  it('rejects when native reports missing response id (historic silent hang)', async () => {
    (NativeGoogleMobileAdsNativeModule.load as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Failed to get a valid response ID from the loaded ad.'), {
        code: 'internal-error',
        userInfo: {
          code: 'internal-error',
          message: 'Failed to get a valid response ID from the loaded ad.',
          reason: 'unknown',
          phase: 'load' as const,
        },
      }),
    );

    await expect(NativeAd.createForAdRequest('abc')).rejects.toMatchObject({
      code: 'googleMobileAds/internal-error',
      phase: 'load',
    });
  });
});
