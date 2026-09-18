import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdFormat,
  AdPoolPresets,
  AdPools,
  BannerAdSize,
  useAdPool,
  useMultiFormatAd,
  usePooledAd,
  type PollResult,
  type PooledAd,
  type UseMultiFormatAdStatus,
  type UsePooledAdResult,
  type UsePooledAdStatus,
} from '../src';
import { destroyAllAdPools } from '../src/internal/adPoolRegistry';
import NativeGoogleMobileAdsPoolModule from '../src/specs/modules/NativeGoogleMobileAdsPoolModule';

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function filledResult(): { result: PollResult; ad: PooledAd; destroy: jest.Mock } {
  const destroy = jest.fn();
  const ad = { destroy } as unknown as PooledAd;
  return { result: { status: 'filled', ad }, ad, destroy };
}

function controlledDisplayAd() {
  let staleListener!: () => void;
  const destroy = jest.fn();
  const unsubscribe = jest.fn();
  const ad = {
    format: AdFormat.BANNER,
    destroy,
    onStaleByPolicy: jest.fn((listener: () => void) => {
      staleListener = listener;
      return unsubscribe;
    }),
  } as unknown as PooledAd;
  return {
    ad,
    destroy,
    unsubscribe,
    emitQueuedStale: () => staleListener(),
  };
}

function controlledFullscreenAd(showResult: Promise<void>) {
  const destroy = jest.fn();
  const unsubscribe = jest.fn();
  const innerShow = jest.fn(() => showResult);
  const ad = {
    format: AdFormat.INTERSTITIAL,
    destroy,
    show: innerShow,
    onStaleByPolicy: jest.fn(() => unsubscribe),
  } as unknown as PooledAd;
  return { ad, destroy, unsubscribe, innerShow };
}

/**
 * Ownership/consumption contract locks (runtime stubs + compile-time status shape).
 * Full ownership/consumed transitions need native wiring; this locks the
 * public status vocabulary and that stubs stay honest.
 *
 * Consumed milestone (docs + JSDoc): `await ad.show()` fulfills — not OPENED /
 * CLOSED / EARNED_REWARD. release() clears to status 'idle' among current arms.
 */
type ConsumedArm = Extract<UsePooledAdResult, { status: 'consumed' }>;
type ConsumedHasNullAd = ConsumedArm['ad'] extends null ? true : false;
type ConsumedHasNullError = ConsumedArm['error'] extends null ? true : false;
const consumedShapeOk: [ConsumedHasNullAd, ConsumedHasNullError] = [true, true];

type ConsumedNotOnMulti = Extract<UseMultiFormatAdStatus, 'consumed'> extends never ? true : false;
const consumedPoolOnly: ConsumedNotOnMulti = true;

/** Frozen prose lock for AX4-R1 / AX4-R2 — mirrors public contract wording. */
const CONSUMED_MILESTONE =
  'await ad.show() fulfills (show-promise settle); not OPENED/CLOSED/EARNED_REWARD';
const RELEASE_LEAVES_IDLE = "release() leaves status: 'idle' among current arms";

const pooledStatuses: UsePooledAdStatus[] = [
  'idle',
  'polling',
  'filled',
  'empty',
  'timeout',
  'no-fill',
  'error',
  'stale-by-policy',
  'consumed',
];

describe('ownership and consumption lifecycle', () => {
  it('exposes consumed as a pooled hook-only non-error status', () => {
    expect(consumedShapeOk).toEqual([true, true]);
    expect(consumedPoolOnly).toBe(true);
    expect(pooledStatuses).toContain('consumed');
    expect(pooledStatuses).not.toContain('loading');
    expect(CONSUMED_MILESTONE).toContain('show-promise settle');
    expect(CONSUMED_MILESTONE).not.toMatch(/OPENED.*milestone|CLOSED.*milestone/);
    expect(RELEASE_LEAVES_IDLE).toContain("status: 'idle'");
  });

  it('keeps stub hooks idle without inventing filled/loaded ownership', async () => {
    let pooled: ReturnType<typeof usePooledAd> | undefined;
    let multi: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe() {
      pooled = usePooledAd('fullscreen-pool');
      multi = useMultiFormatAd({
        adUnitId: 'unit',
        requestOptions: { formats: [AdFormat.NATIVE] },
        autoLoad: false,
      });
      return null;
    }

    render(<Probe />);
    expect(pooled!.status).toBe('idle');
    expect(pooled!.ad).toBeNull();
    expect(pooled!.error).toBeNull();
    expect(multi!.status).toBe('idle');
    expect(multi!.ads).toEqual([]);

    await expect(pooled!.poll()).resolves.toEqual({ status: 'empty' });
    expect(pooled!.release()).toBeNull();
    await act(async () => {
      await expect(multi!.load()).resolves.toEqual({
        status: 'no-fill',
        ads: [],
        errors: [],
        responseInfo: null,
      });
    });
    expect(multi!.status).toBe('no-fill');
    act(() => {
      expect(multi!.release()).toEqual([]);
    });
  });
});

describe('usePooledAd poolId change', () => {
  afterEach(() => {
    // Registry notify updates mounted hooks; keep teardown inside act.
    act(() => {
      destroyAllAdPools();
    });
    jest.clearAllMocks();
  });

  /** Mounts one hook on pool A, fills it, and exposes the switch to pool B. */
  async function fillFromPoolA() {
    const configA = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'switch-unit-a', {
      bufferSize: 1,
      stalenessWindowMillis: 60_000,
    });
    const configB = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'switch-unit-b', {
      bufferSize: 1,
      stalenessWindowMillis: 60_000,
    });
    await AdPools.create(configA);
    await AdPools.create(configB);

    let pooled: UsePooledAdResult | undefined;
    function Probe({ poolId }: { poolId: string }) {
      pooled = usePooledAd(poolId);
      return null;
    }
    const { rerender, unmount } = render(<Probe poolId={configA.poolId} />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      const result = await pooled!.poll();
      expect(result.status).toBe('filled');
    });
    expect(pooled!.status).toBe('filled');
    expect(pooled!.ad).not.toBeNull();

    return {
      read: () => pooled!,
      unmount,
      switchToPoolB: async () => {
        await act(async () => {
          rerender(<Probe poolId={configB.poolId} />);
          await Promise.resolve();
        });
      },
    };
  }

  it('destroys hook-owned inventory and reports the new pool as idle', async () => {
    const { read, switchToPoolB } = await fillFromPoolA();
    const adFromA = read().ad!;
    const destroySpy = jest.spyOn(adFromA, 'destroy');

    await switchToPoolB();

    // Once, not twice: the poolId cleanup replaced the unmount-only cleanup.
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(read().status).toBe('idle');
    expect(read().ad).toBeNull();
    expect(read().error).toBeNull();
    expect(read().poolStatus).toBe('ready');
  });

  it('leaves a released ad alive when poolId changes', async () => {
    const { read, switchToPoolB } = await fillFromPoolA();
    const releasedAd = read().ad!;
    const destroySpy = jest.spyOn(releasedAd, 'destroy');
    act(() => {
      expect(read().release()).toBe(releasedAd);
    });
    expect(read().status).toBe('idle');

    await switchToPoolB();

    // release() hands ownership to the publisher; the hook must not destroy it.
    expect(destroySpy).not.toHaveBeenCalled();
    expect(read().status).toBe('idle');
    expect(read().ad).toBeNull();
    releasedAd.destroy();
  });

  it('still destroys hook-owned inventory on unmount', async () => {
    const { read, unmount } = await fillFromPoolA();
    const adFromA = read().ad!;
    const destroySpy = jest.spyOn(adFromA, 'destroy');

    act(() => {
      unmount();
    });

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});

describe('usePooledAd release then show ownership', () => {
  afterEach(() => {
    act(() => {
      destroyAllAdPools();
    });
    jest.clearAllMocks();
  });

  it('keeps released show settlement isolated from later hook-owned inventory', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'released-show-settlement');
    const pool = await AdPools.create(config);
    const releasedShow = deferred<void>();
    const released = controlledFullscreenAd(releasedShow.promise);
    const current = controlledFullscreenAd(Promise.resolve());
    jest
      .spyOn(pool, 'poll')
      .mockResolvedValueOnce({ status: 'filled', ad: released.ad })
      .mockResolvedValueOnce({ status: 'filled', ad: current.ad });
    const availabilitySpy = jest.spyOn(pool, 'getAvailability');

    const renderedStatuses: UsePooledAdStatus[] = [];
    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      pooled = usePooledAd(config.poolId);
      renderedStatuses.push(pooled.status);
      return null;
    }

    render(<Probe />);
    await act(async () => {
      await Promise.resolve();
      await pooled!.poll();
    });
    expect(released.ad.show).not.toBe(released.innerShow);
    expect(released.innerShow).not.toHaveBeenCalled();

    let publisherAd: PooledAd | null = null;
    act(() => {
      publisherAd = pooled!.release();
    });
    expect(publisherAd).toBe(released.ad);
    expect(publisherAd!.show).not.toBe(released.innerShow);

    let releasedShowPromise!: Promise<void>;
    act(() => {
      releasedShowPromise = publisherAd!.show();
    });
    expect(released.innerShow).toHaveBeenCalledTimes(1);

    await act(async () => {
      await pooled!.poll();
    });
    expect(pooled).toMatchObject({ status: 'filled', ad: current.ad, error: null });
    expect(current.ad.show).not.toBe(current.innerShow);
    expect(current.unsubscribe).not.toHaveBeenCalled();
    const availabilityReadsBeforeSettlement = availabilitySpy.mock.calls.length;
    const settlementRenderStart = renderedStatuses.length;

    await act(async () => {
      releasedShow.resolve();
      await releasedShowPromise;
      await Promise.resolve();
    });

    expect(renderedStatuses.slice(settlementRenderStart)).not.toContain('consumed');
    expect(pooled).toMatchObject({ status: 'filled', ad: current.ad, error: null });
    expect(released.destroy).not.toHaveBeenCalled();
    expect(current.destroy).not.toHaveBeenCalled();
    expect(current.unsubscribe).not.toHaveBeenCalled();
    expect(released.innerShow).toHaveBeenCalledTimes(1);
    expect(availabilitySpy).toHaveBeenCalledTimes(availabilityReadsBeforeSettlement);

    publisherAd!.destroy();
    expect(released.destroy).toHaveBeenCalledTimes(1);
    expect(current.destroy).not.toHaveBeenCalled();
    expect(current.unsubscribe).not.toHaveBeenCalled();
  });
});

describe('async hook teardown guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      destroyAllAdPools();
    });
    jest.restoreAllMocks();
  });

  it('abandons a retry pool that resolves after the hook unmounts', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'late-retry');
    await AdPools.create(config);

    let poolHook: ReturnType<typeof useAdPool> | undefined;
    function Probe() {
      poolHook = useAdPool(config.poolId);
      return null;
    }

    const view = render(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });

    const start = deferred<{ started: boolean; effectiveBufferSize: number }>();
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockReturnValueOnce(start.promise);
    act(() => {
      poolHook!.retry();
    });

    view.unmount();
    const generation = (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mock.calls.at(-1)[2];
    await act(async () => {
      start.resolve({ started: true, effectiveBufferSize: 1 });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(AdPools.get(config.poolId)).toBeNull();
    expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.INTERSTITIAL,
      generation,
    );
  });

  it('ignores retry rejection after unmount without mutating the empty registry', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'late-retry-rejection');
    await AdPools.create(config);
    const start = deferred<{ started: boolean; effectiveBufferSize: number }>();
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockReturnValueOnce(start.promise);

    let retry!: () => void;
    function Probe() {
      const pool = useAdPool(config.poolId);
      retry = pool.retry;
      return null;
    }

    const view = render(<Probe />);
    act(() => {
      retry();
    });
    await act(async () => {
      await Promise.resolve();
    });
    view.unmount();
    await act(async () => {
      start.reject(new Error('late retry failure'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(AdPools.get(config.poolId)).toBeNull();
  });

  it('does not let a superseded stale retry destroy the later generation winner', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'retry-overlap');
    await AdPools.create(config);
    const staleStart = deferred<{ started: boolean; effectiveBufferSize: number }>();
    const winnerStart = deferred<{ started: boolean; effectiveBufferSize: number }>();
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock)
      .mockReturnValueOnce(staleStart.promise)
      .mockReturnValueOnce(winnerStart.promise);

    let retry!: () => void;
    function Probe() {
      retry = useAdPool(config.poolId).retry;
      return null;
    }

    const view = render(<Probe />);
    act(() => {
      retry();
    });
    await act(async () => {
      await Promise.resolve();
    });
    view.unmount();

    const winnerPromise = AdPools.create(config);
    await Promise.resolve();
    winnerStart.resolve({ started: true, effectiveBufferSize: 1 });
    const winner = await winnerPromise;
    await Promise.resolve();

    expect(AdPools.get(config.poolId)).toBe(winner);
    staleStart.resolve({ started: true, effectiveBufferSize: 1 });
    await Promise.resolve();
    expect(AdPools.get(config.poolId)).toBe(winner);
  });

  it('scopes retry coalescing and settlement to the sampled poolId', async () => {
    const configA = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'retry-scope-a');
    const configB = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'retry-scope-b');
    await AdPools.create(configA);
    await AdPools.create(configB);
    const startA = deferred<{ started: boolean; effectiveBufferSize: number }>();
    const startB = deferred<{ started: boolean; effectiveBufferSize: number }>();
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock)
      .mockReturnValueOnce(startA.promise)
      .mockReturnValueOnce(startB.promise);

    let poolHook: ReturnType<typeof useAdPool> | undefined;
    function Probe({ poolId }: { poolId: string }) {
      poolHook = useAdPool(poolId);
      return null;
    }

    const view = render(<Probe poolId={configA.poolId} />);
    act(() => {
      poolHook!.retry();
      poolHook!.retry();
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      view.rerender(<Probe poolId={configB.poolId} />);
      await Promise.resolve();
    });
    act(() => {
      poolHook!.retry();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(NativeGoogleMobileAdsPoolModule.poolStart).toHaveBeenCalledTimes(4);

    await act(async () => {
      startB.resolve({ started: true, effectiveBufferSize: 1 });
      await Promise.resolve();
      await Promise.resolve();
    });
    const winnerB = AdPools.get(configB.poolId);
    expect(poolHook!.status).toBe('ready');
    expect(poolHook!.pool).toBe(winnerB);

    await act(async () => {
      startA.resolve({ started: true, effectiveBufferSize: 1 });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(AdPools.get(configA.poolId)).toBeNull();
    expect(AdPools.get(configB.poolId)).toBe(winnerB);
    expect(poolHook!.pool).toBe(winnerB);
  });

  it('publishes ready-degraded when a mounted display retry succeeds', async () => {
    const config = AdPoolPresets.display('/123/retry-degraded', {
      bannerSizes: [BannerAdSize.BANNER],
    });
    await AdPools.create(config);
    let poolHook: ReturnType<typeof useAdPool> | undefined;
    function Probe() {
      poolHook = useAdPool(config.poolId);
      return null;
    }

    render(<Probe />);
    expect(poolHook!.status).toBe('ready-degraded');
    await act(async () => {
      poolHook!.retry();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(poolHook!.status).toBe('ready-degraded');
    expect(poolHook!.pool).toBe(AdPools.get(config.poolId));
  });

  it('destroys a filled poll result that resolves after unmount without publishing it', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'late-poll-unmount');
    const pool = await AdPools.create(config);
    const pending = deferred<PollResult>();
    jest.spyOn(pool, 'poll').mockReturnValueOnce(pending.promise);
    const filled = filledResult();

    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      pooled = usePooledAd(config.poolId);
      return null;
    }

    const view = render(<Probe />);
    let pollPromise!: Promise<PollResult>;
    act(() => {
      pollPromise = pooled!.poll();
    });
    expect(pooled!.status).toBe('polling');

    view.unmount();
    await act(async () => {
      pending.resolve(filled.result);
      await expect(pollPromise).resolves.toEqual({ status: 'empty' });
    });

    expect(filled.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys an old-pool filled result when poolId changes before poll resolution', async () => {
    const configA = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'late-poll-a');
    const configB = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'late-poll-b');
    const poolA = await AdPools.create(configA);
    await AdPools.create(configB);
    const pending = deferred<PollResult>();
    jest.spyOn(poolA, 'poll').mockReturnValueOnce(pending.promise);
    const filled = filledResult();

    const renders: Array<{ poolId: string; status: UsePooledAdStatus }> = [];
    let pooled: UsePooledAdResult | undefined;
    function Probe({ poolId }: { poolId: string }) {
      pooled = usePooledAd(poolId);
      renders.push({ poolId, status: pooled.status });
      return null;
    }

    const view = render(<Probe poolId={configA.poolId} />);
    let pollPromise!: Promise<PollResult>;
    act(() => {
      pollPromise = pooled!.poll();
    });
    expect(pooled!.status).toBe('polling');

    await act(async () => {
      view.rerender(<Probe poolId={configB.poolId} />);
      await Promise.resolve();
    });
    await act(async () => {
      pending.resolve(filled.result);
      await expect(pollPromise).resolves.toEqual({ status: 'empty' });
    });

    expect(filled.destroy).toHaveBeenCalledTimes(1);
    expect(pooled!.status).toBe('idle');
    expect(pooled!.ad).toBeNull();
    expect(renders.filter(rendered => rendered.poolId === configB.poolId)).not.toContainEqual(
      expect.objectContaining({ status: 'filled' }),
    );
  });

  it.each(['unmount', 'poolId change'] as const)(
    'does not publish a non-filled poll result after %s',
    async transition => {
      const configA = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, `non-filled-${transition}-a`);
      const configB = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, `non-filled-${transition}-b`);
      const poolA = await AdPools.create(configA);
      if (transition === 'poolId change') {
        await AdPools.create(configB);
      }
      const pending = deferred<PollResult>();
      jest.spyOn(poolA, 'poll').mockReturnValueOnce(pending.promise);

      let pooled: UsePooledAdResult | undefined;
      function Probe({ poolId }: { poolId: string }) {
        pooled = usePooledAd(poolId);
        return null;
      }

      const view = render(<Probe poolId={configA.poolId} />);
      let pollPromise!: Promise<PollResult>;
      act(() => {
        pollPromise = pooled!.poll();
      });
      if (transition === 'unmount') {
        view.unmount();
      } else {
        await act(async () => {
          view.rerender(<Probe poolId={configB.poolId} />);
          await Promise.resolve();
        });
      }
      await act(async () => {
        pending.resolve({ status: 'timeout' });
        await expect(pollPromise).resolves.toEqual({ status: 'empty' });
      });

      if (transition === 'unmount') {
        expect(AdPools.get(configA.poolId)).toBe(poolA);
      } else {
        expect(pooled!.status).toBe('idle');
        expect(pooled!.ad).toBeNull();
      }
    },
  );

  it('returns empty without polling when poll is called after unmount', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'post-unmount-poll');
    const pool = await AdPools.create(config);
    const pollSpy = jest.spyOn(pool, 'poll');
    let poll!: () => Promise<PollResult>;
    function Probe() {
      poll = usePooledAd(config.poolId).poll;
      return null;
    }

    const view = render(<Probe />);
    view.unmount();

    const first = await poll();
    const second = await poll();
    expect(first).toEqual({ status: 'empty' });
    expect(second).toEqual({ status: 'empty' });
    expect(first).not.toBe(second);
    expect(pollSpy).not.toHaveBeenCalled();
  });

  it('swallows destroy failure while abandoning a stale filled poll result', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'stale-destroy-throws');
    const pool = await AdPools.create(config);
    const pending = deferred<PollResult>();
    jest.spyOn(pool, 'poll').mockReturnValueOnce(pending.promise);
    const destroy = jest.fn(() => {
      throw new Error('destroy failed');
    });
    const ad = { destroy } as unknown as PooledAd;
    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      pooled = usePooledAd(config.poolId);
      return null;
    }

    const view = render(<Probe />);
    let pollPromise!: Promise<PollResult>;
    act(() => {
      pollPromise = pooled!.poll();
    });
    view.unmount();
    pending.resolve({ status: 'filled', ad });

    await expect(pollPromise).resolves.toEqual({ status: 'empty' });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('ignores a queued stale callback after unmount cleanup', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'queued-stale-unmount');
    const pool = await AdPools.create(config);
    const controlled = controlledDisplayAd();
    jest.spyOn(pool, 'poll').mockResolvedValueOnce({ status: 'filled', ad: controlled.ad });
    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      pooled = usePooledAd(config.poolId);
      return null;
    }

    const view = render(<Probe />);
    await act(async () => {
      await expect(pooled!.poll()).resolves.toEqual({ status: 'filled', ad: controlled.ad });
    });
    expect(pooled!.status).toBe('filled');

    view.unmount();
    expect(controlled.destroy).toHaveBeenCalledTimes(1);
    expect(controlled.unsubscribe).toHaveBeenCalledTimes(1);
    expect(() => controlled.emitQueuedStale()).not.toThrow();
    expect(controlled.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not let an old-id queued stale callback mutate the current ad', async () => {
    const configA = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'queued-stale-a');
    const configB = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'queued-stale-b');
    const poolA = await AdPools.create(configA);
    const poolB = await AdPools.create(configB);
    const adA = controlledDisplayAd();
    const adB = controlledDisplayAd();
    jest.spyOn(poolA, 'poll').mockResolvedValueOnce({ status: 'filled', ad: adA.ad });
    jest.spyOn(poolB, 'poll').mockResolvedValueOnce({ status: 'filled', ad: adB.ad });
    let pooled: UsePooledAdResult | undefined;
    function Probe({ poolId }: { poolId: string }) {
      pooled = usePooledAd(poolId);
      return null;
    }

    const view = render(<Probe poolId={configA.poolId} />);
    await act(async () => {
      await pooled!.poll();
    });
    await act(async () => {
      view.rerender(<Probe poolId={configB.poolId} />);
      await Promise.resolve();
    });
    await act(async () => {
      await pooled!.poll();
    });
    expect(pooled!.ad).toBe(adB.ad);
    expect(adA.destroy).toHaveBeenCalledTimes(1);

    act(() => {
      adA.emitQueuedStale();
    });
    expect(pooled!.status).toBe('filled');
    expect(pooled!.ad).toBe(adB.ad);
    expect(adA.destroy).toHaveBeenCalledTimes(1);
    expect(adB.destroy).not.toHaveBeenCalled();
  });

  it.each(['unmount', 'poolId change'] as const)(
    'ignores late availability after %s',
    async transition => {
      const configA = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, `availability-${transition}-a`);
      const configB = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, `availability-${transition}-b`);
      const poolA = await AdPools.create(configA);
      if (transition === 'poolId change') {
        const poolB = await AdPools.create(configB);
        jest
          .spyOn(poolB, 'getAvailability')
          .mockResolvedValue({ available: false, observedCount: 0 });
      }
      const availability = deferred<{ available: boolean; observedCount: number }>();
      jest.spyOn(poolA, 'getAvailability').mockReturnValueOnce(availability.promise);
      let pooled: UsePooledAdResult | undefined;
      function Probe({ poolId }: { poolId: string }) {
        pooled = usePooledAd(poolId);
        return null;
      }

      const view = render(<Probe poolId={configA.poolId} />);
      if (transition === 'unmount') {
        view.unmount();
      } else {
        await act(async () => {
          view.rerender(<Probe poolId={configB.poolId} />);
          await Promise.resolve();
        });
      }
      await act(async () => {
        availability.resolve({ available: true, observedCount: 1 });
        await Promise.resolve();
      });

      if (transition === 'unmount') {
        expect(AdPools.get(configA.poolId)).toBe(poolA);
      } else {
        expect(pooled!.available).toBe(false);
        expect(pooled!.observedCount).toBe(0);
      }
    },
  );

  it('coalesces an in-flight retry across the StrictMode cleanup/remount cycle', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'strict-mode-remount');
    await AdPools.create(config);
    const start = deferred<{ started: boolean; effectiveBufferSize: number }>();
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockReturnValueOnce(start.promise);
    let poolHook: ReturnType<typeof useAdPool> | undefined;
    function Probe() {
      poolHook = useAdPool(config.poolId);
      React.useEffect(() => {
        poolHook!.retry();
      }, [poolHook!.retry]);
      return null;
    }

    render(
      <React.StrictMode>
        <Probe />
      </React.StrictMode>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(NativeGoogleMobileAdsPoolModule.poolStart).toHaveBeenCalledTimes(2);

    await act(async () => {
      start.resolve({ started: true, effectiveBufferSize: 1 });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(poolHook!.status).toBe('ready');
    expect(poolHook!.pool).toBe(AdPools.get(config.poolId));
  });
});
