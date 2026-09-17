import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdFormat,
  AdPoolPresets,
  AdPools,
  useMultiFormatAd,
  usePooledAd,
  type UseMultiFormatAdStatus,
  type UsePooledAdResult,
  type UsePooledAdStatus,
} from '../src';
import { destroyAllAdPools } from '../src/internal/adPoolRegistry';

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
