import {
  AdEventType,
  getAdCapabilities,
  PictureInPictureAd,
  PictureInPictureAdEventType,
} from '../src';
import NativeGoogleMobileAdsModule from '../src/specs/modules/NativeGoogleMobileAdsModule';
import NativePictureInPictureModule from '../src/specs/modules/NativePictureInPictureModule';

describe('PictureInPictureAd', () => {
  describe('createForAdRequest', () => {
    it('throws if adUnitId is invalid', () => {
      // @ts-expect-error intentional invalid unit id
      expect(() => PictureInPictureAd.createForAdRequest(123)).toThrow(
        "'adUnitId' expected an string value",
      );
    });

    it('returns a new instance', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      expect(ad.constructor.name).toEqual('PictureInPictureAd');
      expect(ad.adUnitId).toEqual('abc');
      expect(ad.loaded).toEqual(false);
    });
  });

  describe('native wiring', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('calls native load', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      ad.load();
      expect(NativePictureInPictureModule.pictureInPictureLoad).toHaveBeenCalledTimes(1);
    });

    it('rejects show when not loaded', async () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      await expect(ad.show()).rejects.toThrow('has not loaded');
    });

    it('validates show options', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      // @ts-expect-error simulate loaded
      ad._handleAdEvent({ body: { type: AdEventType.LOADED } });
      expect(() => ad.show({ position: 'center' as 'default' })).toThrow('position');
    });

    it('calls hide and destroy', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      ad.hide();
      expect(NativePictureInPictureModule.pictureInPictureHide).toHaveBeenCalledTimes(1);
      ad.destroy();
      expect(NativePictureInPictureModule.pictureInPictureDestroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('event types', () => {
    it('exposes PiP visibility events', () => {
      expect(PictureInPictureAdEventType.SHOWN).toBe('shown');
      expect(PictureInPictureAdEventType.HIDDEN).toBe('hidden');
    });
  });
});

describe('getAdCapabilities pictureInPicture', () => {
  afterEach(() => {
    jest.mocked(NativeGoogleMobileAdsModule.getConstants).mockReturnValue({
      sdkVersion: 'test',
      backend: 'ios',
    });
  });

  it.each([
    ['ios', 'experimental'],
    ['android-next-gen', 'experimental'],
    ['android-classic', 'unavailable'],
  ] as const)('reports %s as %s', (backend, expected) => {
    jest.mocked(NativeGoogleMobileAdsModule.getConstants).mockReturnValue({
      sdkVersion: 'test',
      backend,
    });
    expect(getAdCapabilities().pictureInPicture).toBe(expected);
  });
});