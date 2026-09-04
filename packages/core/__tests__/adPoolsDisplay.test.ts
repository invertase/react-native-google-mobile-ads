import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

import {
  AdFormat,
  AdPoolPresets,
  AdPools,
  BannerAdSize,
  getAdCapabilities,
  useAdPool,
  usePooledAd,
} from '../src';
import { destroyAllAdPools } from '../src/internal/adPoolRegistry';
import { EmulatedAdPool } from '../src/internal/emulatedAdPool';
import { validateAdPoolConfig } from '../src/validateAdPoolConfig';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';

const GAM_UNIT = '/123/display-feed';

function nativeWinner(handleId = 'h-native') {
  return {
    format: 'native' as const,
    handleId,
    responseId: `resp-${handleId}`,
    headline: 'Headline',
    body: 'Body',
    callToAction: 'Install',
    advertiser: null,
    price: null,
    store: null,
    starRating: null,
    icon: null,
    images: null,
    mediaContent: { aspectRatio: 1, hasVideoContent: false, duration: 0 },
    extras: null,
    responseInfo: { responseId: `resp-${handleId}` },
    error: null,
    width: null,
    height: null,
  };
}

function bannerWinner(handleId = 'h-banner') {
  return {
    format: 'banner' as const,
    handleId,
    responseId: `resp-${handleId}`,
    headline: null,
    body: null,
    callToAction: null,
    advertiser: null,
    price: null,
    store: null,
    starRating: null,
    icon: null,
    images: null,
    mediaContent: null,
    extras: null,
    responseInfo: { responseId: `resp-${handleId}` },
    error: null,
    width: 320,
    height: 50,
  };
}

describe('FEAT-06 emulated display AdPools', () => {
  afterEach(() => {
    act(() => {
      destroyAllAdPools();
    });
    jest.clearAllMocks();
  });

  it('reports displayPreload as emulated', () => {
    expect(getAdCapabilities().displayPreload).toBe('emulated');
  });

  it('loud-degrades display depth > 1 and always tags emulated preload', () => {
    const resolved = validateAdPoolConfig(
      AdPoolPresets.display(GAM_UNIT, {
        bannerSizes: [BannerAdSize.BANNER],
        bufferSize: 3,
      }),
    );
    expect(resolved.requestedBufferSize).toBe(3);
    expect(resolved.effectiveBufferSize).toBe(1);
    expect(resolved.degraded).toBe(true);
    expect(resolved.degradeReasons).toEqual([
      'pool/degraded-buffer-size',
      'pool/emulated-no-sdk-preloader',
    ]);
  });

  it('depth-1 display preset is still degraded as emulated', () => {
    const resolved = validateAdPoolConfig(
      AdPoolPresets.display(GAM_UNIT, { bannerSizes: [BannerAdSize.MEDIUM_RECTANGLE] }),
    );
    expect(resolved.effectiveBufferSize).toBe(1);
    expect(resolved.degradeReasons).toEqual(['pool/emulated-no-sdk-preloader']);
  });

  it('hard-errors format-drop cases (AdMob + banner, missing sizes, missing ad-manager)', () => {
    expect(() =>
      validateAdPoolConfig(
        AdPoolPresets.display('ca-app-pub-xxx/banner', {
          bannerSizes: [BannerAdSize.BANNER],
        }),
      ),
    ).toThrow(/AdMob|would drop/);

    expect(() =>
      validateAdPoolConfig({
        poolId: 'd1',
        formats: [AdFormat.NATIVE, AdFormat.BANNER],
        adUnitId: GAM_UNIT,
        adServer: 'admob',
        bannerSizes: [BannerAdSize.BANNER],
      }),
    ).toThrow(/ad-manager/);

    expect(() =>
      validateAdPoolConfig({
        poolId: 'd2',
        formats: [AdFormat.NATIVE, AdFormat.BANNER],
        adUnitId: GAM_UNIT,
        adServer: 'ad-manager',
      }),
    ).toThrow(/bannerSizes/);
  });

  it('hard-errors mixing fullscreen with display', () => {
    expect(() =>
      validateAdPoolConfig({
        poolId: 'mix',
        formats: [AdFormat.INTERSTITIAL, AdFormat.BANNER],
        adUnitId: GAM_UNIT,
      }),
    ).toThrow(/mix/);
  });

  it('allows native-only AdMob display pools without banner', () => {
    const resolved = validateAdPoolConfig({
      poolId: 'native-only',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
    });
    expect(resolved.degraded).toBe(true);
    expect(resolved.degradeReasons).toContain('pool/emulated-no-sdk-preloader');
    expect(resolved.formats).toEqual([AdFormat.NATIVE]);
  });

  it('creates, fills via MultiFormat, polls with library provenance, and peeks', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce(
      nativeWinner('pool-n1'),
    );

    const pool = await AdPools.create(
      AdPoolPresets.display(GAM_UNIT, { bannerSizes: [BannerAdSize.BANNER] }),
    );
    expect(pool.resolved.degraded).toBe(true);
    expect(AdPools.get(pool.poolId)).toBe(pool);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const availability = await pool.getAvailability();
    expect(availability).toEqual({ available: true, observedCount: 1 });

    await expect(pool.peekResponseInfo()).resolves.toMatchObject({
      responseId: 'resp-pool-n1',
    });

    const poll = await pool.poll();
    expect(poll.status).toBe('filled');
    if (poll.status === 'filled') {
      expect(poll.ad.provenance).toBe('pool/emulated-no-sdk-preloader');
      expect(poll.ad.format).toBe(AdFormat.NATIVE);
      expect(poll.ad.isStaleByPolicy()).toBe(false);
      poll.ad.destroy();
    }
  });

  it('emits degraded event and surfaces ready-degraded via useAdPool', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue(
      bannerWinner('pool-b1'),
    );

    const events: string[] = [];
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const pool = await AdPools.create(
      AdPoolPresets.display(GAM_UNIT, {
        bannerSizes: [BannerAdSize.BANNER],
        bufferSize: 2,
      }),
    );
    // Create sync-calls notifyDegraded; with no prior subscribers the event is
    // pending until the first addListener replays it.
    pool.addListener(event => {
      events.push(event.type);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(events).toContain('degraded');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((await pool.getAvailability()).observedCount).toBe(1);

    const { result, unmount } = renderHook(() => useAdPool(pool.poolId));
    expect(result.current.status).toBe('ready-degraded');
    if (result.current.status === 'ready-degraded') {
      expect(result.current.pool.resolved.degradeReasons).toContain('pool/degraded-buffer-size');
    }
    unmount();
  });

  it('covers destroy, error load, timeout poll, and banner poll arms', async () => {
    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockRejectedValueOnce({ code: 'error', message: 'boom', reason: 'internal-error' });

    const errPool = await AdPools.create({
      poolId: 'err-pool',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const errPoll = await errPool.poll();
    expect(errPoll.status).toBe('no-fill');
    errPool.destroy();
    expect(AdPools.get('err-pool')).toBeNull();
    await expect(errPool.getAvailability()).resolves.toEqual({
      available: false,
      observedCount: 0,
    });
    await expect(errPool.peekResponseInfo()).resolves.toBeNull();
    const destroyedPoll = await errPool.poll();
    expect(destroyedPoll.status).toBe('error');

    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockResolvedValueOnce(bannerWinner('b-ok'));
    const bannerPool = await AdPools.create(
      AdPoolPresets.display(GAM_UNIT, { bannerSizes: [BannerAdSize.BANNER] }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const bannerPoll = await bannerPool.poll();
    expect(bannerPoll.status).toBe('filled');
    if (bannerPoll.status === 'filled') {
      expect(bannerPoll.ad.format).toBe(AdFormat.BANNER);
      expect(bannerPoll.ad.isStaleByPolicy()).toBe(false);
      const unsubStale = bannerPoll.ad.onStaleByPolicy(() => undefined);
      unsubStale();
      bannerPoll.ad.destroy();
    }
    bannerPool.destroy();

    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockImplementationOnce(
      () =>
        new Promise(() => {
          // never settles — exercises pollTimeoutMillis
        }),
    );
    const slow = await AdPools.create({
      poolId: 'slow-pool',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
      pollTimeoutMillis: 20,
    });
    const timed = await slow.poll();
    expect(timed.status).toBe('timeout');
    slow.destroy();
  });

  it('timed poll awaits in-flight fill then returns filled', async () => {
    let resolveLoad: ((value: ReturnType<typeof nativeWinner>) => void) | undefined;
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveLoad = resolve as (value: ReturnType<typeof nativeWinner>) => void;
        }),
    );

    const pool = await AdPools.create({
      poolId: 'timed-inflight',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
      pollTimeoutMillis: 500,
    });

    const pollPromise = pool.poll();
    expect(resolveLoad).toBeDefined();
    resolveLoad!(nativeWinner('timed-inflight-n'));

    const poll = await pollPromise;
    expect(poll.status).toBe('filled');
    if (poll.status === 'filled') {
      expect(poll.ad.adId).toBe('timed-inflight-n');
      poll.ad.destroy();
    }
    pool.destroy();
  });

  it('timed poll with ready slot and no inflight takes inventory via runPoll', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce(
      nativeWinner('timed-ready-n'),
    );

    const pool = await AdPools.create({
      poolId: 'timed-ready',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
      pollTimeoutMillis: 200,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((await pool.getAvailability()).observedCount).toBe(1);

    const poll = await pool.poll();
    expect(poll.status).toBe('filled');
    if (poll.status === 'filled') {
      expect(poll.ad.adId).toBe('timed-ready-n');
      poll.ad.destroy();
    }
    pool.destroy();
  });

  it('timed poll with empty slot kicks fill then awaits runPoll', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce({
      format: 'none',
      handleId: null,
      responseId: null,
      headline: null,
      body: null,
      callToAction: null,
      advertiser: null,
      price: null,
      store: null,
      starRating: null,
      icon: null,
      images: null,
      mediaContent: null,
      extras: null,
      responseInfo: { responseId: 'kick-nf' },
      error: { code: 'no-fill', message: 'No fill', reason: 'no-fill', phase: 'load' },
      width: null,
      height: null,
    });

    const pool = await AdPools.create({
      poolId: 'timed-kick',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
      pollTimeoutMillis: 500,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((await pool.getAvailability()).observedCount).toBe(0);

    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce(
      nativeWinner('timed-kick-n'),
    );

    const poll = await pool.poll();
    expect(poll.status).toBe('filled');
    if (poll.status === 'filled') {
      expect(poll.ad.adId).toBe('timed-kick-n');
      poll.ad.destroy();
    }
    pool.destroy();
  });

  it('usePooledAd surfaces no-fill from empty multi-format load', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue({
      format: 'none',
      handleId: null,
      responseId: null,
      headline: null,
      body: null,
      callToAction: null,
      advertiser: null,
      price: null,
      store: null,
      starRating: null,
      icon: null,
      images: null,
      mediaContent: null,
      extras: null,
      responseInfo: { responseId: 'hook-nf' },
      error: { code: 'no-fill', message: 'No fill', reason: 'no-fill', phase: 'load' },
      width: null,
      height: null,
    });

    const pool = await AdPools.create({
      poolId: 'hook-nf-pool',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const { result, unmount } = renderHook(() => usePooledAd(pool.poolId));
    await act(async () => {
      await result.current.poll();
    });
    expect(result.current.status).toBe('no-fill');
    expect(result.current.error).not.toBeNull();
    expect(result.current.ad).toBeNull();
    unmount();
  });

  it('destroys in-flight generation on recreate and abandons late fills', async () => {
    const resolvers: Array<(value: ReturnType<typeof nativeWinner>) => void> = [];
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockImplementation(
      () =>
        new Promise(resolve => {
          resolvers.push(resolve as (value: ReturnType<typeof nativeWinner>) => void);
        }),
    );

    const first = await AdPools.create({
      poolId: 'gen-pool',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
    });
    expect(resolvers.length).toBe(1);
    first.destroy();

    const second = await AdPools.create({
      poolId: 'gen-pool',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
    });
    expect(resolvers.length).toBe(2);

    // Late resolve of the destroyed generation must not fill the new pool.
    resolvers[0](nativeWinner('late-first'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((await second.getAvailability()).observedCount).toBe(0);

    resolvers[1](nativeWinner('second'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((await second.getAvailability()).observedCount).toBe(1);
    second.destroy();
  });

  it('policy-evicts pool-owned inventory without unprompted forever-refill', async () => {
    jest.useFakeTimers();
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce(
      nativeWinner('stale-n'),
    );

    const pool = await AdPools.create({
      poolId: 'stale-pool',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
      stalenessWindowMillis: 50,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((await pool.getAvailability()).observedCount).toBe(1);

    const expired: string[] = [];
    pool.addListener(event => {
      if (event.type === 'expired') {
        expired.push(event.adId);
      }
    });

    await act(async () => {
      jest.advanceTimersByTime(60);
      await Promise.resolve();
    });

    expect(expired.length).toBe(1);
    expect((await pool.getAvailability()).observedCount).toBe(0);
    // No second load kicked by expiry alone.
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('usePooledAd keeps already-held display ad on stale-by-policy', async () => {
    jest.useFakeTimers();
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue(
      nativeWinner('hook-n'),
    );

    const pool = await AdPools.create({
      poolId: 'hook-display',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
      stalenessWindowMillis: 40,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const { result, unmount } = renderHook(() => usePooledAd(pool.poolId));
    await act(async () => {
      await result.current.poll();
    });
    expect(result.current.status).toBe('filled');
    expect(result.current.ad).not.toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });

    expect(result.current.status).toBe('stale-by-policy');
    expect(result.current.ad).not.toBeNull();
    unmount();
    jest.useRealTimers();
  });

  it('poll no-fill after empty load surfaces PollResult no-fill', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue({
      format: 'none',
      handleId: null,
      responseId: null,
      headline: null,
      body: null,
      callToAction: null,
      advertiser: null,
      price: null,
      store: null,
      starRating: null,
      icon: null,
      images: null,
      mediaContent: null,
      extras: null,
      responseInfo: { responseId: 'nf' },
      error: { code: 'no-fill', message: 'No fill', reason: 'no-fill', phase: 'load' },
      width: null,
      height: null,
    });

    const pool = await AdPools.create({
      poolId: 'nf-pool',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const poll = await pool.poll();
    expect(poll.status).toBe('no-fill');
  });

  it('notifyDegraded emits immediately when listeners already exist; idempotent destroy', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue(
      nativeWinner('cov'),
    );
    const pool = await AdPools.create({
      poolId: 'cov-pool',
      formats: [AdFormat.NATIVE],
      adUnitId: 'ca-app-pub-test/native',
    });
    const events: string[] = [];
    pool.addListener(e => events.push(e.type));
    // First addListener replays pending degraded; call again with a subscriber present.
    expect(pool).toBeInstanceOf(EmulatedAdPool);
    (pool as EmulatedAdPool).notifyDegraded();
    expect(events.filter(e => e === 'degraded').length).toBeGreaterThanOrEqual(2);

    // ensureFilling early-return while slot/inflight occupied
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((await pool.getAvailability()).observedCount).toBe(1);
    await pool.poll(); // kicks refill
    await pool.poll(); // empty while refill in flight

    pool.destroy();
    pool.destroy();
  });

  it('hard-errors non-display format smuggled into a display set', () => {
    expect(() =>
      validateAdPoolConfig({
        poolId: 'bad-display',
        formats: [AdFormat.NATIVE, 'customNative' as AdFormat],
        adUnitId: 'unit',
      }),
    ).toThrow(/format-preload-unsupported|BANNER|NATIVE/);
  });

  it('does not break classic fullscreen pools', async () => {
    const pool = await AdPools.create(
      AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'unit', { bufferSize: 2 }),
    );
    expect(pool.resolved.degraded).toBe(false);
    expect(pool.resolved.effectiveBufferSize).toBe(2);
    const poll = await pool.poll();
    expect(['filled', 'empty']).toContain(poll.status);
    if (poll.status === 'filled') {
      expect(poll.ad.provenance).toBe('pool/sdk-managed-preloader');
      poll.ad.destroy();
    }
  });
});
