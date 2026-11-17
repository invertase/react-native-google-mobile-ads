import {
  AdEventType,
  GAMAdEventType,
  getAdCapabilities,
  IconAd,
  IconAssetType,
} from '../src';
import NativeGoogleMobileAdsModule from '../src/specs/modules/NativeGoogleMobileAdsModule';
import NativeIconAdModule from '../src/specs/modules/NativeIconAdModule';

describe('IconAd', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('validates adUnitId', () => {
    expect(() => IconAd.createForAdRequest(123 as unknown as string)).toThrow(
      "IconAd.createForAdRequest(*) 'adUnitId' expected an string value.",
    );
  });

  it('wraps request option validation errors', () => {
    expect(() => IconAd.createForAdRequest('abc', 'bad' as never)).toThrow(
      'IconAd.createForAdRequest(_, *)',
    );
  });

  it('creates an instance', () => {
    const ad = IconAd.createForAdRequest('abc');
    expect(ad.constructor.name).toEqual('IconAd');
    expect(ad.adUnitId).toBe('abc');
    expect(typeof ad.requestId).toBe('number');
    expect(ad.loaded).toBe(false);
    expect(ad.responseInfo).toBeNull();
    expect(ad.headline).toBeNull();
  });

  it('load calls native once until error allows retry', () => {
    const ad = IconAd.createForAdRequest('abc');
    ad.load();
    expect(NativeIconAdModule.iconAdLoad).toHaveBeenCalledTimes(1);
    expect(NativeIconAdModule.iconAdLoad).toHaveBeenCalledWith(
      ad.requestId,
      'abc',
      expect.any(Object),
    );
    ad.load();
    expect(NativeIconAdModule.iconAdLoad).toHaveBeenCalledTimes(1);

    ad['_handleAdEvent']({
      body: { type: AdEventType.ERROR, error: { code: 'no-fill', message: 'No fill.' } },
    });
    ad.load();
    expect(NativeIconAdModule.iconAdLoad).toHaveBeenCalledTimes(2);
  });

  it('destroy releases native and blocks further load', () => {
    const ad = IconAd.createForAdRequest('abc');
    ad.load();
    ad.destroy();
    expect(NativeIconAdModule.iconAdDestroy).toHaveBeenCalledWith(ad.requestId);
    ad.load();
    expect(NativeIconAdModule.iconAdLoad).toHaveBeenCalledTimes(1);
  });

  it('blocks load after destroy without prior load', () => {
    const ad = IconAd.createForAdRequest('abc');
    ad.destroy();
    ad.load();
    expect(NativeIconAdModule.iconAdLoad).not.toHaveBeenCalled();
  });

  it('is idempotent and swallows native destroy throws', () => {
    const ad = IconAd.createForAdRequest('abc');
    (NativeIconAdModule.iconAdDestroy as jest.Mock).mockImplementationOnce(() => {
      throw new Error('native destroy failed');
    });
    expect(() => ad.destroy()).not.toThrow();
    ad.destroy();
    expect(NativeIconAdModule.iconAdDestroy).toHaveBeenCalledTimes(1);
  });

  it('applies loaded asset payload and responseInfo', () => {
    const ad = IconAd.createForAdRequest('abc');
    const responseInfo = {
      responseId: 'ri-1',
      adapterClassName: 'adapter',
      loadedAdapterResponse: null,
      adapterResponses: [],
      extras: {},
    };
    ad['_handleAdEvent']({
      body: {
        type: AdEventType.LOADED,
        data: {
          headline: 'Title',
          callToAction: 'Install',
          packageName: 'com.example',
          starRating: 4.5,
          icon: { scale: 1, url: 'https://example/icon.png' },
          adChoicesInfo: { text: 'AdChoices', images: null },
          responseInfo,
        },
      },
    });
    expect(ad.loaded).toBe(true);
    expect(ad.headline).toBe('Title');
    expect(ad.callToAction).toBe('Install');
    expect(ad.packageName).toBe('com.example');
    expect(ad.starRating).toBe(4.5);
    expect(ad.icon?.url).toBe('https://example/icon.png');
    expect(ad.adChoicesInfo?.text).toBe('AdChoices');
    expect(ad.responseInfo?.responseId).toBe('ri-1');
  });

  it('clears loaded on error and notifies listeners', () => {
    const ad = IconAd.createForAdRequest('abc');
    const errorListener = jest.fn();
    const events = jest.fn();
    ad.addAdEventListener(AdEventType.ERROR, errorListener);
    ad.addAdEventsListener(events);
    ad['_handleAdEvent']({ body: { type: AdEventType.LOADED } });
    expect(ad.loaded).toBe(true);
    ad['_handleAdEvent']({
      body: {
        type: AdEventType.ERROR,
        error: {
          code: 'icon-ad-unavailable',
          message: 'unavailable',
          responseInfo: {
            responseId: 'err-1',
            adapterClassName: null,
            loadedAdapterResponse: null,
            extras: {},
          },
        },
      },
    });
    expect(ad.loaded).toBe(false);
    expect(errorListener.mock.calls[0][0].reason).toBe('icon-ad-unavailable');
    expect(events).toHaveBeenCalled();
    expect(ad.responseInfo?.responseId).toBe('err-1');
  });

  it('ignores late events after destroy', () => {
    const ad = IconAd.createForAdRequest('abc');
    const listener = jest.fn();
    ad.addAdEventListener(AdEventType.LOADED, listener);
    ad.destroy();
    ad['_handleAdEvent']({ body: { type: AdEventType.LOADED } });
    expect(listener).not.toHaveBeenCalled();
    expect(ad.loaded).toBe(false);
  });

  it('emits typed listeners and supports removeAllListeners', () => {
    const ad = IconAd.createForAdRequest('abc');
    const loaded = jest.fn();
    const unsub = ad.addAdEventListener(AdEventType.LOADED, loaded);
    ad['_handleAdEvent']({ body: { type: AdEventType.LOADED } });
    expect(loaded).toHaveBeenCalledTimes(1);
    unsub();
    ad['_handleAdEvent']({ body: { type: AdEventType.LOADED } });
    expect(loaded).toHaveBeenCalledTimes(1);

    const paid = jest.fn();
    ad.addAdEventListener(AdEventType.PAID, paid);
    ad['_handleAdEvent']({
      body: {
        type: AdEventType.PAID,
        data: { currency: 'USD', precision: 3, value: 0.01, valueMicros: '10000' },
      },
    });
    expect(paid.mock.calls[0][0].currency).toBe('USD');
    ad.removeAllListeners();
    ad['_handleAdEvent']({
      body: {
        type: AdEventType.PAID,
        data: { currency: 'USD', precision: 3, value: 0.02, valueMicros: '20000' },
      },
    });
    expect(paid).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid listener registration', () => {
    const ad = IconAd.createForAdRequest('abc');
    expect(() => ad.addAdEventsListener('foo' as never)).toThrow("'listener' expected a function");
    expect(() => ad.addAdEventListener('not-a-type' as never, () => {})).toThrow(
      'valid event type',
    );
    expect(() => ad.addAdEventListener(GAMAdEventType.APP_EVENT, 'nope' as never)).toThrow(
      "'listener' expected a function",
    );
  });

  it('rejects new listeners after destroy', () => {
    const ad = IconAd.createForAdRequest('abc');
    ad.destroy();
    expect(() => ad.addAdEventsListener(() => {})).toThrow('ad has been destroyed');
    expect(() => ad.addAdEventListener(AdEventType.LOADED, () => {})).toThrow(
      'ad has been destroyed',
    );
  });
});

describe('IconAssetType', () => {
  it('exposes icon ad asset keys', () => {
    expect(IconAssetType.HEADLINE).toBe('headline');
    expect(IconAssetType.ICON).toBe('icon');
    expect(IconAssetType.AD_CHOICES).toBe('adChoices');
    expect(IconAssetType.CALL_TO_ACTION).toBe('callToAction');
    expect(IconAssetType.STAR_RATING).toBe('starRating');
  });
});

describe('getAdCapabilities iconAd', () => {
  afterEach(() => {
    jest.mocked(NativeGoogleMobileAdsModule.getConstants).mockReturnValue({
      sdkVersion: 'test',
      backend: 'ios',
    });
  });

  it.each([
    ['android-next-gen', 'experimental'],
    ['android-classic', 'unavailable'],
    ['ios', 'unavailable'],
  ] as const)('reports %s as %s', (backend, expected) => {
    jest.mocked(NativeGoogleMobileAdsModule.getConstants).mockReturnValue({
      sdkVersion: 'test',
      backend,
    });
    expect(getAdCapabilities().iconAd).toBe(expected);
  });
});
