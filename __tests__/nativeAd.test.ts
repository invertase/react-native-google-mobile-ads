import { NativeAd } from '../src';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';
import { version } from '../src/version';

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

describe('Google Mobile Ads NativeAd', function () {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createForAdRequest', function () {
    it('throws if adUnitId is invalid', async function () {
      // @ts-ignore
      await expect(NativeAd.createForAdRequest(123)).rejects.toThrow(
        "'adUnitId' expected an string value",
      );
    });

    it('throws if requestOptions are invalid', async function () {
      // @ts-ignore
      await expect(NativeAd.createForAdRequest('abc', 123)).rejects.toThrow(
        "NativeAd.createForAdRequest(_, *) 'options' expected an object value.",
      );
    });

    it('returns a new instance when native load succeeds', async function () {
      jest.mocked(NativeGoogleMobileAdsNativeModule.load).mockResolvedValueOnce(nativeAdProps);

      const ad = await NativeAd.createForAdRequest('abc');

      expect(ad.constructor.name).toEqual('NativeAd');
      expect(ad.adUnitId).toEqual('abc');
      expect(ad.headline).toEqual('Headline');
      expect(NativeGoogleMobileAdsNativeModule.load).toHaveBeenCalledWith('abc', {
        requestAgent: `rn-invertase-${version}`,
      });
    });

    it('rejects when native load fails', async function () {
      jest.mocked(NativeGoogleMobileAdsNativeModule.load).mockRejectedValueOnce(
        Object.assign(new Error('The ad request was invalid'), {
          code: 'ERROR_LOAD',
        }),
      );

      await expect(NativeAd.createForAdRequest('invalid-unit')).rejects.toMatchObject({
        message: 'The ad request was invalid',
        code: 'ERROR_LOAD',
      });
    });

    it('rejects with ERROR_LOAD when response id is missing', async function () {
      jest.mocked(NativeGoogleMobileAdsNativeModule.load).mockRejectedValueOnce(
        Object.assign(new Error('Failed to get a valid response ID from the loaded ad.'), {
          code: 'ERROR_LOAD',
        }),
      );

      await expect(NativeAd.createForAdRequest('abc')).rejects.toMatchObject({
        message: 'Failed to get a valid response ID from the loaded ad.',
        code: 'ERROR_LOAD',
      });
    });
  });
});
