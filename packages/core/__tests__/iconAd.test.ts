import { AdEventType, IconAd, IconAssetType } from '../src';
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

  it('creates an instance', () => {
    const ad = IconAd.createForAdRequest('abc');
    expect(ad.constructor.name).toEqual('IconAd');
    expect(ad.adUnitId).toBe('abc');
    expect(typeof ad.requestId).toBe('number');
  });

  it('load calls native once', () => {
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

  it('applies loaded asset payload', () => {
    const ad = IconAd.createForAdRequest('abc');
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
  });

  it('emits typed listeners', () => {
    const ad = IconAd.createForAdRequest('abc');
    const loaded = jest.fn();
    const unsub = ad.addAdEventListener(AdEventType.LOADED, loaded);
    ad['_handleAdEvent']({ body: { type: AdEventType.LOADED } });
    expect(loaded).toHaveBeenCalledTimes(1);
    unsub();
    ad['_handleAdEvent']({ body: { type: AdEventType.LOADED } });
    expect(loaded).toHaveBeenCalledTimes(1);
  });
});

describe('IconAssetType', () => {
  it('exposes icon ad asset keys', () => {
    expect(IconAssetType.HEADLINE).toBe('headline');
    expect(IconAssetType.ICON).toBe('icon');
    expect(IconAssetType.AD_CHOICES).toBe('adChoices');
  });
});