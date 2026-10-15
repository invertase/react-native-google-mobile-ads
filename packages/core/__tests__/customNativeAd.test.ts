import { AdFormat, BannerAdSize, CustomNativeAd, MultiFormatAdRequest, NativeAdEventType } from '../src';
import NativeGoogleMobileAdsNativeModule, {
  CustomNativeAdProps,
  NativeAdEventPayload,
} from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';
import { validateMultiFormatAdConfig } from '../src/validateMultiFormatAdConfig';

const nativeModule = jest.mocked(NativeGoogleMobileAdsNativeModule);

/** Ad Manager-style payload: names differ only by case to prove nothing is normalized. */
function customProps(overrides: Partial<CustomNativeAdProps> = {}): CustomNativeAdProps {
  return {
    adId: 'ad-1',
    responseId: 'response-1',
    customFormatId: '12345678',
    availableAssetNames: ['Calltoaction', 'Secondaryimage', 'calltoaction', '_videoMediaView'],
    assets: {
      Calltoaction: { type: 'text', text: 'Shop now' },
      calltoaction: { type: 'text', text: 'lower-case twin' },
      Secondaryimage: {
        type: 'image',
        image: { url: 'https://cdn.example.com/secondary.png', scale: 2 },
      },
      // Malformed / unknown entries from native must be dropped, not crash.
      Broken: { type: 'video' },
      NoUrl: { type: 'image', image: { url: '', scale: 1 } },
    },
    mediaContent: { aspectRatio: 1.5, hasVideoContent: false, duration: 0 },
    responseInfo: null,
    ...overrides,
  };
}

/** Captures the shared native event listener so tests can emit events. */
function captureEmitter(): { emit: (payload: NativeAdEventPayload & Record<string, unknown>) => void } {
  let listener: ((payload: NativeAdEventPayload) => void) | undefined;
  nativeModule.onAdEvent.mockImplementation(((cb: (payload: NativeAdEventPayload) => void) => {
    listener = cb;
    return { remove: jest.fn() };
  }) as never);
  return {
    emit: payload => listener?.(payload),
  };
}

describe('CustomNativeAd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nativeModule.loadCustomNative.mockResolvedValue(customProps());
    nativeModule.performCustomNativeClick.mockResolvedValue(undefined);
  });

  describe('createForAdRequest', () => {
    it('sends format IDs verbatim with base request options and app click handling by default', async () => {
      await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678', 'AbC-99'],
        keywords: ['shoes'],
      });

      expect(nativeModule.loadCustomNative).toHaveBeenCalledTimes(1);
      const [adUnitId, options] = nativeModule.loadCustomNative.mock.calls[0]!;
      expect(adUnitId).toBe('/1234/carousel');
      expect(options).toEqual(
        expect.objectContaining({
          customFormatIds: ['12345678', 'AbC-99'],
          clickHandling: 'app',
          keywords: ['shoes'],
          requestAgent: expect.stringMatching(/^rn-invertase-/),
        }),
      );
    });

    it("forwards clickHandling 'sdk'", async () => {
      await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
        clickHandling: 'sdk',
      });
      expect(nativeModule.loadCustomNative.mock.calls[0]![1]).toEqual(
        expect.objectContaining({ clickHandling: 'sdk' }),
      );
    });

    it.each([
      [{}, /customFormatIds' expected a non-empty array/],
      [{ customFormatIds: [] }, /customFormatIds' expected a non-empty array/],
      [{ customFormatIds: ['  '] }, /customFormatIds\[0\]' expected a non-empty string/],
      [{ customFormatIds: [123] }, /customFormatIds\[0\]' expected a non-empty string/],
      [{ customFormatIds: ['1', '1'] }, /must not contain duplicates/],
      [{ customFormatIds: ['1'], clickHandling: 'native' }, /clickHandling' expected 'app' or 'sdk'/],
    ])('rejects invalid options %j without calling native', async (options, message) => {
      await expect(
        CustomNativeAd.createForAdRequest('/1234/carousel', options as never),
      ).rejects.toThrow(message);
      expect(nativeModule.loadCustomNative).not.toHaveBeenCalled();
    });

    it('rejects AdMob units (custom native formats are Ad Manager only)', async () => {
      await expect(
        CustomNativeAd.createForAdRequest('ca-app-pub-3940256099942544/2247696110', {
          customFormatIds: ['12345678'],
        }),
      ).rejects.toThrow(/Google Ad Manager unit/);
      expect(nativeModule.loadCustomNative).not.toHaveBeenCalled();
    });

    it('maps a native load rejection to an AdError with phase load', async () => {
      nativeModule.loadCustomNative.mockRejectedValueOnce(
        Object.assign(new Error('No fill'), {
          code: 'no-fill',
          userInfo: { code: 'no-fill', message: 'No fill', reason: 'no-fill', phase: 'load' },
        }),
      );
      await expect(
        CustomNativeAd.createForAdRequest('/1234/carousel', { customFormatIds: ['12345678'] }),
      ).rejects.toMatchObject({
        code: 'googleMobileAds/no-fill',
        reason: 'no-fill',
        phase: 'load',
      });
    });
  });

  describe('input guards', () => {
    it.each([[''], [42], [undefined]])('rejects adUnitId %j', async adUnitId => {
      await expect(
        CustomNativeAd.createForAdRequest(adUnitId as never, { customFormatIds: ['1'] }),
      ).rejects.toThrow(/'adUnitId' expected a string value/);
    });

    it.each([['options'], [[]], [null]])('rejects non-object options %j', async options => {
      await expect(
        CustomNativeAd.createForAdRequest('/1234/carousel', options as never),
      ).rejects.toThrow(/'options' expected an object value/);
    });

    it('strips a namespaced rejection code before mapping the reason', async () => {
      nativeModule.loadCustomNative.mockRejectedValueOnce(
        Object.assign(new Error('Request timed out'), {
          code: 'googleMobileAds/timeout',
          userInfo: { code: 'googleMobileAds/timeout', message: 'Request timed out' },
        }),
      );
      await expect(
        CustomNativeAd.createForAdRequest('/1234/carousel', { customFormatIds: ['1'] }),
      ).rejects.toMatchObject({ code: 'googleMobileAds/timeout', reason: 'timeout', phase: 'load' });
    });

    it('falls back to a default message and phase when native gives none', async () => {
      nativeModule.performCustomNativeClick.mockRejectedValueOnce({});
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['1'],
      });
      await expect(ad.performClick('Calltoaction')).rejects.toMatchObject({
        message: expect.stringContaining('Custom native click failed'),
        phase: 'show',
      });
    });
  });

  describe('addAdEventListener guards', () => {
    it('rejects unknown event types, non-function listeners, and use after destroy', async () => {
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['1'],
      });
      expect(() => ad.addAdEventListener('nope' as never, jest.fn())).toThrow(
        /'type' expected a valid event type value/,
      );
      expect(() =>
        ad.addAdEventListener(NativeAdEventType.CLICKED, 'listener' as never),
      ).toThrow(/'listener' expected a function/);
      ad.destroy();
      expect(() => ad.addAdEventListener(NativeAdEventType.CLICKED, jest.fn())).toThrow(
        /ad has been destroyed/,
      );
    });
  });

  describe('malformed native asset payloads', () => {
    it.each([[null], ['assets'], [42]])('yields no assets when assets is %j', async assets => {
      nativeModule.loadCustomNative.mockResolvedValueOnce(
        customProps({ assets: assets as never }),
      );
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['1'],
      });
      expect(Object.keys(ad.assets)).toEqual([]);
      expect(ad.getText('Calltoaction')).toBeNull();
    });

    it('skips null entries and defaults a missing image scale to 1', async () => {
      nativeModule.loadCustomNative.mockResolvedValueOnce(
        customProps({
          assets: {
            Empty: null,
            Secondaryimage: { type: 'image', image: { url: 'https://cdn.example.com/s.png' } },
          },
        }),
      );
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['1'],
      });
      expect(ad.getAsset('Empty')).toBeNull();
      expect(ad.getImage('Secondaryimage')).toEqual({
        url: 'https://cdn.example.com/s.png',
        scale: 1,
      });
    });
  });

  describe('assets', () => {
    it('exposes the loaded ad snapshot', async () => {
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
      });
      expect(ad.adId).toBe('ad-1');
      expect(ad.responseId).toBe('response-1');
      expect(ad.customFormatId).toBe('12345678');
      expect(ad.availableAssetNames).toEqual([
        'Calltoaction',
        'Secondaryimage',
        'calltoaction',
        '_videoMediaView',
      ]);
      expect(ad.mediaContent).toEqual({ aspectRatio: 1.5, hasVideoContent: false, duration: 0 });
      expect(ad.clickHandling).toBe('app');
    });

    it('looks assets up by exact, case-sensitive name', async () => {
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
      });

      expect(ad.getText('Calltoaction')).toBe('Shop now');
      expect(ad.getText('calltoaction')).toBe('lower-case twin');
      expect(ad.getText('CallToAction')).toBeNull();
      expect(ad.getText('CALLTOACTION')).toBeNull();

      expect(ad.getImage('Secondaryimage')).toEqual({
        url: 'https://cdn.example.com/secondary.png',
        scale: 2,
      });
      expect(ad.getImage('SecondaryImage')).toBeNull();
      expect(ad.getImage('secondaryimage')).toBeNull();
    });

    it('returns null for missing, wrongly typed, and prototype-named assets', async () => {
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
      });
      expect(ad.getText('Missing')).toBeNull();
      expect(ad.getImage('Calltoaction')).toBeNull();
      expect(ad.getText('Secondaryimage')).toBeNull();
      expect(ad.getAsset('constructor')).toBeNull();
      expect(ad.getAsset('__proto__')).toBeNull();
      expect(ad.getAsset('toString')).toBeNull();
      // Video is described by mediaContent; unknown/malformed rows are dropped.
      expect(ad.getAsset('_videoMediaView')).toBeNull();
      expect(ad.getAsset('Broken')).toBeNull();
      expect(ad.getAsset('NoUrl')).toBeNull();
      expect(Object.keys(ad.assets).sort()).toEqual(
        ['Calltoaction', 'Secondaryimage', 'calltoaction'].sort(),
      );
    });

    it('keeps an asset literally named "constructor" when the creative has one', async () => {
      nativeModule.loadCustomNative.mockResolvedValueOnce(
        customProps({
          availableAssetNames: ['constructor'],
          assets: { constructor: { type: 'text', text: 'ok' } },
        }),
      );
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
      });
      expect(ad.getText('constructor')).toBe('ok');
    });
  });

  describe('clicks and impressions', () => {
    it('reports the click with only the exact asset name; the library never navigates', async () => {
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
      });
      await ad.performClick('Calltoaction');
      await ad.performClick('Secondaryimage');
      expect(nativeModule.performCustomNativeClick).toHaveBeenNthCalledWith(1, 'ad-1', 'Calltoaction');
      expect(nativeModule.performCustomNativeClick).toHaveBeenNthCalledWith(
        2,
        'ad-1',
        'Secondaryimage',
      );
    });

    it('rejects an empty asset name', async () => {
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
      });
      await expect(ad.performClick('')).rejects.toThrow(/'assetName' expected a non-empty string/);
    });

    it("reports clicks the same way with clickHandling 'sdk'", async () => {
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
        clickHandling: 'sdk',
      });
      expect(ad.clickHandling).toBe('sdk');
      await ad.performClick('Calltoaction');
      expect(nativeModule.performCustomNativeClick).toHaveBeenCalledWith('ad-1', 'Calltoaction');
    });

    it('maps a native click rejection to an AdError with phase show', async () => {
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
      });
      nativeModule.performCustomNativeClick.mockRejectedValueOnce(
        Object.assign(new Error('not found'), {
          code: 'invalid-argument',
          userInfo: {
            code: 'invalid-argument',
            message: "Custom native ad 'ad-1' was not found or has been destroyed.",
            reason: 'invalid-argument',
            phase: 'show',
          },
        }),
      );
      await expect(ad.performClick('Calltoaction')).rejects.toMatchObject({
        reason: 'invalid-argument',
        phase: 'show',
      });
    });

    it('records impressions through native', async () => {
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
      });
      ad.recordImpression();
      expect(nativeModule.recordCustomNativeImpression).toHaveBeenCalledWith('ad-1');
    });

    it('throws after destroy and releases native once', async () => {
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
      });
      ad.destroy();
      ad.destroy();
      expect(nativeModule.destroy).toHaveBeenCalledTimes(1);
      expect(nativeModule.destroy).toHaveBeenCalledWith('ad-1');
      expect(() => ad.recordImpression()).toThrow(/destroyed/);
      await expect(ad.performClick('Calltoaction')).rejects.toThrow(/destroyed/);
    });
  });

  describe('events', () => {
    it('delivers custom_click and clicked events for this adId only', async () => {
      const emitter = captureEmitter();
      const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
        customFormatIds: ['12345678'],
      });
      const onCustomClick = jest.fn();
      const onClicked = jest.fn();
      ad.addAdEventListener(NativeAdEventType.CUSTOM_CLICK, onCustomClick);
      ad.addAdEventListener(NativeAdEventType.CLICKED, onClicked);

      emitter.emit({ responseId: 'ad-1', type: 'custom_click', assetName: 'Calltoaction' });
      emitter.emit({ responseId: 'ad-1', type: 'clicked' });
      emitter.emit({ responseId: 'other-ad', type: 'custom_click', assetName: 'X' });

      expect(onCustomClick).toHaveBeenCalledTimes(1);
      expect(onCustomClick).toHaveBeenCalledWith({ assetName: 'Calltoaction' });
      expect(onClicked).toHaveBeenCalledTimes(1);

      ad.destroy();
      emitter.emit({ responseId: 'ad-1', type: 'clicked' });
      expect(onClicked).toHaveBeenCalledTimes(1);
    });
  });
});

describe('MultiFormatAdRequest with custom native formats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('leaves the bridge options of existing requests unchanged', () => {
    const validated = validateMultiFormatAdConfig({
      adUnitId: '/123/unit',
      requestOptions: {
        formats: [AdFormat.NATIVE, AdFormat.BANNER],
        bannerSizes: [BannerAdSize.MEDIUM_RECTANGLE],
        adServer: 'ad-manager',
      },
    });
    expect(validated.requestOptions).not.toHaveProperty('customNativeFormatIds');
    expect(validated.requestOptions).not.toHaveProperty('customNativeClickHandling');
  });

  it('serializes banner + custom native in one request', () => {
    const validated = validateMultiFormatAdConfig({
      adUnitId: '/123/unit',
      requestOptions: {
        formats: [AdFormat.BANNER],
        bannerSizes: [BannerAdSize.MEDIUM_RECTANGLE],
        adServer: 'ad-manager',
        customNativeFormatIds: ['12345678'],
      },
    });
    expect(validated.requestOptions).toEqual(
      expect.objectContaining({
        formats: [AdFormat.BANNER],
        bannerSizes: ['MEDIUM_RECTANGLE'],
        adServer: 'ad-manager',
        customNativeFormatIds: ['12345678'],
        customNativeClickHandling: 'app',
        requestCount: 1,
      }),
    );
  });

  it.each([
    [
      { formats: [AdFormat.NATIVE], customNativeFormatIds: ['1'] },
      '/123/unit',
      /adServer' must be 'ad-manager' when customNativeFormatIds is set/,
    ],
    [
      { formats: [AdFormat.NATIVE], customNativeFormatIds: ['1'], adServer: 'ad-manager' },
      'ca-app-pub-3940256099942544/2247696110',
      /AdMob units cannot request custom native formats/,
    ],
    [
      { formats: [AdFormat.NATIVE], customNativeFormatIds: [], adServer: 'ad-manager' },
      '/123/unit',
      /customNativeFormatIds' expected a non-empty array/,
    ],
    [
      { formats: [AdFormat.NATIVE], customNativeClickHandling: 'app' },
      '/123/unit',
      /customNativeClickHandling' requires/,
    ],
    [
      {
        formats: [AdFormat.NATIVE],
        customNativeFormatIds: ['1'],
        adServer: 'ad-manager',
        customNativeClickHandling: 'other',
      },
      '/123/unit',
      /customNativeClickHandling' expected 'app' or 'sdk'/,
    ],
    [
      {
        formats: [AdFormat.BANNER],
        bannerSizes: ['FLUID'],
        adServer: 'ad-manager',
        customNativeFormatIds: ['1'],
      },
      '/123/unit',
      /FLUID sizes are illegal/,
    ],
  ])('hard-errors on %j', (requestOptions, adUnitId, message) => {
    expect(() =>
      MultiFormatAdRequest.create({ adUnitId, requestOptions: requestOptions as never }),
    ).toThrow(message);
  });

  it('tolerates a sparse custom winner payload and reports a non-no-fill error as partial', async () => {
    nativeModule.loadMultiFormat.mockResolvedValueOnce({
      format: 'customNative',
      handleId: 'handle-sparse',
      error: {
        code: 'internal-error',
        message: 'adapter warning',
        reason: 'internal-error',
        phase: 'load',
      },
    });
    const request = MultiFormatAdRequest.create({
      adUnitId: '/123/unit',
      requestOptions: {
        formats: [AdFormat.NATIVE],
        adServer: 'ad-manager',
        customNativeFormatIds: ['12345678'],
      },
    });
    const { ads, errors } = await request.load();
    const handle = ads[0]!;
    if (handle.format !== 'customNative') {
      throw new Error(`expected customNative, got ${handle.format}`);
    }
    expect(handle.ad.adId).toBe('handle-sparse');
    expect(handle.ad.responseId).toBeNull();
    expect(handle.ad.customFormatId).toBe('');
    expect(handle.ad.availableAssetNames).toEqual([]);
    expect(Object.keys(handle.ad.assets)).toEqual([]);
    expect(handle.ad.mediaContent).toBeNull();
    expect(handle.ad.clickHandling).toBe('app');
    expect(errors.map(e => e.reason)).toEqual(['internal-error']);
    request.destroy();
  });

  it('returns a customNative handle owning a CustomNativeAd keyed by handleId', async () => {
    nativeModule.loadMultiFormat.mockResolvedValueOnce({
      format: 'customNative',
      handleId: 'handle-9',
      responseId: 'response-9',
      customFormatId: '12345678',
      availableAssetNames: ['Calltoaction', 'Secondaryimage'],
      assets: {
        Calltoaction: { type: 'text', text: 'Go' },
        Secondaryimage: { type: 'image', image: { url: 'https://cdn.example.com/s.png', scale: 1 } },
      },
      mediaContent: null,
      responseInfo: null,
      error: null,
    });
    const request = MultiFormatAdRequest.create({
      adUnitId: '/123/unit',
      requestOptions: {
        formats: [AdFormat.BANNER],
        bannerSizes: [BannerAdSize.MEDIUM_RECTANGLE],
        adServer: 'ad-manager',
        customNativeFormatIds: ['12345678'],
        customNativeClickHandling: 'sdk',
      },
    });

    const { ads, errors } = await request.load();
    expect(errors).toEqual([]);
    expect(ads).toHaveLength(1);
    const handle = ads[0]!;
    if (handle.format !== 'customNative') {
      throw new Error(`expected customNative, got ${handle.format}`);
    }
    expect(handle.adId).toBe('handle-9');
    expect(handle.ad).toBeInstanceOf(CustomNativeAd);
    expect(handle.ad.adId).toBe('handle-9');
    expect(handle.ad.responseId).toBe('response-9');
    expect(handle.ad.clickHandling).toBe('sdk');
    expect(handle.ad.getText('Calltoaction')).toBe('Go');
    expect(handle.ad.getImage('Secondaryimage')?.url).toBe('https://cdn.example.com/s.png');

    expect(handle.isStaleByPolicy()).toBe(false);
    const unsubscribe = handle.onStaleByPolicy(jest.fn());
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();

    handle.destroy();
    handle.destroy();
    expect(nativeModule.destroy).toHaveBeenCalledTimes(1);
    expect(nativeModule.destroy).toHaveBeenCalledWith('handle-9');
  });
});
