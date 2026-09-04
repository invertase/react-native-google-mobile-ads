import { BannerAdSize, AdFormat, MultiFormatAdPresets, MultiFormatAdRequest } from '../src';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';

describe('MultiFormatAdRequest (FEAT-04)', () => {
  beforeEach(() => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockReset();
    jest.mocked(NativeGoogleMobileAdsNativeModule.destroyHandle).mockReset();
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue({
      format: 'none',
      responseInfo: null,
      error: null,
    });
  });

  it('hard-errors on empty formats at create()', () => {
    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/unit',
        requestOptions: { formats: [] },
      }),
    ).toThrow(/formats.*non-empty/);
  });

  it('hard-errors when banner is requested without bannerSizes', () => {
    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/unit',
        requestOptions: {
          formats: [AdFormat.NATIVE, AdFormat.BANNER],
          adServer: 'ad-manager',
        },
      }),
    ).toThrow(/bannerSizes/);
  });

  it('hard-errors when banner is requested without ad-manager', () => {
    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/unit',
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: [BannerAdSize.BANNER],
        },
      }),
    ).toThrow(/ad-manager/);
  });

  it('hard-errors for AdMob unit ids with banner format', () => {
    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: 'ca-app-pub-3940256099942544/6300978111',
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: [BannerAdSize.BANNER],
          adServer: 'ad-manager',
        },
      }),
    ).toThrow(/AdMob/);
  });

  it('hard-errors on adaptive banner sizes', () => {
    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/unit',
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: [BannerAdSize.ANCHORED_ADAPTIVE_BANNER as never],
          adServer: 'ad-manager',
        },
      }),
    ).toThrow(/adaptive|FLUID/);
  });

  it('hard-errors when requestCount is not 1', () => {
    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/unit',
        requestOptions: {
          formats: [AdFormat.NATIVE],
          requestCount: 2 as 1,
        },
      }),
    ).toThrow(/requestCount/);
  });

  it('accepts nativeOrBanner preset and resolves clean no-fill', async () => {
    const request = MultiFormatAdRequest.create({
      adUnitId: '/123/unit',
      requestOptions: MultiFormatAdPresets.nativeOrBanner([BannerAdSize.MEDIUM_RECTANGLE]),
    });
    const result = await request.load();
    expect(result).toEqual({ ads: [], errors: [], responseInfo: null });
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledWith(
      '/123/unit',
      expect.objectContaining({
        formats: [AdFormat.NATIVE, AdFormat.BANNER],
        bannerSizes: [BannerAdSize.MEDIUM_RECTANGLE],
        requestCount: 1,
        adServer: 'ad-manager',
      }),
    );
  });

  it('maps native winner to a MultiFormatAdHandle with expiry', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue({
      format: 'native',
      handleId: 'h-native',
      responseId: 'r-native',
      advertiser: 'Adv',
      body: 'Body',
      callToAction: 'Go',
      headline: 'Hello',
      price: null,
      store: null,
      starRating: null,
      icon: null,
      images: null,
      mediaContent: { aspectRatio: 1.5, hasVideoContent: false, duration: 0 },
      extras: null,
      responseInfo: { responseId: 'r-native' },
      error: null,
    });

    const request = MultiFormatAdRequest.create({
      adUnitId: '/123/unit',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    const { ads, errors } = await request.load();
    expect(errors).toEqual([]);
    expect(ads).toHaveLength(1);
    expect(ads[0]).toMatchObject({
      format: AdFormat.NATIVE,
      adId: 'h-native',
      provenance: 'pool/emulated-no-sdk-preloader',
    });
    if (ads[0].format !== AdFormat.NATIVE) {
      throw new Error('expected native');
    }
    expect(ads[0].ad.headline).toBe('Hello');
    expect(ads[0].isStaleByPolicy()).toBe(false);
    ads[0].destroy();
  });

  it('maps banner winner and destroyHandle', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue({
      format: 'banner',
      handleId: 'h-banner',
      width: 300,
      height: 250,
      responseInfo: { responseId: 'r-banner' },
      error: null,
    });

    const request = MultiFormatAdRequest.create({
      adUnitId: '/123/unit',
      requestOptions: MultiFormatAdPresets.nativeOrBanner([BannerAdSize.MEDIUM_RECTANGLE]),
    });
    const { ads } = await request.load();
    expect(ads[0]).toMatchObject({
      format: AdFormat.BANNER,
      adId: 'h-banner',
      size: { width: 300, height: 250 },
    });
    ads[0].destroy();
    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).toHaveBeenCalledWith('h-banner');
  });

  it('treats no-fill error reason as clean no-fill', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue({
      format: 'none',
      responseInfo: { responseId: 'r-empty' },
      error: {
        code: 'no-fill',
        message: 'No fill',
        reason: 'no-fill',
        phase: 'load',
      },
    });
    const request = MultiFormatAdRequest.create({
      adUnitId: '/123/unit',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    await expect(request.load()).resolves.toEqual({
      ads: [],
      errors: [],
      responseInfo: { responseId: 'r-empty' },
    });
  });
});
