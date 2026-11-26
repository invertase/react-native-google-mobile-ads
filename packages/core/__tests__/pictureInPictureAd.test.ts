import {
  AdEventType,
  GAMAdEventType,
  getAdCapabilities,
  PictureInPictureAd,
  PictureInPictureAdEventType,
} from '../src';
import NativeGoogleMobileAdsModule from '../src/specs/modules/NativeGoogleMobileAdsModule';
import NativePictureInPictureModule from '../src/specs/modules/NativePictureInPictureModule';
import * as validatePictureInPictureAdShowOptionsModule from '../src/validatePictureInPictureAdShowOptions';
import { validatePictureInPictureAdShowOptions } from '../src/validatePictureInPictureAdShowOptions';

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
      expect(ad.responseInfo).toBeNull();
    });

    it('wraps request option validation errors', () => {
      // @ts-expect-error intentional invalid request options
      expect(() => PictureInPictureAd.createForAdRequest('abc', 'bad')).toThrow(
        'PictureInPictureAd.createForAdRequest(_, *)',
      );
    });
  });

  describe('native wiring', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('calls native load once until reload is allowed', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      ad.load();
      ad.load();
      expect(NativePictureInPictureModule.pictureInPictureLoad).toHaveBeenCalledTimes(1);
      // @ts-expect-error simulate error so load may be retried
      ad._handleAdEvent({
        body: { type: AdEventType.ERROR, error: { code: 'no-fill', message: 'No fill.' } },
      });
      ad.load();
      expect(NativePictureInPictureModule.pictureInPictureLoad).toHaveBeenCalledTimes(2);
    });

    it('rejects show when not loaded', async () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      await expect(ad.show()).rejects.toThrow('has not loaded');
    });

    it('shows with validated options after load', async () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      // @ts-expect-error simulate loaded
      ad._handleAdEvent({ body: { type: AdEventType.LOADED } });
      (
        NativePictureInPictureModule.pictureInPictureShow as jest.Mock
      ).mockResolvedValueOnce(undefined);
      await ad.show({ position: 'topLeft', presentationScope: 'application' });
      expect(NativePictureInPictureModule.pictureInPictureShow).toHaveBeenCalledWith(
        expect.any(Number),
        'abc',
        { position: 'topLeft', presentationScope: 'application' },
      );
    });

    it('validates show options', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      // @ts-expect-error simulate loaded
      ad._handleAdEvent({ body: { type: AdEventType.LOADED } });
      expect(() => ad.show({ position: 'center' as 'default' })).toThrow('position');
      // @ts-expect-error intentional non-object
      expect(() => ad.show('bad')).toThrow("'options' expected an object value");
    });

    it('rethrows non-Error validation failures from show', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      // @ts-expect-error simulate loaded
      ad._handleAdEvent({ body: { type: AdEventType.LOADED } });
      const spy = jest
        .spyOn(validatePictureInPictureAdShowOptionsModule, 'validatePictureInPictureAdShowOptions')
        .mockImplementation(() => {
          throw 'not-an-error';
        });
      try {
        expect(() => ad.show()).toThrow('not-an-error');
      } finally {
        spy.mockRestore();
      }
    });

    it('calls hide and destroy', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      ad.hide();
      expect(NativePictureInPictureModule.pictureInPictureHide).toHaveBeenCalledTimes(1);
      ad.destroy();
      expect(NativePictureInPictureModule.pictureInPictureDestroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('events', () => {
    it('stores responseInfo on load and clears loaded on error', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
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
      // @ts-expect-error private event path
      ad._handleAdEvent({
        body: { type: AdEventType.LOADED, data: { responseInfo } },
      });
      expect(ad.loaded).toBe(true);
      expect(ad.responseInfo?.responseId).toBe('ri-1');
      expect(loadedListener).toHaveBeenCalledWith(undefined);

      const errorListener = jest.fn();
      ad.addAdEventListener(AdEventType.ERROR, errorListener);
      // @ts-expect-error private event path
      ad._handleAdEvent({
        body: {
          type: AdEventType.ERROR,
          error: { code: 'no-fill', message: 'No fill.', responseInfo },
        },
      });
      expect(ad.loaded).toBe(false);
      expect(errorListener.mock.calls[0][0].reason).toBe('no-fill');
      expect(ad.responseInfo?.responseId).toBe('ri-1');
    });

    it('forwards PiP and paid events to typed and catch-all listeners', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      const shown = jest.fn();
      const events = jest.fn();
      const paid = jest.fn();
      const unsubShown = ad.addAdEventListener(PictureInPictureAdEventType.SHOWN, shown);
      const unsubEvents = ad.addAdEventsListener(events);
      ad.addAdEventListener(AdEventType.PAID, paid);

      // @ts-expect-error private event path
      ad._handleAdEvent({ body: { type: PictureInPictureAdEventType.SHOWN } });
      expect(shown).toHaveBeenCalled();
      expect(events).toHaveBeenCalledWith({
        type: PictureInPictureAdEventType.SHOWN,
        payload: undefined,
      });

      // @ts-expect-error private event path
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
      expect(paid.mock.calls[0][0].currency).toBe('USD');

      unsubShown();
      unsubEvents();
      ad.removeAllListeners();
      // @ts-expect-error private event path
      ad._handleAdEvent({ body: { type: PictureInPictureAdEventType.HIDDEN } });
      expect(shown).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid listener registration', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      // @ts-expect-error intentional
      expect(() => ad.addAdEventsListener('foo')).toThrow("'listener' expected a function");
      // @ts-expect-error intentional
      expect(() => ad.addAdEventListener('not-a-type', () => {})).toThrow('valid event type');
      expect(() => ad.addAdEventListener(GAMAdEventType.APP_EVENT, 'nope' as never)).toThrow(
        "'listener' expected a function",
      );
    });
  });

  describe('destroy', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('is idempotent and ignores late events', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      const listener = jest.fn();
      ad.addAdEventListener(AdEventType.LOADED, listener);
      ad.destroy();
      ad.destroy();
      expect(NativePictureInPictureModule.pictureInPictureDestroy).toHaveBeenCalledTimes(1);
      // @ts-expect-error private event path
      ad._handleAdEvent({ body: { type: AdEventType.LOADED } });
      expect(listener).not.toHaveBeenCalled();
      expect(ad.loaded).toBe(false);
    });

    it('blocks load/show/hide/listeners after destroy', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      ad.destroy();
      ad.load();
      expect(NativePictureInPictureModule.pictureInPictureLoad).not.toHaveBeenCalled();
      expect(() => ad.show()).toThrow('has been destroyed');
      expect(() => ad.hide()).toThrow('has been destroyed');
      expect(() => ad.addAdEventsListener(() => {})).toThrow('ad has been destroyed');
      expect(() => ad.addAdEventListener(AdEventType.LOADED, () => {})).toThrow(
        'ad has been destroyed',
      );
    });

    it('swallows native destroy throws', () => {
      const ad = PictureInPictureAd.createForAdRequest('abc');
      (NativePictureInPictureModule.pictureInPictureDestroy as jest.Mock).mockImplementationOnce(
        () => {
          throw new Error('native destroy failed');
        },
      );
      expect(() => ad.destroy()).not.toThrow();
    });
  });

  describe('event types', () => {
    it('exposes PiP visibility events', () => {
      expect(PictureInPictureAdEventType.SHOWN).toBe('shown');
      expect(PictureInPictureAdEventType.HIDDEN).toBe('hidden');
      expect(PictureInPictureAdEventType.WILL_PRESENT_SCREEN).toBe('will_present_screen');
      expect(PictureInPictureAdEventType.WILL_DISMISS_SCREEN).toBe('will_dismiss_screen');
      expect(PictureInPictureAdEventType.DID_DISMISS_SCREEN).toBe('did_dismiss_screen');
    });
  });
});

describe('validatePictureInPictureAdShowOptions', () => {
  it('returns empty object for undefined', () => {
    expect(validatePictureInPictureAdShowOptions()).toEqual({});
  });

  it('throws for non-object options', () => {
    // @ts-expect-error intentional
    expect(() => validatePictureInPictureAdShowOptions('foo')).toThrow(
      "'options' expected an object value",
    );
  });

  it('accepts valid position and presentationScope', () => {
    expect(
      validatePictureInPictureAdShowOptions({
        position: 'bottomRight',
        presentationScope: 'screen',
      }),
    ).toEqual({ position: 'bottomRight', presentationScope: 'screen' });
  });

  it('rejects invalid position and presentationScope', () => {
    expect(() =>
      validatePictureInPictureAdShowOptions({ position: 'center' as 'default' }),
    ).toThrow('options.position');
    expect(() =>
      validatePictureInPictureAdShowOptions({
        presentationScope: 'window' as 'screen',
      }),
    ).toThrow('options.presentationScope');
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
