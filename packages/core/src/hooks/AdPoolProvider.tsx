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

import * as React from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { AdPools } from '../AdPools';
import { getRegisteredAdPool, unregisterAdPool } from '../internal/adPoolRegistry';
import type { AdPoolConfig } from '../types/AdPool';

export type AdPoolProviderProps = {
  /**
   * Pool configs to own for the provider lifetime (typically from
   * AdPoolPresets).
   *
   * Reconciled by `poolId`, not by array identity: the provider creates pools
   * for ids that appear, destroys pools for ids that disappear, and leaves
   * existing pools untouched when only the array identity changed. A forgotten
   * `useMemo` therefore cannot tear down and recreate native pools every
   * render. `useMemo` is an optimization here, never a correctness
   * requirement.
   *
   * Reusing a `poolId` with a different config replaces that pool, because the
   * id is the identity.
   */
  pools: AdPoolConfig[];
  /**
   * When `false`, stops *future* pool creates; never destroys, cancels, or
   * unregisters already-created pools. Mirrors hook `autoLoad`: set it
   * `false` while something create depends on is still resolving (typically
   * consent), then flip `true` to resume creates. Default `true`.
   */
  enabled?: boolean;
  children: React.ReactNode;
};

type OwnedEntry = {
  config: AdPoolConfig;
  /** Stable signature of the fields that force recreate when changed. */
  signature: string;
};

function configSignature(config: AdPoolConfig): string {
  return JSON.stringify({
    poolId: config.poolId,
    formats: config.formats,
    adUnitId: config.adUnitId,
    bufferSize: config.bufferSize,
    pollTimeoutMillis: config.pollTimeoutMillis,
    stalenessWindowMillis: config.stalenessWindowMillis,
    adServer: config.adServer,
    mediation: config.mediation,
    bannerSizes: config.bannerSizes,
    requestOptions: config.requestOptions,
  });
}

/**
 * Declarative pool ownership. Creates pools for the configs it is given and
 * destroys them on unmount, reconciling by `poolId` on every render rather
 * than by array identity.
 *
 * Renders `children` unchanged and keeps no React state: it is not a context
 * provider, so it never subscribes to the pool registry. Consumers read pool
 * state through `useAdPool` / `usePooledAd`, which subscribe individually; a
 * registry subscription here would re-render the whole subtree every time any
 * pool registered or was destroyed.
 *
 * The provider owns pools, not ads already handed to consumers:
 *
 * 1. Pass configs with stable `poolId` values.
 * 2. Descendants use that same id with `useAdPool` or `usePooledAd`.
 * 3. Consumers still poll on demand, then render or show the returned ad.
 *
 * A new `pools` array with unchanged ids/configs does not recreate native
 * pools; `useMemo` is an optimization, not a correctness requirement.
 *
 * Creating a pool initializes the SDK on Android and starts preloading, so
 * pass `enabled={consentReady}` until consent is resolved. `enabled={false}`
 * stops future creates only; it never tears down existing pools.
 *
 * @example
 * ```tsx
 * const pool = AdPoolPresets.display(gamUnitId, {
 *   bannerSizes: [BannerAdSize.MEDIUM_RECTANGLE],
 * });
 *
 * function Placement() {
 *   const { status, ad, poll } = usePooledAd(pool.poolId);
 *   return (
 *     <>
 *       <Button title="Load placement" disabled={status === 'polling'} onPress={() => void poll()} />
 *       {ad?.format === AdFormat.BANNER ? <MultiFormatBannerAdView handle={ad} /> : null}
 *     </>
 *   );
 * }
 *
 * <AdPoolProvider pools={[pool]} enabled={consentReady}>
 *   <Placement />
 * </AdPoolProvider>;
 * ```
 */
export function AdPoolProvider(props: AdPoolProviderProps): React.ReactElement {
  const { pools, children, enabled = true } = props;
  const ownedRef = React.useRef<Map<string, OwnedEntry>>(new Map());
  const pendingCreatesRef = React.useRef(new Set<string>());
  const createAttemptsRef = React.useRef(new Map<string, number>());
  const retryTimersRef = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const mountedRef = React.useRef(true);
  const poolsRef = React.useRef(pools);
  poolsRef.current = pools;
  const enabledRef = React.useRef(enabled);
  enabledRef.current = enabled;
  const poolsSignature = pools.map(config => configSignature(config)).join('\0');

  const kickCreate = React.useCallback((config: AdPoolConfig, signature: string) => {
    const poolId = config.poolId;
    if (
      !enabledRef.current ||
      !mountedRef.current ||
      getRegisteredAdPool(poolId) ||
      pendingCreatesRef.current.has(poolId)
    ) {
      return;
    }
    const owned = ownedRef.current;
    const entry = owned.get(poolId);
    if (!entry || entry.signature !== signature) {
      return;
    }
    const attempts = createAttemptsRef.current.get(poolId) ?? 0;
    if (attempts >= 16) {
      return;
    }
    createAttemptsRef.current.set(poolId, attempts + 1);
    pendingCreatesRef.current.add(poolId);
    void AdPools.create(config)
      .catch(() => {
        // Error surfaces via useAdPool status; registry may lack the id.
      })
      .finally(() => {
        pendingCreatesRef.current.delete(poolId);
        if (!mountedRef.current || getRegisteredAdPool(poolId)) {
          return;
        }
        const delay = Math.min(200 * (attempts + 1), 2000);
        const existing = retryTimersRef.current.get(poolId);
        if (existing) {
          clearTimeout(existing);
        }
        retryTimersRef.current.set(
          poolId,
          setTimeout(() => {
            retryTimersRef.current.delete(poolId);
            kickCreate(config, signature);
          }, delay),
        );
      });
  }, []);

  const kickMissingOwnedPools = React.useCallback(() => {
    const owned = ownedRef.current;
    for (const entry of owned.values()) {
      kickCreate(entry.config, entry.signature);
    }
  }, [kickCreate]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    const pools = poolsRef.current;
    const nextIds = new Set(pools.map(p => p.poolId));
    const owned = ownedRef.current;

    // Destroy removed ids.
    for (const poolId of Array.from(owned.keys())) {
      if (!nextIds.has(poolId)) {
        owned.delete(poolId);
        createAttemptsRef.current.delete(poolId);
        const timer = retryTimersRef.current.get(poolId);
        if (timer) {
          clearTimeout(timer);
          retryTimersRef.current.delete(poolId);
        }
        unregisterAdPool(poolId);
      }
    }

    // Create or replace by signature. Skipped when enabled=false so existing
    // pools survive a consent/gate flip; destroy-removed-ids above still runs.
    if (enabled) {
      for (const config of pools) {
        const signature = configSignature(config);
        const previous = owned.get(config.poolId);
        if (previous && previous.signature === signature) {
          if (getRegisteredAdPool(config.poolId) || pendingCreatesRef.current.has(config.poolId)) {
            continue;
          }
        } else {
          createAttemptsRef.current.delete(config.poolId);
        }
        owned.set(config.poolId, { config, signature });
        kickCreate(config, signature);
      }
    }
  }, [kickCreate, poolsSignature, enabled]);

  React.useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        kickMissingOwnedPools();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      sub.remove();
    };
  }, [kickMissingOwnedPools]);

  React.useEffect(() => {
    return () => {
      const owned = ownedRef.current;
      for (const poolId of Array.from(owned.keys())) {
        const timer = retryTimersRef.current.get(poolId);
        if (timer) {
          clearTimeout(timer);
        }
        unregisterAdPool(poolId);
      }
      owned.clear();
      createAttemptsRef.current.clear();
      retryTimersRef.current.clear();
    };
  }, []);

  return React.createElement(React.Fragment, null, children);
}
