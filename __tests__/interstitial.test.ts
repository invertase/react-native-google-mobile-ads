import { AdEventType, InterstitialAd } from '../src';
import { NativeModules } from 'react-native';

describe('Google Mobile Ads Interstitial', function () {
  describe('createForAdRequest', function () {
    it('throws if adUnitId is invalid', function () {
      // @ts-ignore
      expect(() => InterstitialAd.createForAdRequest(123)).toThrowError(
        "'adUnitId' expected an string value",
      );
    });

    it('throws if requestOptions are invalid', function () {
      // @ts-ignore
      expect(() => InterstitialAd.createForAdRequest('123', 123)).toThrowError(
        "InterstitialAd.createForAdRequest(_, *) 'options' expected an object value.",
      );
    });

    // has own tests
    it('returns a new instance', function () {
      const i = InterstitialAd.createForAdRequest('abc');
      expect(i.constructor.name).toEqual('InterstitialAd');
      expect(i.adUnitId).toEqual('abc');
      expect(i.loaded).toEqual(false);
    });

    describe('load()', () => {
      afterEach(() => {
        jest.clearAllMocks();
      });

      it('does call native load method', () => {
        const ad = InterstitialAd.createForAdRequest('abc');

        ad.load();
        expect(NativeModules.RNGoogleMobileAdsInterstitialModule.interstitialLoad).toBeCalledTimes(
          1,
        );
      });

      it('does nothing if ad currently loading', () => {
        const ad = InterstitialAd.createForAdRequest('abc');

        ad.load();
        expect(NativeModules.RNGoogleMobileAdsInterstitialModule.interstitialLoad).toBeCalledTimes(
          1,
        );

        ad.load();
        expect(NativeModules.RNGoogleMobileAdsInterstitialModule.interstitialLoad).toBeCalledTimes(
          1,
        );
      });

      it('does nothing if ad is already loaded', () => {
        const ad = InterstitialAd.createForAdRequest('abc');

        // @ts-ignore
        ad._handleAdEvent({ body: { type: AdEventType.LOADED } });

        ad.load();
        expect(NativeModules.RNGoogleMobileAdsInterstitialModule.interstitialLoad).not.toBeCalled();
      });

      it('can be called again after ad was closed', () => {
        const ad = InterstitialAd.createForAdRequest('abc');

        ad.load();
        expect(NativeModules.RNGoogleMobileAdsInterstitialModule.interstitialLoad).toBeCalledTimes(
          1,
        );

        // @ts-ignore
        ad._handleAdEvent({ body: { type: AdEventType.CLOSED } });

        ad.load();
        expect(NativeModules.RNGoogleMobileAdsInterstitialModule.interstitialLoad).toBeCalledTimes(
          2,
        );
      });

      it('can be called again after ad failed to load', () => {
        const ad = InterstitialAd.createForAdRequest('abc');

        ad.load();
        expect(NativeModules.RNGoogleMobileAdsInterstitialModule.interstitialLoad).toBeCalledTimes(
          1,
        );

        // @ts-ignore
        ad._handleAdEvent({ body: { type: AdEventType.ERROR } });

        ad.load();
        expect(NativeModules.RNGoogleMobileAdsInterstitialModule.interstitialLoad).toBeCalledTimes(
          2,
        );
      });
    });

    describe('show', function () {
      it('throws if showing before loaded', function () {
        const i = InterstitialAd.createForAdRequest('abc');

        expect(() => i.show()).toThrowError(
          'The requested InterstitialAd has not loaded and could not be shown',
        );
      });
    });

    describe('addAdEventsListener', function () {
      it('throws if listener is not a function', function () {
        const i = InterstitialAd.createForAdRequest('abc');

        // @ts-ignore
        expect(() => i.addAdEventsListener('foo')).toThrowError("'listener' expected a function");
      });

      it('returns an unsubscriber function', function () {
        const i = InterstitialAd.createForAdRequest('abc');
        const unsub = i.addAdEventsListener(() => {});
        expect(unsub).toBeDefined();
        unsub();
      });
    });

    describe('addAdEventListener', function () {
      it('throws if type is not a AdEventType', function () {
        const i = InterstitialAd.createForAdRequest('abc');

        // @ts-ignore
        expect(() => i.addAdEventListener('foo')).toThrowError(
          "'type' expected a valid event type value.",
        );
      });

      it('throws if listener is not a function', function () {
        const i = InterstitialAd.createForAdRequest('abc');

        // @ts-ignore
        expect(() => i.addAdEventListener(AdEventType.LOADED, 'foo')).toThrowError(
          "'listener' expected a function",
        );
      });

      it('returns an unsubscriber function', function () {
        const i = InterstitialAd.createForAdRequest('abc');
        const unsub = i.addAdEventListener(AdEventType.LOADED, () => {});
        expect(unsub).toBeDefined();
        unsub();
      });
    });
  });
});
