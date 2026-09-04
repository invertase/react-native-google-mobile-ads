import { AdEventType } from '../src';
import { AdFormat } from '../src/types/AdFormat';
import { SharedEventEmitter } from '../src/internal/SharedEventEmitter';
import { createPooledFullscreenAd } from '../src/internal/pooledFullscreenAd';
import { SdkManagedAdPool } from '../src/internal/adPoolRegistry';
import NativeInterstitialModule from '../src/specs/modules/NativeInterstitialModule';
import NativeAppOpenModule from '../src/specs/modules/NativeAppOpenModule';
import NativeRewardedModule from '../src/specs/modules/NativeRewardedModule';
import NativeRewardedInterstitialModule from '../src/specs/modules/NativeRewardedInterstitialModule';

describe('FEAT-05 pooledFullscreenAd + registry events', () => {
  it('wires show/listeners/destroy for each fullscreen format', async () => {
    const formats = [
      AdFormat.INTERSTITIAL,
      AdFormat.APP_OPEN,
      AdFormat.REWARDED,
      AdFormat.REWARDED_INTERSTITIAL,
    ] as const;

    for (const format of formats) {
      const ad = createPooledFullscreenAd({
        format,
        adUnitId: `unit-${format}`,
        requestId: 42,
        responseInfo: { responseId: 'r1' } as never,
        observedAt: Date.now(),
        stalenessWindowMillis: 60_000,
      });

      expect(ad.provenance).toBe('pool/sdk-managed-preloader');
      expect(ad.isStaleByPolicy()).toBe(false);

      const events: string[] = [];
      const unsub = ad.addAdEventListener(AdEventType.OPENED, () => {
        events.push('opened');
      });
      const unsubAll = ad.addAdEventsListener(event => {
        events.push(String(event.type));
      });

      const eventType =
        format === AdFormat.APP_OPEN
          ? 'app_open'
          : format === AdFormat.INTERSTITIAL
            ? 'interstitial'
            : format === AdFormat.REWARDED
              ? 'rewarded'
              : 'rewarded_interstitial';

      SharedEventEmitter.emit(
        `google_mobile_ads_${eventType}_event:unit-${format}:42`,
        { body: { type: AdEventType.OPENED } },
      );
      expect(events).toContain('opened');

      await ad.show();
      unsub();
      unsubAll();
      ad.removeAllListeners();
      ad.destroy();
      ad.destroy(); // idempotent
    }

    expect(NativeInterstitialModule.interstitialShow).toHaveBeenCalled();
    expect(NativeAppOpenModule.appOpenShow).toHaveBeenCalled();
    expect(NativeRewardedModule.rewardedShow).toHaveBeenCalled();
    expect(NativeRewardedInterstitialModule.rewardedInterstitialShow).toHaveBeenCalled();
  });

  it('SdkManagedAdPool maps native available/exhausted/error events', () => {
    const pool = new SdkManagedAdPool({
      poolId: 'evt-pool',
      formats: [AdFormat.INTERSTITIAL],
      adUnitId: 'unit',
      effectiveBufferSize: 1,
      effectiveStalenessWindowMillis: 60_000,
      effectiveStalenessWindowSource: 'guidance/other',
      degraded: false,
      degradeReasons: [],
    });

    const seen: string[] = [];
    const unsub = pool.addListener(event => {
      seen.push(event.type);
    });

    SharedEventEmitter.emit('google_mobile_ads_pool_event:evt-pool:0', {
      body: { type: 'available', data: { responseId: 'resp-1' } },
    });
    SharedEventEmitter.emit('google_mobile_ads_pool_event:evt-pool:0', {
      body: { type: 'exhausted' },
    });
    SharedEventEmitter.emit('google_mobile_ads_pool_event:evt-pool:0', {
      body: {
        type: 'error',
        error: { code: 'internal-error', message: 'boom', reason: 'internal-error', phase: 'load' },
      },
    });

    expect(seen).toEqual(['available', 'exhausted', 'error']);
    pool.notifyDegraded(); // no-op when not degraded
    unsub();
    pool.destroy();
  });

  it('rejects show after destroy / double show and guards listeners', async () => {
    const ad = createPooledFullscreenAd({
      format: AdFormat.INTERSTITIAL,
      adUnitId: 'guard-unit',
      requestId: 7,
      responseInfo: null,
      observedAt: null,
      stalenessWindowMillis: 1,
    });

    expect(() =>
      ad.addAdEventListener('not-a-type' as never, () => undefined),
    ).toThrow(/valid event type/);
    expect(() => ad.addAdEventListener(AdEventType.OPENED, null as never)).toThrow(
      /expected a function/,
    );
    expect(() => ad.addAdEventsListener(null as never)).toThrow(/expected a function/);

    SharedEventEmitter.emit(`google_mobile_ads_interstitial_event:guard-unit:7`, {
      body: {
        type: AdEventType.ERROR,
        error: { code: 'show-error', message: 'fail', phase: 'show' },
      },
    });
    SharedEventEmitter.emit(`google_mobile_ads_interstitial_event:guard-unit:7`, {
      body: {
        type: AdEventType.PAID,
        data: { responseInfo: { responseId: 'nested' }, value: 1 },
      },
    });

    await ad.show();
    await expect(ad.show()).rejects.toThrow(/already been requested/);
    ad.destroy();
    await expect(ad.show()).rejects.toThrow(/destroyed/);
    expect(() => ad.addAdEventListener(AdEventType.OPENED, () => undefined)).toThrow(
      /destroyed/,
    );
    expect(() => ad.addAdEventsListener(() => undefined)).toThrow(/destroyed/);
  });

  it('fires onStaleByPolicy when window is tiny', async () => {
    jest.useFakeTimers();
    const ad = createPooledFullscreenAd({
      format: AdFormat.REWARDED,
      adUnitId: 'stale-unit',
      requestId: 9,
      responseInfo: { responseId: 'r' } as never,
      observedAt: Date.now() - 10_000,
      stalenessWindowMillis: 1,
    });
    const stale = jest.fn();
    ad.onStaleByPolicy(stale);
    jest.advanceTimersByTime(5);
    expect(stale).toHaveBeenCalled();
    ad.destroy();
    jest.useRealTimers();
  });
});
