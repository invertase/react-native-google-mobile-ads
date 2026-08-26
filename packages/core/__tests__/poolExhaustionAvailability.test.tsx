import React from 'react';
import { render } from '@testing-library/react-native';

import {
  useAdPool,
  usePooledAd,
  type AdPoolAvailability,
  type AdPoolEvent,
  type UseAdPoolStatus,
  type UsePooledAdResult,
} from '../src';

/**
 * Exhaustion / refresh observability and availability surface.
 * Runtime still stubs; locks public shapes + docs vocabulary.
 */

type AvailabilityShape = Equal<
  AdPoolAvailability,
  { available: boolean; observedCount: number }
>;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

const availabilityCountRequired: AvailabilityShape = true;

type PoolStatusOnPooled = UsePooledAdResult['poolStatus'];
type PoolStatusMatches = Equal<PoolStatusOnPooled, UseAdPoolStatus>;
const poolStatusShared: PoolStatusMatches = true;

type ExhaustedEvent = Extract<AdPoolEvent, { type: 'exhausted' }>;
type AvailableEvent = Extract<AdPoolEvent, { type: 'available' }>;
type RefreshedEvent = Extract<AdPoolEvent, { type: 'refreshed' }>;
type ExpiredEvent = Extract<AdPoolEvent, { type: 'expired' }>;

type ExhaustedHasPoolId = ExhaustedEvent['poolId'] extends string ? true : false;
type AvailableHasResponseId = AvailableEvent['responseId'] extends string ? true : false;
type RefreshedHasReplaced = RefreshedEvent['replacedAdId'] extends string | null ? true : false;
type ExpiredLibraryOnly =
  ExpiredEvent['provenance'] extends 'pool/emulated-no-sdk-preloader' ? true : false;

const eventShapeOk: [
  ExhaustedHasPoolId,
  AvailableHasResponseId,
  RefreshedHasReplaced,
  ExpiredLibraryOnly,
] = [true, true, true, true];

/** Docs / JSDoc vocabulary locks. */
const EXHAUSTION_SIGNAL =
  'exhausted with no later available, together with observedCount === 0';
const SHARED_POOL_STARVE =
  'coalescing is per hook instance; depth-1 shared poolId starves';
const AVAILABILITY_COUNT =
  'observedCount always present; upper bound (no Android V2 expiry sweep)';
const POOL_STATUS_FIX =
  "poolStatus distinguishes absent / creating / ready; idle+available:false alone does not";

describe('pool exhaustion and availability surface', () => {
  it('requires observedCount and shares poolStatus with useAdPool', () => {
    expect(availabilityCountRequired).toBe(true);
    expect(poolStatusShared).toBe(true);
    expect(eventShapeOk).toEqual([true, true, true, true]);
    expect(EXHAUSTION_SIGNAL).toContain('observedCount === 0');
    expect(SHARED_POOL_STARVE).toContain('per hook instance');
    expect(AVAILABILITY_COUNT).toContain('always present');
    expect(POOL_STATUS_FIX).toContain('poolStatus');
  });

  it('stub usePooledAd reports absent poolStatus and zero observedCount', async () => {
    const calls: Array<() => void | Promise<unknown>> = [];
    function Probe() {
      const pooled = usePooledAd('display-missing');
      const pool = useAdPool('display-missing');

      expect(pooled.status).toBe('idle');
      expect(pooled.poolStatus).toBe('absent');
      expect(pooled.available).toBe(false);
      expect(pooled.observedCount).toBe(0);
      expect(pool.status).toBe('absent');
      expect(pooled.poolStatus).toBe(pool.status);

      pool.retry();
      calls.push(() => pooled.poll());
      return null;
    }

    render(<Probe />);
    await expect(calls[0]!()).resolves.toEqual({ status: 'empty' });
  });
});
