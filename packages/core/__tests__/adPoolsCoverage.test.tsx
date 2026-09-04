import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import {
  AdFormat,
  AdPoolPresets,
  AdPoolProvider,
  AdPools,
  useAdPool,
  usePooledAd,
} from '../src';
import {
  destroyAllAdPools,
  registerAdPool,
  SdkManagedAdPool,
} from '../src/internal/adPoolRegistry';
import { SharedEventEmitter } from '../src/internal/SharedEventEmitter';
import { resetFullscreenRequestIdsForTests } from '../src/internal/fullscreenRequestIds';
import { validateAdPoolConfig } from '../src/validateAdPoolConfig';
import NativeGoogleMobileAdsPoolModule from '../src/specs/modules/NativeGoogleMobileAdsPoolModule';

describe('FEAT-05 pool coverage arms', () => {
  afterEach(() => {
    // Registry notify updates mounted hooks; keep teardown inside act (F3).
    act(() => {
      destroyAllAdPools();
    });
    resetFullscreenRequestIdsForTests();
    jest.clearAllMocks();
  });

  it('validateAdPoolConfig hard-errors empty formats, bad buffer, bad poll timeout, bad staleness', () => {
    expect(() =>
      validateAdPoolConfig({ poolId: 'p', formats: [], adUnitId: 'u' }),
    ).toThrow(/formats/);
    expect(() =>
      validateAdPoolConfig({
        poolId: 'p',
        formats: [AdFormat.INTERSTITIAL],
        adUnitId: 'u',
        bufferSize: 0,
      }),
    ).toThrow(/bufferSize/);
    expect(() =>
      validateAdPoolConfig({
        poolId: 'p',
        formats: [AdFormat.INTERSTITIAL],
        adUnitId: 'u',
        pollTimeoutMillis: -1,
      }),
    ).toThrow(/pollTimeoutMillis/);
    expect(() =>
      validateAdPoolConfig({
        poolId: 'p',
        formats: [AdFormat.INTERSTITIAL],
        adUnitId: 'u',
        stalenessWindowMillis: 0,
      }),
    ).toThrow(/stalenessWindowMillis/);
    expect(() =>
      validateAdPoolConfig({
        poolId: 'p',
        formats: [AdFormat.INTERSTITIAL, AdFormat.REWARDED],
        adUnitId: 'u',
      }),
    ).toThrow(/exactly one/);
    expect(() => validateAdPoolConfig(null as never)).toThrow(/object/);
  });

  it('AdPoolProvider creates and destroys pools by poolId reconciliation', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'unit-a', {
      bufferSize: 1,
    });
    const { rerender, unmount } = render(
      <AdPoolProvider pools={[config]}>
        <React.Fragment />
      </AdPoolProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(AdPools.get(config.poolId)).not.toBeNull();

    const other = AdPoolPresets.fullscreen(AdFormat.REWARDED, 'unit-b');
    rerender(
      <AdPoolProvider pools={[other]}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(AdPools.get(config.poolId)).toBeNull();
    expect(AdPools.get(other.poolId)).not.toBeNull();

    unmount();
    expect(AdPools.get(other.poolId)).toBeNull();
  });

  it('useAdPool and usePooledAd exercise ready / poll / release / retry', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'hook-unit', {
      bufferSize: 2,
      pollTimeoutMillis: 50,
      stalenessWindowMillis: 60_000,
    });
    await AdPools.create(config);

    let poolHook: ReturnType<typeof useAdPool> | undefined;
    let pooledHook: ReturnType<typeof usePooledAd> | undefined;
    function Probe() {
      poolHook = useAdPool(config.poolId);
      pooledHook = usePooledAd(config.poolId);
      return null;
    }
    const { unmount } = render(<Probe />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(poolHook!.status).toBe('ready');
    expect(pooledHook!.poolStatus).toBe('ready');

    let pollResult: Awaited<ReturnType<typeof pooledHook.poll>> | undefined;
    await act(async () => {
      pollResult = await pooledHook!.poll();
    });
    expect(pollResult?.status).toBe('filled');
    expect(pooledHook!.status).toBe('filled');

    const released = pooledHook!.release();
    expect(released).not.toBeNull();
    released?.destroy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(pooledHook!.status).toBe('idle');

    act(() => {
      poolHook!.retry();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(['ready', 'creating', 'ready-degraded']).toContain(poolHook!.status);

    unmount();
  });

  it('destroyAll clears registry and native destroy is invoked', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.APP_OPEN, 'ao-unit');
    await AdPools.create(config);
    expect(AdPools.get(config.poolId)).not.toBeNull();
    AdPools.destroyAll();
    expect(AdPools.get(config.poolId)).toBeNull();
    expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalled();
  });

  it('app open guidance window and configured staleness source', () => {
    const guidance = validateAdPoolConfig(
      AdPoolPresets.fullscreen(AdFormat.APP_OPEN, 'ao'),
    );
    expect(guidance.effectiveStalenessWindowSource).toBe('guidance/app-open');
    const configured = validateAdPoolConfig(
      AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'i', {
        stalenessWindowMillis: 1234,
      }),
    );
    expect(configured.effectiveStalenessWindowSource).toBe('configured');
    expect(configured.effectiveStalenessWindowMillis).toBe(1234);
  });

  it('peek unsupported path on android-classic mock when Platform forced', async () => {
    if (Platform.OS === 'ios') {
      // Force peek via capability: on ios peek is supported; cover destroy after create.
      const pool = await AdPools.create(
        AdPoolPresets.fullscreen(AdFormat.REWARDED, 'r-unit', { bufferSize: 1 }),
      );
      await expect(pool.peekResponseInfo()).resolves.toBeNull();
      const availability = await pool.getAvailability();
      expect(typeof availability.observedCount).toBe('number');
      pool.destroy();
      return;
    }
    const pool = await AdPools.create(
      AdPoolPresets.fullscreen(AdFormat.REWARDED, 'r-unit', { bufferSize: 1 }),
    );
    await expect(pool.peekResponseInfo()).rejects.toMatchObject({
      reason: 'pool/peek-unsupported',
    });
    pool.destroy();
  });

  it('validateAdPoolConfig covers remaining hard-error arms', () => {
    expect(() =>
      validateAdPoolConfig({
        poolId: '',
        formats: [AdFormat.INTERSTITIAL],
        adUnitId: 'u',
      }),
    ).toThrow(/poolId/);
    expect(() =>
      validateAdPoolConfig({
        poolId: 'p',
        formats: [AdFormat.INTERSTITIAL],
        adUnitId: '',
      }),
    ).toThrow(/adUnitId/);
    expect(() =>
      validateAdPoolConfig({
        poolId: 'p',
        formats: [1 as never],
        adUnitId: 'u',
      }),
    ).toThrow(/formats\[0\]/);
    expect(() =>
      validateAdPoolConfig({
        poolId: 'p',
        formats: [AdFormat.INTERSTITIAL, AdFormat.INTERSTITIAL],
        adUnitId: 'u',
      }),
    ).toThrow(/duplicates/);
    expect(() =>
      validateAdPoolConfig({
        poolId: 'p',
        formats: ['not-a-format' as never],
        adUnitId: 'u',
      }),
    ).toThrow(/fullscreen/);
    expect(() =>
      validateAdPoolConfig({
        poolId: 'p',
        formats: [AdFormat.INTERSTITIAL],
        adUnitId: 'u',
        adServer: 'other' as never,
      }),
    ).toThrow(/adServer/);
    expect(() =>
      validateAdPoolConfig({
        poolId: 'p',
        formats: [AdFormat.INTERSTITIAL],
        adUnitId: 'u',
        bufferSize: Number.NaN,
      }),
    ).toThrow(/bufferSize/);
  });

  it('AdPools.create replaces existing pool and surfaces non-Error validate throws', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'replace-unit', {
      bufferSize: 1,
    });
    const first = await AdPools.create(config);
    const second = await AdPools.create(config);
    expect(second).not.toBe(first);
    expect(AdPools.get(config.poolId)).toBe(second);

    const validateSpy = jest
      .spyOn(require('../src/validateAdPoolConfig'), 'validateAdPoolConfig')
      .mockImplementationOnce(() => {
        throw { message: 'weird' };
      });
    await expect(AdPools.create(config)).rejects.toMatchObject({
      reason: 'invalid-request',
    });
    validateSpy.mockRestore();

    const validateErrorSpy = jest
      .spyOn(require('../src/validateAdPoolConfig'), 'validateAdPoolConfig')
      .mockImplementationOnce(() => {
        throw new Error('typed');
      });
    await expect(AdPools.create(config)).rejects.toThrow('typed');
    validateErrorSpy.mockRestore();
  });

  it('validateAdPoolConfig throws when capability marks format unavailable', () => {
    const capsModule = require('../src/capabilities/getAdCapabilities');
    const base = capsModule.getAdCapabilities();
    const spy = jest.spyOn(capsModule, 'getAdCapabilities').mockReturnValue({
      ...base,
      fullscreenPreloadFormats: {
        ...base.fullscreenPreloadFormats,
        [AdFormat.INTERSTITIAL]: 'unavailable',
      },
    });
    expect(() =>
      validateAdPoolConfig({
        poolId: 'p',
        formats: [AdFormat.INTERSTITIAL],
        adUnitId: 'u',
      }),
    ).toThrow(/unavailable/);
    spy.mockRestore();
  });

  it('usePooledAd timeout / error paths without leaking fake timers', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'hook-paths', {
      bufferSize: 1,
      pollTimeoutMillis: 5,
    });
    await AdPools.create(config);

    (
      NativeGoogleMobileAdsPoolModule.poolPoll as jest.Mock
    ).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          setTimeout(
            () => resolve({ filled: true, requestId: 99, responseId: 'late' }),
            80,
          );
        }),
    );

    let pooledHook: ReturnType<typeof usePooledAd> | undefined;
    function Probe() {
      pooledHook = usePooledAd(config.poolId);
      return null;
    }
    render(<Probe />);

    let timed: Awaited<ReturnType<typeof pooledHook.poll>> | undefined;
    await act(async () => {
      timed = await pooledHook!.poll();
    });
    expect(timed?.status).toBe('timeout');

    (
      NativeGoogleMobileAdsPoolModule.poolPoll as jest.Mock
    ).mockRejectedValueOnce(new Error('native poll failed'));
    (
      NativeGoogleMobileAdsPoolModule.poolGetAvailability as jest.Mock
    ).mockResolvedValueOnce({ available: true, observedCount: 1 });
    await act(async () => {
      const errResult = await pooledHook!.poll();
      expect(errResult.status).toBe('error');
    });

    destroyAllAdPools();
  });

  it('destroyed pool returns empty availability / null peek / poll error; timeout race', async () => {
    const pool = await AdPools.create(
      AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'life-unit', {
        bufferSize: 1,
        pollTimeoutMillis: 5,
      }),
    );
    pool.destroy();
    await expect(pool.getAvailability()).resolves.toEqual({
      available: false,
      observedCount: 0,
    });
    await expect(pool.peekResponseInfo()).resolves.toBeNull();
    await expect(pool.poll()).resolves.toMatchObject({ status: 'error' });

    const live = await AdPools.create(
      AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'timeout-unit', {
        bufferSize: 1,
        pollTimeoutMillis: 1,
      }),
    );
    (
      NativeGoogleMobileAdsPoolModule.poolPoll as jest.Mock
    ).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          setTimeout(
            () => resolve({ filled: true, requestId: 1, responseId: 'late' }),
            50,
          );
        }),
    );
    const timed = await live.poll();
    expect(['timeout', 'filled']).toContain(timed.status);
    live.destroy();
  });

  it('poll empty when native reports no fill; listener errors are swallowed', async () => {
    const pool = await AdPools.create(
      AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'empty-unit', { bufferSize: 1 }),
    );
    // Exhaust mock inventory then poll again.
    await pool.poll();
    await expect(pool.poll()).resolves.toMatchObject({ status: 'empty' });

    pool.addListener(() => {
      throw new Error('listener boom');
    });
    const { SharedEventEmitter } = require('../src/internal/SharedEventEmitter');
    SharedEventEmitter.emit(`google_mobile_ads_pool_event:${pool.poolId}:0`, {
      body: { type: 'available', data: { responseId: 'seen-1' } },
    });
    SharedEventEmitter.emit(`google_mobile_ads_pool_event:${pool.poolId}:0`, {
      body: { type: 'available', data: { responseId: 'seen-1' } },
    });
    pool.destroy();
  });

  it('AdPoolProvider keeps same-signature pools; usePooledAd empty/coalesce/show-consumed', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'sig-unit', {
      bufferSize: 2,
    });
    const sameArrayIdentity = [config];
    const { rerender } = render(
      <AdPoolProvider pools={sameArrayIdentity}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    const pool = AdPools.get(config.poolId);
    expect(pool).not.toBeNull();

    // Same poolId + same signature → continue path (line 103).
    rerender(
      <AdPoolProvider pools={[{ ...config }]}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(AdPools.get(config.poolId)).toBe(pool);

    let pooledHook: ReturnType<typeof usePooledAd> | undefined;
    function Probe() {
      pooledHook = usePooledAd(config.poolId);
      return null;
    }
    const { unmount } = render(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });

    let first: Awaited<ReturnType<typeof pooledHook.poll>> | undefined;
    let second: Awaited<ReturnType<typeof pooledHook.poll>> | undefined;
    await act(async () => {
      const a = pooledHook!.poll();
      const b = pooledHook!.poll();
      first = await a;
      second = await b;
    });
    expect(first).toBe(second);
    expect(first?.status).toBe('filled');

    await act(async () => {
      await pooledHook!.ad!.show();
    });
    expect(pooledHook!.status).toBe('consumed');

    // Missing pool → empty poll
    unmount();
    destroyAllAdPools();
    let missing: ReturnType<typeof usePooledAd> | undefined;
    function Missing() {
      missing = usePooledAd('no-such-pool');
      return null;
    }
    render(<Missing />);
    await act(async () => {
      const result = await missing!.poll();
      expect(result.status).toBe('empty');
    });
  });

  it('usePooledAd fullscreen stale-by-policy destroys owned ad', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'stale-hook-unit', {
        bufferSize: 1,
        stalenessWindowMillis: 25,
      });
      const pool = await AdPools.create(config);
      const responseId = 'stale-hook-resp';

      await act(async () => {
        SharedEventEmitter.emit(`google_mobile_ads_pool_event:${pool.poolId}:0`, {
          body: { type: 'available', data: { responseId } },
        });
      });

      (
        NativeGoogleMobileAdsPoolModule.poolGetAvailability as jest.Mock
      ).mockResolvedValueOnce({ available: true, observedCount: 1 });
      (NativeGoogleMobileAdsPoolModule.poolPoll as jest.Mock).mockResolvedValueOnce({
        filled: true,
        requestId: 501,
        responseId,
        responseInfo: { responseId },
      });

      let pooledHook: ReturnType<typeof usePooledAd> | undefined;
      function Probe() {
        pooledHook = usePooledAd(config.poolId);
        return null;
      }
      render(<Probe />);
      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        const result = await pooledHook!.poll();
        expect(result.status).toBe('filled');
      });
      expect(pooledHook!.status).toBe('filled');
      expect(pooledHook!.ad).not.toBeNull();

      // Expiry timer was armed at poll; advance past the configured window.
      await act(async () => {
        jest.advanceTimersByTime(40);
      });
      expect(pooledHook!.status).toBe('stale-by-policy');
      expect(pooledHook!.ad).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('usePooledAd watchStale no-ops after release (ownedByHook cleared)', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.REWARDED, 'stale-guard-unit', {
      bufferSize: 1,
      stalenessWindowMillis: 60_000,
    });
    await AdPools.create(config);

    let staleListener: (() => void) | undefined;
    const pooledMod = require('../src/internal/pooledFullscreenAd');
    const originalCreate = pooledMod.createPooledFullscreenAd;
    const createSpy = jest
      .spyOn(pooledMod, 'createPooledFullscreenAd')
      .mockImplementation((options: never) => {
        const ad = originalCreate(options);
        const realOnStale = ad.onStaleByPolicy.bind(ad);
        ad.onStaleByPolicy = (listener: () => void) => {
          staleListener = listener;
          return realOnStale(listener);
        };
        return ad;
      });

    (
      NativeGoogleMobileAdsPoolModule.poolGetAvailability as jest.Mock
    ).mockResolvedValueOnce({ available: true, observedCount: 1 });
    (NativeGoogleMobileAdsPoolModule.poolPoll as jest.Mock).mockResolvedValueOnce({
      filled: true,
      requestId: 701,
      responseId: 'guard-resp',
      responseInfo: { responseId: 'guard-resp' },
    });

    let pooledHook: ReturnType<typeof usePooledAd> | undefined;
    function Probe() {
      pooledHook = usePooledAd(config.poolId);
      return null;
    }
    render(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      const result = await pooledHook!.poll();
      expect(result.status).toBe('filled');
    });
    expect(staleListener).toBeDefined();

    let released: ReturnType<NonNullable<typeof pooledHook>['release']> = null;
    act(() => {
      released = pooledHook!.release();
    });
    expect(released).not.toBeNull();
    // Invoke captured listener after ownership released — hits early return.
    await act(async () => {
      staleListener!();
    });
    expect(pooledHook!.status).toBe('idle');
    released?.destroy();
    createSpy.mockRestore();
  });

  it('usePooledAd refreshes on available/exhausted; empty + supersede destroy', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'refresh-hook-unit', {
      bufferSize: 2,
      stalenessWindowMillis: 60_000,
    });
    const pool = await AdPools.create(config);
    const avail = NativeGoogleMobileAdsPoolModule.poolGetAvailability as jest.Mock;
    const pollNative = NativeGoogleMobileAdsPoolModule.poolPoll as jest.Mock;

    let pooledHook: ReturnType<typeof usePooledAd> | undefined;
    function Probe() {
      pooledHook = usePooledAd(config.poolId);
      return null;
    }
    render(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });

    avail.mockResolvedValueOnce({ available: true, observedCount: 2 });
    await act(async () => {
      SharedEventEmitter.emit(`google_mobile_ads_pool_event:${pool.poolId}:0`, {
        body: { type: 'available', data: { responseId: 'avail-1' } },
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(pooledHook!.available).toBe(true);
    expect(pooledHook!.observedCount).toBe(2);

    avail.mockResolvedValueOnce({ available: false, observedCount: 0 });
    await act(async () => {
      SharedEventEmitter.emit(`google_mobile_ads_pool_event:${pool.poolId}:0`, {
        body: { type: 'exhausted' },
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(pooledHook!.available).toBe(false);
    expect(pooledHook!.observedCount).toBe(0);

    let firstAd: Extract<
      Awaited<ReturnType<NonNullable<typeof pooledHook>['poll']>>,
      { status: 'filled' }
    >['ad'] | null = null;

    // getAvailability + poolPoll for fill, then refreshAvailability after poll.
    avail
      .mockResolvedValueOnce({ available: true, observedCount: 2 })
      .mockResolvedValueOnce({ available: true, observedCount: 1 });
    pollNative.mockResolvedValueOnce({
      filled: true,
      requestId: 601,
      responseId: 'first',
      responseInfo: { responseId: 'first' },
    });

    await act(async () => {
      const first = await pooledHook!.poll();
      expect(first.status).toBe('filled');
      if (first.status === 'filled') {
        firstAd = first.ad;
      }
    });
    expect(firstAd).not.toBeNull();
    const destroySpy = jest.spyOn(firstAd!, 'destroy');

    avail
      .mockResolvedValueOnce({ available: true, observedCount: 1 })
      .mockResolvedValueOnce({ available: true, observedCount: 0 });
    pollNative.mockResolvedValueOnce({
      filled: true,
      requestId: 602,
      responseId: 'second',
      responseInfo: { responseId: 'second' },
    });

    await act(async () => {
      const second = await pooledHook!.poll();
      expect(second.status).toBe('filled');
    });
    expect(destroySpy).toHaveBeenCalled();
    expect(pooledHook!.status).toBe('filled');
    expect(pooledHook!.ad).not.toBe(firstAd);

    avail
      .mockResolvedValueOnce({ available: false, observedCount: 0 })
      .mockResolvedValueOnce({ available: false, observedCount: 0 });
    await act(async () => {
      const empty = await pooledHook!.poll();
      expect(empty.status).toBe('empty');
    });
    expect(pooledHook!.status).toBe('empty');
  });

  it('registry: filled:false after available, idempotent destroy, register-replace', async () => {
    const pool = await AdPools.create(
      AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'registry-arms', { bufferSize: 1 }),
    );
    const avail = NativeGoogleMobileAdsPoolModule.poolGetAvailability as jest.Mock;
    const pollNative = NativeGoogleMobileAdsPoolModule.poolPoll as jest.Mock;

    // Force the race arm: availability says yes, native poll returns unfilled.
    avail.mockImplementationOnce(async () => ({ available: true, observedCount: 1 }));
    pollNative.mockImplementationOnce(async () => ({ filled: false }));
    await expect(pool.poll()).resolves.toMatchObject({ status: 'empty' });

    pool.destroy();
    expect(() => pool.destroy()).not.toThrow();

    const resolved = validateAdPoolConfig(
      AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'replace-registry', { bufferSize: 1 }),
    );
    const first = new SdkManagedAdPool(resolved);
    registerAdPool(first);
    const second = new SdkManagedAdPool(resolved);
    const firstDestroy = jest.spyOn(first, 'destroy');
    registerAdPool(second);
    expect(firstDestroy).toHaveBeenCalled();
    expect(AdPools.get(resolved.poolId)).toBe(second);
    second.destroy();
  });

  it('useAdPool retry no-op when absent; error arm when create rejects', async () => {
    let poolHook: ReturnType<typeof useAdPool> | undefined;
    function Absent() {
      poolHook = useAdPool('never-created');
      return null;
    }
    render(<Absent />);
    expect(poolHook!.status).toBe('absent');
    act(() => {
      poolHook!.retry();
    });
    expect(poolHook!.status).toBe('absent');

    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'retry-err', {
      bufferSize: 1,
    });
    await AdPools.create(config);
    function Ready() {
      poolHook = useAdPool(config.poolId);
      return null;
    }
    render(<Ready />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(poolHook!.status).toBe('ready');

    const createSpy = jest.spyOn(AdPools, 'create').mockRejectedValueOnce({
      reason: 'internal-error',
      message: 'boom',
    } as never);
    await act(async () => {
      poolHook!.retry();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(poolHook!.status).toBe('error');
    createSpy.mockRestore();
  });
});
