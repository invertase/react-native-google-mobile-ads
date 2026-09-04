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

import { useCallback, useEffect, useRef, useState } from 'react';

import { getRegisteredAdPool, subscribeAdPoolRegistry } from '../internal/adPoolRegistry';
import type { AdError } from '../types/AdError';
import { AdFormat } from '../types/AdFormat';
import type { AdShowOptions } from '../types/AdShowOptions';
import type { PollResult, PooledAd } from '../types/AdPool';
import { useAdPool, type UseAdPoolStatus } from './useAdPool';

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
  poolStatus: UseAdPoolStatus;
  available: boolean;
  observedCount: number;
  poll: () => Promise<PollResult>;
  release: () => PooledAd | null;
};

/**
 * Poll-on-demand hook state, discriminated on `status`.
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
    | { status: 'stale-by-policy'; ad: PooledAd | null; error: null }
    | { status: 'consumed'; ad: null; error: null }
  );

export type UsePooledAdStatus = UsePooledAdResult['status'];

type HookState = {
  status: UsePooledAdStatus;
  ad: PooledAd | null;
  error: AdError | null;
  available: boolean;
  observedCount: number;
};

const initialState: HookState = {
  status: 'idle',
  ad: null,
  error: null,
  available: false,
  observedCount: 0,
};

function isDisplayPooledAd(ad: PooledAd): boolean {
  return ad.format === AdFormat.BANNER || ad.format === AdFormat.NATIVE;
}

/**
 * Poll-on-demand against a pool. Never polls during render.
 */
export function usePooledAd(poolId: string): UsePooledAdResult {
  const poolLookup = useAdPool(poolId);
  const poolIdRef = useRef(poolId);
  poolIdRef.current = poolId;

  const [state, setState] = useState<HookState>(initialState);
  const adRef = useRef<PooledAd | null>(null);
  const staleUnsubRef = useRef<(() => void) | null>(null);
  const inflightRef = useRef<Promise<PollResult> | null>(null);
  const ownedByHookRef = useRef(true);

  const clearStaleSub = () => {
    if (staleUnsubRef.current) {
      staleUnsubRef.current();
      staleUnsubRef.current = null;
    }
  };

  const destroyOwnedAd = () => {
    clearStaleSub();
    const ad = adRef.current;
    adRef.current = null;
    if (ad && ownedByHookRef.current) {
      try {
        ad.destroy();
      } catch {
        // ignore
      }
    }
  };

  const refreshAvailability = useCallback(async (id: string) => {
    const pool = getRegisteredAdPool(id);
    if (!pool) {
      setState(prev => ({ ...prev, available: false, observedCount: 0 }));
      return;
    }
    try {
      const availability = await pool.getAvailability();
      setState(prev => ({
        ...prev,
        available: availability.available,
        observedCount: availability.observedCount,
      }));
    } catch {
      // leave prior availability
    }
  }, []);

  useEffect(() => {
    return subscribeAdPoolRegistry(() => {
      void refreshAvailability(poolIdRef.current);
    });
  }, [refreshAvailability]);

  useEffect(() => {
    const pool = getRegisteredAdPool(poolId);
    if (!pool) {
      setState(prev => ({ ...prev, available: false, observedCount: 0 }));
      return;
    }
    void refreshAvailability(poolId);
    const unsub = pool.addListener(event => {
      if (
        event.type === 'available' ||
        event.type === 'exhausted' ||
        event.type === 'refreshed' ||
        event.type === 'expired'
      ) {
        void refreshAvailability(poolIdRef.current);
      }
    });
    return unsub;
  }, [poolId, refreshAvailability]);

  useEffect(() => {
    return () => {
      destroyOwnedAd();
    };
  }, []);

  const watchStale = (ad: PooledAd) => {
    clearStaleSub();
    staleUnsubRef.current = ad.onStaleByPolicy(() => {
      if (adRef.current !== ad || !ownedByHookRef.current) {
        return;
      }
      if (isDisplayPooledAd(ad)) {
        // Already-rendered display inventory stays put; fullscreen is destroyed.
        setState(prev => ({
          ...prev,
          status: 'stale-by-policy',
          ad,
          error: null,
        }));
        return;
      }
      try {
        ad.destroy();
      } catch {
        // ignore
      }
      adRef.current = null;
      clearStaleSub();
      setState(prev => ({
        ...prev,
        status: 'stale-by-policy',
        ad: null,
        error: null,
      }));
    });
  };

  const poll = useCallback((): Promise<PollResult> => {
    if (inflightRef.current) {
      return inflightRef.current;
    }
    const id = poolIdRef.current;
    const pool = getRegisteredAdPool(id);
    if (!pool) {
      const empty: PollResult = { status: 'empty' };
      const flight = Promise.resolve(empty).finally(() => {
        inflightRef.current = null;
      });
      inflightRef.current = flight;
      return flight;
    }

    setState(prev => ({
      ...prev,
      status: 'polling',
      error: null,
    }));

    const flight = pool
      .poll()
      .then(result => {
        if (result.status === 'filled') {
          // Supersede prior owned ad.
          if (adRef.current && adRef.current !== result.ad && ownedByHookRef.current) {
            try {
              adRef.current.destroy();
            } catch {
              // ignore
            }
          }
          ownedByHookRef.current = true;
          adRef.current = result.ad;
          watchStale(result.ad);

          // Wrap show so hook-owned successful show → consumed (fullscreen only).
          if (
            result.ad.format === AdFormat.INTERSTITIAL ||
            result.ad.format === AdFormat.REWARDED ||
            result.ad.format === AdFormat.REWARDED_INTERSTITIAL ||
            result.ad.format === AdFormat.APP_OPEN
          ) {
            const fullscreen = result.ad;
            const originalShow = fullscreen.show.bind(fullscreen);
            fullscreen.show = async (options?: AdShowOptions) => {
              await originalShow(options);
              if (adRef.current === fullscreen && ownedByHookRef.current) {
                try {
                  fullscreen.destroy();
                } catch {
                  // ignore
                }
                adRef.current = null;
                clearStaleSub();
                setState(prev => ({
                  ...prev,
                  status: 'consumed',
                  ad: null,
                  error: null,
                }));
                void refreshAvailability(poolIdRef.current);
              }
            };
          }

          setState(prev => ({
            ...prev,
            status: 'filled',
            ad: result.ad,
            error: null,
          }));
        } else if (result.status === 'empty') {
          setState(prev => ({ ...prev, status: 'empty', ad: null, error: null }));
        } else if (result.status === 'timeout') {
          setState(prev => ({ ...prev, status: 'timeout', ad: null, error: null }));
        } else if (result.status === 'no-fill') {
          setState(prev => ({
            ...prev,
            status: 'no-fill',
            ad: null,
            error: result.error as AdError,
          }));
        } else {
          setState(prev => ({
            ...prev,
            status: 'error',
            ad: null,
            error: result.error as AdError,
          }));
        }
        void refreshAvailability(id);
        return result;
      })
      .finally(() => {
        inflightRef.current = null;
      });

    inflightRef.current = flight;
    return flight;
  }, [refreshAvailability]);

  const release = useCallback((): PooledAd | null => {
    const ad = adRef.current;
    if (!ad) {
      return null;
    }
    ownedByHookRef.current = false;
    clearStaleSub();
    adRef.current = null;
    setState(prev => ({
      ...prev,
      status: 'idle',
      ad: null,
      error: null,
    }));
    return ad;
  }, []);

  return {
    status: state.status,
    ad: state.ad,
    error: state.error,
    poolStatus: poolLookup.status,
    available: state.available,
    observedCount: state.observedCount,
    poll,
    release,
  } as UsePooledAdResult;
}
