import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdEventType,
  AdFormat,
  AdPoolPresets,
  AdStalenessGuidanceMillis,
  MultiFormatAdPresets,
  useMultiFormatAd,
  usePooledAd,
  type AdEventPayload,
  type AdPoolAvailability,
  type AdPoolProviderProps,
  type PaidEvent,
  type UseAdPoolResult,
  type UseAdPoolStatus,
  type UseMultiFormatAdResult,
  type UseMultiFormatAdStatus,
  type UsePooledAdResult,
  type UsePooledAdStatus,
} from '../src';

/**
 * Runtime companions for the compile-time locks in
 * `type-test.ts` / `type-test.tsx` (`yarn tsc:compile`).
 *
 * Exact guidance millis and preset requestCount/adServer values are asserted
 * here because barrel `typeof` probes widen `as const` number literals.
 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

type PaidPayloadLock = Equal<AdEventPayload<AdEventType.PAID>, PaidEvent>;
type AvailabilityLock = Equal<AdPoolAvailability, { available: boolean; observedCount: number }>;
type PooledStatusLock = Equal<UsePooledAdStatus, UsePooledAdResult['status']>;
type MultiStatusLock = Equal<UseMultiFormatAdStatus, UseMultiFormatAdResult['status']>;
type AdPoolStatusLock = Equal<UseAdPoolStatus, UseAdPoolResult['status']>;

const paidPayloadLock: PaidPayloadLock = true;
const availabilityLock: AvailabilityLock = true;
const statusLocks: [PooledStatusLock, MultiStatusLock, AdPoolStatusLock] = [true, true, true];

type BarrelTypesAlive = [
  AdPoolProviderProps['pools'],
  UseAdPoolResult['status'],
  UseAdPoolStatus,
  UseMultiFormatAdResult['status'],
  UseMultiFormatAdStatus,
  UsePooledAdResult['status'],
  UsePooledAdStatus,
];
const barrelTypesAlive: BarrelTypesAlive = [
  [],
  'absent',
  'absent',
  'idle',
  'idle',
  'idle',
  'idle',
];

describe('type contract locks', () => {
  it('keeps guidance millis, nativeOrBanner literals, and barrel aliases live', () => {
    expect(paidPayloadLock).toBe(true);
    expect(availabilityLock).toBe(true);
    expect(statusLocks).toEqual([true, true, true]);
    expect(barrelTypesAlive[0]).toEqual([]);

    expect(AdStalenessGuidanceMillis.APP_OPEN).toBe(4 * 60 * 60 * 1000);
    expect(AdStalenessGuidanceMillis.OTHER).toBe(60 * 60 * 1000);

    const nativeOrBanner = MultiFormatAdPresets.nativeOrBanner([]);
    expect(nativeOrBanner.requestCount).toBe(1);
    expect(nativeOrBanner.adServer).toBe('ad-manager');
    expect(nativeOrBanner.formats).toEqual([AdFormat.NATIVE, AdFormat.BANNER]);

    const display = AdPoolPresets.display('unit-a');
    expect(display.poolId).toBe('display-unit-a');
  });

  it('exposes consumed on the pooled status union and idle stub fields', async () => {
    const consumed: UsePooledAdStatus = 'consumed';
    expect(consumed).toBe('consumed');

    let pooled: ReturnType<typeof usePooledAd> | undefined;
    let multi: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe() {
      pooled = usePooledAd('display-pool');
      multi = useMultiFormatAd({
        adUnitId: 'unit',
        requestOptions: { formats: [AdFormat.BANNER] },
        autoLoad: false,
      });
      return null;
    }

    render(<Probe />);
    expect(pooled!.status).toBe('idle');
    expect(pooled!.observedCount).toBe(0);
    expect(pooled!.available).toBe(false);
    expect(multi!.status).toBe('idle');

    await expect(pooled!.poll()).resolves.toEqual({ status: 'empty' });
    await act(async () => {
      await expect(multi!.load()).resolves.toEqual({
        status: 'no-fill',
        ads: [],
        errors: [],
        responseInfo: null,
      });
    });
    expect(multi!.status).toBe('no-fill');
  });
});
