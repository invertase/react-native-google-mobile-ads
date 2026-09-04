import { AdEventType, InterstitialAd } from '../src';
import NativeInterstitialModule from '../src/specs/modules/NativeInterstitialModule';

describe('Google Mobile Ads Interstitial', function () {
  describe('createForAdRequest', function () {
    it('throws if adUnitId is invalid', function () {
      // @ts-ignore
      expect(() => InterstitialAd.createForAdRequest(123)).toThrow(
        "'adUnitId' expected an string value",
      );
    });

    it('throws if requestOptions are invalid', function () {
      // @ts-ignore
      expect(() => InterstitialAd.createForAdRequest('123', 123)).toThrow(
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
        expect(NativeInterstitialModule.interstitialLoad).toHaveBeenCalledTimes(1);
      });

      it('does nothing if ad currently loading', () => {
        const ad = InterstitialAd.createForAdRequest('abc');

        ad.load();
        expect(NativeInterstitialModule.interstitialLoad).toHaveBeenCalledTimes(1);

        ad.load();
        expect(NativeInterstitialModule.interstitialLoad).toHaveBeenCalledTimes(1);
      });

      it('does nothing if ad is already loaded', () => {
        const ad = InterstitialAd.createForAdRequest('abc');

        // @ts-ignore
        ad._handleAdEvent({ body: { type: AdEventType.LOADED } });

        ad.load();
        expect(NativeInterstitialModule.interstitialLoad).not.toHaveBeenCalled();
      });

      it('can be called again after ad was closed', () => {
        const ad = InterstitialAd.createForAdRequest('abc');

        ad.load();
        expect(NativeInterstitialModule.interstitialLoad).toHaveBeenCalledTimes(1);

        // @ts-ignore
        ad._handleAdEvent({ body: { type: AdEventType.CLOSED } });

        ad.load();
        expect(NativeInterstitialModule.interstitialLoad).toHaveBeenCalledTimes(2);
      });

      it('can be called again after ad failed to load', () => {
        const ad = InterstitialAd.createForAdRequest('abc');

        ad.load();
        expect(NativeInterstitialModule.interstitialLoad).toHaveBeenCalledTimes(1);

        // @ts-ignore
        ad._handleAdEvent({ body: { type: AdEventType.ERROR } });

        ad.load();
        expect(NativeInterstitialModule.interstitialLoad).toHaveBeenCalledTimes(2);
      });

      it('caches ResponseInfo from loaded events and enriches no-fill errors', () => {
        const ad = InterstitialAd.createForAdRequest('abc');
        const responseInfo = {
          responseId: 'ri-1',
          adapterClassName: 'adapter',
          loadedAdapterResponse: {
            adapterClassName: 'adapter',
            adSourceName: 'AdMob',
            adSourceId: '1',
            adSourceInstanceName: null,
            adSourceInstanceId: null,
            latencyMillis: 10,
            outcome: 'success' as const,
            adError: null,
          },
          adapterResponses: [],
          extras: {},
        };

        const loadedListener = jest.fn();
        ad.addAdEventListener(AdEventType.LOADED, loadedListener);
        // @ts-ignore
        ad._handleAdEvent({
          body: { type: AdEventType.LOADED, data: { responseInfo } },
        });
        expect(ad.responseInfo?.responseId).toBe('ri-1');
        expect(loadedListener).toHaveBeenCalledWith(undefined);

        const errorListener = jest.fn();
        ad.addAdEventListener(AdEventType.ERROR, errorListener);
        // @ts-ignore
        ad._handleAdEvent({
          body: {
            type: AdEventType.ERROR,
            error: { code: 'no-fill', message: 'No fill.', responseInfo },
          },
        });
        expect(errorListener.mock.calls[0][0].reason).toBe('no-fill');
        expect(errorListener.mock.calls[0][0].phase).toBe('load');
        expect(errorListener.mock.calls[0][0].responseInfo?.responseId).toBe('ri-1');
        expect(ad.responseInfo?.responseId).toBe('ri-1');

        // @ts-ignore
        ad._handleAdEvent({ body: { type: AdEventType.CLOSED } });
        expect(ad.responseInfo).toBeNull();
      });

      it('forwards paid payloads including compact responseInfo', () => {
        const ad = InterstitialAd.createForAdRequest('abc');
        const paidListener = jest.fn();
        ad.addAdEventListener(AdEventType.PAID, paidListener);
        // @ts-ignore
        ad._handleAdEvent({
          body: {
            type: AdEventType.PAID,
            data: {
              currency: 'USD',
              precision: 3,
              value: 0.02,
              valueMicros: '20000',
              responseInfo: {
                responseId: 'paid-1',
                adapterClassName: 'adapter',
                loadedAdapterResponse: null,
                extras: {},
              },
            },
          },
        });
        expect(paidListener.mock.calls[0][0].currency).toBe('USD');
        expect(paidListener.mock.calls[0][0].responseInfo.responseId).toBe('paid-1');
      });

      it('notifies addAdEventsListener subscribers and clears responseInfo on load', () => {
        const ad = InterstitialAd.createForAdRequest('abc');
        const events = jest.fn();
        ad.addAdEventsListener(events);
        // @ts-ignore
        ad._handleAdEvent({
          body: {
            type: AdEventType.LOADED,
            data: {
              responseInfo: {
                responseId: 'ri-2',
                adapterClassName: null,
                loadedAdapterResponse: null,
                adapterResponses: [],
                extras: {},
              },
            },
          },
        });
        expect(events).toHaveBeenCalled();
        expect(ad.responseInfo?.responseId).toBe('ri-2');
        // @ts-ignore
        ad._handleAdEvent({ body: { type: AdEventType.CLOSED } });
        ad.load();
        expect(ad.responseInfo).toBeNull();
      });
    });

    describe('show', function () {
      it('throws if showing before loaded', function () {
        const i = InterstitialAd.createForAdRequest('abc');

        expect(() => i.show()).toThrow(
          'The requested InterstitialAd has not loaded and could not be shown',
        );
      });
    });

    describe('addAdEventsListener', function () {
      it('throws if listener is not a function', function () {
        const i = InterstitialAd.createForAdRequest('abc');

        // @ts-ignore
        expect(() => i.addAdEventsListener('foo')).toThrow("'listener' expected a function");
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
        expect(() => i.addAdEventListener('foo')).toThrow(
          "'type' expected a valid event type value.",
        );
      });

      it('throws if listener is not a function', function () {
        const i = InterstitialAd.createForAdRequest('abc');

        // @ts-ignore
        expect(() => i.addAdEventListener(AdEventType.LOADED, 'foo')).toThrow(
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
