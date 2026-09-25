import { AdEventType, InterstitialAd } from '../src';
import { AdFormat } from '../src/types/AdFormat';
import { SharedEventEmitter } from '../src/internal/SharedEventEmitter';
import { createPooledFullscreenAd } from '../src/internal/pooledFullscreenAd';
import {
  __resetFullscreenAdPresenceForTests,
  isFullscreenAdPresenting,
} from '../src/internal/fullscreenAdPresence';

// S1: exercise the REAL presence instrumentation through actual ad objects
// (imperative MobileAd + pooled fullscreen ad), not by calling the presence
// module directly, so the OPENED/CLOSED/ERROR/destroy wiring is locked down.

// A `now` far past any grace window, to probe the strict counter state.
const PAST_GRACE = (): number => Date.now() + 60_000;

describe('fullscreenAdPresence wiring (AO-2)', () => {
  afterEach(() => {
    jest.clearAllMocks();
    __resetFullscreenAdPresenceForTests();
  });

  describe('imperative MobileAd (InterstitialAd)', () => {
    it('raises on OPENED and lowers on CLOSED', () => {
      const ad = InterstitialAd.createForAdRequest('abc');
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);

      // @ts-ignore private event entry point (matches interstitial.test.ts)
      ad._handleAdEvent({ body: { type: AdEventType.OPENED } });
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(true);

      // @ts-ignore
      ad._handleAdEvent({ body: { type: AdEventType.CLOSED } });
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);
    });

    it('does NOT raise or decrement on a load-phase ERROR (no prior OPENED)', () => {
      const ad = InterstitialAd.createForAdRequest('abc');

      // @ts-ignore load-phase failure never presented an Activity
      ad._handleAdEvent({
        body: { type: AdEventType.ERROR, error: { code: 'no-fill', message: 'No fill.' } },
      });
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);

      // The counter was not driven negative: a later genuine OPENED still registers.
      // @ts-ignore
      ad._handleAdEvent({ body: { type: AdEventType.OPENED } });
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(true);
    });

    it('balances the counter when destroyed while presenting', () => {
      const ad = InterstitialAd.createForAdRequest('abc');
      // @ts-ignore
      ad._handleAdEvent({ body: { type: AdEventType.OPENED } });
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(true);

      ad.destroy();
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);
    });

    it('marks presence once per instance (duplicate OPENED does not stick)', () => {
      const ad = InterstitialAd.createForAdRequest('abc');
      // @ts-ignore
      ad._handleAdEvent({ body: { type: AdEventType.OPENED } });
      // @ts-ignore duplicate OPENED — guarded, must not raise a second time
      ad._handleAdEvent({ body: { type: AdEventType.OPENED } });
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(true);

      // A single CLOSED therefore fully balances it.
      // @ts-ignore
      ad._handleAdEvent({ body: { type: AdEventType.CLOSED } });
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);
    });
  });

  describe('pooled fullscreen ad', () => {
    function emit(unit: string, requestId: number, type: AdEventType) {
      SharedEventEmitter.emit(`google_mobile_ads_interstitial_event:${unit}:${requestId}`, {
        body: { type },
      });
    }

    function makePooled(unit: string, requestId: number) {
      return createPooledFullscreenAd({
        format: AdFormat.INTERSTITIAL,
        adUnitId: unit,
        requestId,
        responseInfo: { responseId: 'r1' } as never,
        observedAt: Date.now(),
        stalenessWindowMillis: 60_000,
      });
    }

    it('raises on OPENED and lowers on CLOSED for a pooled interstitial', () => {
      const ad = makePooled('pooled-unit', 7);
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);

      emit('pooled-unit', 7, AdEventType.OPENED);
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(true);

      emit('pooled-unit', 7, AdEventType.CLOSED);
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);

      ad.destroy();
    });

    it('balances when a pooled ad is destroyed while presenting', () => {
      const ad = makePooled('pooled-unit-2', 8);
      emit('pooled-unit-2', 8, AdEventType.OPENED);
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(true);

      ad.destroy();
      expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);
    });
  });
});
