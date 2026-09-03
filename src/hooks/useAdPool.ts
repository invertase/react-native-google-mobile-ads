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

import type { AdPool } from '../types/AdPool';
import type { AdError } from '../types/AdError';

/** Members present on every arm, so they are callable without narrowing. */
type UseAdPoolResultBase = {
  /**
   * Re-attempts `AdPools.create` for this `poolId` using the config the
   * provider (or the imperative caller) already holds, and moves the result
   * back through `creating`.
   *
   * `status: 'error'` would otherwise be terminal, since pool creation is
   * provider-owned and the consumer has no config to create from, yet ad loads
   * fail transiently all the time. This is the recovery affordance.
   *
   * A no-op while a create is already in flight, and a no-op when `status` is
   * `absent`: there is no config to retry with, so fix the provider instead.
   *
   * Keeps the same identity for the life of the hook instance, so it is safe
   * in a dependency array and safe to pass straight to a press handler.
   * `poolId` is sampled when `retry` runs (ref updated each render); a new
   * string on a later render does not change `retry`'s identity.
   */
  retry: () => void;
};

/**
 * Pool lookup state.
 *
 * A discriminated union rather than `ready` + `degraded` booleans: those two
 * are different axes, so their combinations included an unreachable state
 * (degradation is only knowable once `create()` has resolved) while omitting
 * the states an async `create()` actually produces.
 *
 * `absent` is distinct from `creating` on purpose. Looking up a `poolId` no
 * provider registered is a common misconfiguration that would otherwise be
 * indistinguishable from a slow create, forever.
 *
 * Degrade reasons are not mirrored here: read `pool.resolved.degradeReasons`,
 * which is the single source of truth.
 */
export type UseAdPoolResult = UseAdPoolResultBase &
  (
    | { status: 'creating'; pool: null; error: null }
    | { status: 'ready'; pool: AdPool; error: null }
    | { status: 'ready-degraded'; pool: AdPool; error: null }
    | { status: 'error'; pool: null; error: AdError }
    /** No pool is registered for this `poolId`. */
    | { status: 'absent'; pool: null; error: null }
  );

/**
 * Status discriminant for `useAdPool`. Derived from `UseAdPoolResult` so the
 * string union cannot drift from the result arms. Also the type of
 * `usePooledAd(...).poolStatus`.
 */
export type UseAdPoolStatus = UseAdPoolResult['status'];

/**
 * Read a pool created by AdPoolProvider or AdPools.create.
 * Stub: always `absent`, since no pool can be created yet. `retry` keeps a
 * stable identity for the life of the hook instance.
 */
export function useAdPool(poolId: string): UseAdPoolResult {
  const poolIdRef = useRef(poolId);
  poolIdRef.current = poolId;

  const retry = useCallback(() => {
    void poolIdRef.current;
  }, []);

  return {
    status: 'absent',
    pool: null,
    error: null,
    retry,
  };
}
