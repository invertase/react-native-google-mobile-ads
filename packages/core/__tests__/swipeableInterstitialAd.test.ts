import {
  AdEventType,
  getAdCapabilities,
  SwipeableInterstitialAd,
  SwipeableInterstitialAdEventType,
} from '../src';
import NativeGoogleMobileAdsModule from '../src/specs/modules/NativeGoogleMobileAdsModule';
import NativeSwipeableInterstitialAdModule from '../src/specs/modules/NativeSwipeableInterstitialAdModule';
import { validateSwipeableInterstitialAdRequestOptions } from '../src/validateSwipeableInterstitialAdRequestOptions';

describe('SwipeableInterstitialAd', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws if adUnitId is invalid', () => {
    expect(() => SwipeableInterstitialAd.createForAdRequest(123 as unknown as string)).toThrow(
      "SwipeableInterstitialAd.createForAdRequest(*) 'adUnitId' expected an string value.",
    );
  });

  it('wraps request option validation errors', () => {
    expect(() =>
      SwipeableInterstitialAd.createForAdRequest('abc', { maxScreenHoldDurationSeconds: -1 }),
    ).toThrow('SwipeableInterstitialAd.createForAdRequest(_, *)');
  });

  it('calls native load once until reload is allowed', () => {
    const ad = SwipeableInterstitialAd.createForAdRequest('abc');
    ad.load();
    ad.load();
    expect(NativeSwipeableInterstitialAdModule.swipeableInterstitialLoad).toHaveBeenCalledTimes(1);
    // @ts-expect-error simulate error so load may be retried
    ad._handleAdEvent({
      body: { type: AdEventType.ERROR, error: { code: 'no-fill', message: 'No fill.' } },
    });
    ad.load();
    expect(NativeSwipeableInterstitialAdModule.swipeableInterstitialLoad).toHaveBeenCalledTimes(2);
  });

  it('destroys via native module', () => {
    const ad = SwipeableInterstitialAd.createForAdRequest('abc');
    ad.destroy();
    expect(NativeSwipeableInterstitialAdModule.swipeableInterstitialDestroy).toHaveBeenCalledWith(
      ad.requestId,
    );
  });

  it('records loaded metadata', () => {
    const ad = SwipeableInterstitialAd.createForAdRequest('abc');
    // @ts-expect-error simulate loaded
    ad._handleAdEvent({
      body: {
        type: AdEventType.LOADED,
        data: { minScreenHoldDuration: 3, isCustomClickGestureEnabled: true },
      },
    });
    expect(ad.minScreenHoldDuration).toBe(3);
    expect(ad.isCustomClickGestureEnabled).toBe(true);
    expect(ad.loaded).toBe(true);
  });

  it('recordCustomClickGesture requires loaded custom-click ad', () => {
    const ad = SwipeableInterstitialAd.createForAdRequest('abc');
    expect(() => ad.recordCustomClickGesture()).toThrow('has not loaded');
    // @ts-expect-error simulate loaded without custom click
    ad._handleAdEvent({ body: { type: AdEventType.LOADED, data: {} } });
    expect(() => ad.recordCustomClickGesture()).toThrow('not enabled');
    // @ts-expect-error simulate custom click enabled
    ad._handleAdEvent({
      body: { type: AdEventType.LOADED, data: { isCustomClickGestureEnabled: true } },
    });
    ad.recordCustomClickGesture();
    expect(
      NativeSwipeableInterstitialAdModule.swipeableInterstitialRecordCustomClickGesture,
    ).toHaveBeenCalledWith(ad.requestId);
  });
});

describe('getAdCapabilities swipeableInterstitial', () => {
  const backends = [
    ['ios', 'experimental'],
    ['android-classic', 'unavailable'],
    ['android-next-gen', 'experimental'],
  ] as const;

  it.each(backends)('backend %s reports %s', (backend, expected) => {
    jest.mocked(NativeGoogleMobileAdsModule.getConstants).mockReturnValue({
      sdkVersion: 'test',
      backend,
    });
    expect(getAdCapabilities().swipeableInterstitial).toBe(expected);
  });
});

describe('SwipeableInterstitialAdEventType', () => {
  it('exposes screen hold timer started', () => {
    expect(SwipeableInterstitialAdEventType.SCREEN_HOLD_TIMER_STARTED).toBe(
      'screen_hold_timer_started',
    );
    expect(SwipeableInterstitialAdEventType.WILL_PRESENT_SCREEN).toBe('will_present_screen');
    expect(SwipeableInterstitialAdEventType.WILL_DISMISS_SCREEN).toBe('will_dismiss_screen');
    expect(SwipeableInterstitialAdEventType.DID_DISMISS_SCREEN).toBe('did_dismiss_screen');
  });
});

describe('validateSwipeableInterstitialAdRequestOptions', () => {
  const adSize = { width: 320, height: 480 };

  it.each(['left', 'right', 'up', 'down'] as const)('accepts direction %s with a positive ad size', direction => {
    const options = {
      adSize,
      customClickSwipeGesture: { direction, tapsAllowed: true },
    };
    expect(validateSwipeableInterstitialAdRequestOptions(options)).toEqual({
      ...options,
      requestAgent: expect.stringMatching(/^rn-invertase-/),
    });
  });

  it('rejects a direction outside the swipe set', () => {
    expect(() =>
      validateSwipeableInterstitialAdRequestOptions({
        customClickSwipeGesture: { direction: 'diagonal' as 'left' },
      }),
    ).toThrow("'options.customClickSwipeGesture.direction'");
  });

  it.each([
    { width: 0, height: 480 },
    { width: 320, height: -1 },
  ])('rejects a non-positive ad size %j', adSizeCase => {
    expect(() => validateSwipeableInterstitialAdRequestOptions({ adSize: adSizeCase })).toThrow(
      "'options.adSize' expected positive numeric width and height.",
    );
  });

  it('rejects a non-boolean tapsAllowed', () => {
    expect(() =>
      validateSwipeableInterstitialAdRequestOptions({
        customClickSwipeGesture: { direction: 'left', tapsAllowed: 'yes' as unknown as boolean },
      }),
    ).toThrow("'options.customClickSwipeGesture.tapsAllowed'");
  });

  it('rejects a non-boolean requestCustomClickGesture', () => {
    expect(() =>
      validateSwipeableInterstitialAdRequestOptions({
        requestCustomClickGesture: 'yes' as unknown as boolean,
      }),
    ).toThrow("'options.requestCustomClickGesture'");
  });
});