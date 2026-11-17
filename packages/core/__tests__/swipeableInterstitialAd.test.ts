import {
  AdEventType,
  getAdCapabilities,
  SwipeableInterstitialAd,
  SwipeableInterstitialAdEventType,
} from '../src';
import NativeGoogleMobileAdsModule from '../src/specs/modules/NativeGoogleMobileAdsModule';
import NativeSwipeableInterstitialAdModule from '../src/specs/modules/NativeSwipeableInterstitialAdModule';

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
  });
});