/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { useCallback, useRef } from 'react';

import type { PollResult, PooledAd } from '../types/AdPool';
import type { AdError } from '../types/AdError';
import type { UseAdPoolStatus } from './useAdPool';

/**
 * Members present on every arm, so they are callable without narrowing.
 *
 * `poll` and `release` keep the same identity for the life of the hook
 * instance, so listing them in a dependency array does not re-run the effect
 * or callback that depends on them. `poolId` is sampled when `poll` runs (ref
 * updated each render): a new string on a later render does not change `poll`'s
 * identity. See the v17 reference "Callback identity and argument freshness".
 */
type UsePooledAdResultBase = {
  /**
   * Pool lookup status for this `poolId`, same vocabulary as `useAdPool`
   * (`absent` / `creating` / `ready` / `ready-degraded` / `error`).
   *
   * Distinguishes an absent pool from a warming one from a ready pool that
   * has never been polled, without pairing a second hook. `status: 'idle'`
   * with `available: false` alone cannot make that distinction.
   *
   * Still call `useAdPool` when you need the `AdPool` object, `retry()`, or
   * `resolved.degradeReasons` — those are not mirrored here.
   */
  poolStatus: UseAdPoolStatus;
  /**
   * Whether the pool reports inventory ready to poll right now.
   * Equivalent to `observedCount > 0`.
   *
   * Event-driven: updated from the pool's own events and after each poll
   * settles. There is no polling loop and no timer, so this is live without
   * costing a render per interval.
   *
   * Derives from SDK / library availability signals that do not sweep for
   * expiry on Android V2, so it is an upper bound (iOS sweep UNKNOWN).
   */
  available: boolean;
  /**
   * Observed buffer depth for this pool. Always a number (not optional): both
   * classic platforms expose a count for SDK-managed preloaders
   * (`getNumAdsAvailable` / `numberOfAdsAvailableWithPreloadID:`), and
   * library-managed pools know their own buffer depth.
   *
   * Same event-driven update path as `available`. Upper bound: no expiry
   * sweep on Android V2; iOS sweep UNKNOWN. See `AdPool.getAvailability()`.
   */
  observedCount: number;
  /**
   * Triggers a poll and updates hook state. Never rejects: it resolves into
   * the same `PollResult` the state reflects, so the return value is optional
   * convenience for callers that want to poll and show in one handler.
   *
   * Concurrent calls coalesce onto the in-flight poll, so a double tap — or
   * React StrictMode in development double-invoking an effect that calls
   * `poll()` — cannot burn two ads. Coalescing is **per hook instance**: two
   * components that both call `usePooledAd(samePoolId)` do not share an
   * in-flight poll. On a depth-1 pool one placement reliably starves the
   * other — give each placement its own pool, or make a single owner poll and
   * pass the ad down. Joiners share the promise started with the `poolId`
   * current when the flight began; after it settles, the next call samples
   * the latest `poolId`. Never call during render: polling consumes inventory.
   *
   * A `filled` result is not a freshness guarantee; check `isStaleByPolicy()`
   * when the placement requires it.
   */
  poll: () => Promise<PollResult>;
  /**
   * Hands ownership of the current ad to the caller and clears hook state to
   * `{ status: 'idle', ad: null, error: null }` (among the current result
   * arms), so unmount cleanup will not destroy an ad someone else now owns.
   * Returns `null` when there is nothing held.
   *
   * After `release()`, the caller owns both `destroy()` and the staleness
   * check: the policy timer lives on the ad, not on the pool or the hook. Pool
   * `destroy()` does not stop that timer either; it is handle-owned for the
   * ad's lifetime.
   *
   * Call `release()` before you `destroy()` or otherwise take over lifecycle.
   * While this hook still owns the ad, do not call `ad.destroy()`: that leaves
   * the hook able to report `filled` with a dead ad (same ownership rule as
   * the inner `NativeAd` on a native arm). Post-show event observation
   * (`OPENED`, `CLOSED`, `PAID`, `EARNED_REWARD`) also requires this path:
   * hook-owned consumption destroys the spent ad when `show()` settles and
   * drops listeners (see the `'consumed'` arm).
   *
   * Ordering is guaranteed: calling `release()` immediately after `await
   * poll()` returns the ad that poll just produced, without waiting for a
   * render. The implementation therefore tracks the current ad in a ref
   * alongside state, and `release()` reads the ref.
   */
  release: () => PooledAd | null;
};

/**
 * Poll-on-demand hook state, discriminated on `status`.
 *
 * Narrowing is intentional and asymmetric with a flat `{ status, ad, error }`
 * object: `{ status: 'filled', ad: null }` and `{ status: 'error', error: null }`
 * do not type-check. Terminal arms mirror `PollResult`; `idle`, `polling`, and
 * `stale-by-policy` are hook-only.
 *
 * During `polling`, a previously held ad may still be present until the
 * in-flight poll settles and supersedes it. `stale-by-policy` keeps
 * already-rendered banner/native inventory in place and clears unrendered
 * inventory. `consumed` clears the spent fullscreen ad when `await ad.show()`
 * fulfills while the hook still owns it (not on `OPENED` / `CLOSED` /
 * `EARNED_REWARD`).
 *
 * Status words follow the pool/poll vocabulary (`polling`, `filled`), not the
 * multi-format load vocabulary (`loading`, `loaded` / `loaded-partial`). See
 * `UseMultiFormatAdStatus`.
 *
 * `empty`, `timeout`, `stale-by-policy`, and `consumed` are not errors: the
 * pool is still refilling, the held ad crossed the publisher's configured
 * window, or a fullscreen ad was shown and is spent.
 *
 * **Ownership:** while this hook holds an ad, do not call `ad.destroy()`.
 * Destroying hook-owned inventory leaves the hook able to report `filled`
 * with a dead ad and, after a hook-owned `show()`, prevents observing
 * post-show events because `destroy()` drops listeners. Call `release()`
 * first if you need to own destruction or post-show observation, or leave
 * destruction to the hook (unmount, superseding poll, stale unrendered
 * eviction, or post-`show()` consumption). The same rule as the inner
 * `NativeAd` on a native arm: one owner.
 */
export type UsePooledAdResult = UsePooledAdResultBase &
  (
    | { status: 'idle'; ad: null; error: null }
    | { status: 'polling'; ad: PooledAd | null; error: null }
    | { status: 'filled'; ad: PooledAd; error: null }
    | { status: 'empty'; ad: null; error: null }
    | { status: 'timeout'; ad: null; error: null }
    | { status: 'no-fill'; ad: null; error: AdError }
    | { status: 'error'; ad: null; error: AdError }
    /**
     * The held ad crossed the publisher's staleness window while the hook owned
     * it. Not an error: `error` stays `null`. Poll again for fresher inventory.
     *
     * Unrendered inventory is destroyed and `ad` cleared. Already-rendered
     * banner/native inventory is left in place (the impression was counted at
     * first pixel); `ad` remains until `release()` or unmount. A `false` from
     * `isStaleByPolicy()` before this status is not a validity certificate.
     */
    | { status: 'stale-by-policy'; ad: PooledAd | null; error: null }
    /**
     * A fullscreen ad the hook still owned was successfully shown and is
     * spent. **Milestone:** `await ad.show()` fulfills (the show promise
     * settles successfully). Not `OPENED`, `CLOSED`, or `EARNED_REWARD`.
     *
     * Not an error: `error` stays `null`. The hook destroys the spent ad and
     * clears `ad`, which drops listeners — so a hook-owned consume path cannot
     * observe post-show events. Use `release()` before `show()` when you need
     * `CLOSED` / reward / paid wiring. Poll again for the next impression.
     *
     * Rejected alternatives: `OPENED` (native show promises resolve without
     * waiting for it — Android `FullScreenAdModule.show` / iOS
     * `RNGoogleMobileAdsFullScreenAd` resolve after `present`/`show`);
     * `CLOSED` / `EARNED_REWARD` (classic `useFullScreenAd` /
     * `MobileAd` event lifecycle for observation, not the pool consume
     * signal — and waiting for them would contradict destroy-on-consume).
     *
     * A later `show()` on a reference you kept after `release()` fails with
     * reason `'ad-already-used'`; that reason is for the show attempt, not for
     * this status arm.
     */
    | { status: 'consumed'; ad: null; error: null }
  );

/**
 * Status discriminant for `usePooledAd`. Derived from `UsePooledAdResult` so
 * the string union cannot drift from the result arms.
 */
export type UsePooledAdStatus = UsePooledAdResult['status'];

/**
 * Poll-on-demand against a pool. Never polls during render.
 *
 * Stub: poll always resolves `{ status: 'empty' }`; pool lookup is `absent`.
 * Callback identity and per-instance coalescing match the documented contract
 * so `useEffect(() => { void poll(); }, [poll])` and StrictMode double-invoke
 * behave as the reference describes.
 */
export function usePooledAd(poolId: string): UsePooledAdResult {
  const poolIdRef = useRef(poolId);
  poolIdRef.current = poolId;

  const inflightRef = useRef<Promise<PollResult> | null>(null);

  const poll = useCallback((): Promise<PollResult> => {
    void poolIdRef.current;
    if (inflightRef.current) {
      return inflightRef.current;
    }
    const result: PollResult = { status: 'empty' };
    const flight = Promise.resolve(result).finally(() => {
      inflightRef.current = null;
    }) as Promise<PollResult>;
    inflightRef.current = flight;
    return flight;
  }, []);

  const release = useCallback((): PooledAd | null => null, []);

  return {
    status: 'idle',
    ad: null,
    error: null,
    poolStatus: 'absent',
    available: false,
    observedCount: 0,
    poll,
    release,
  };
}
