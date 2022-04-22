import { AdEventType, InterstitialAd } from '../src';

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
