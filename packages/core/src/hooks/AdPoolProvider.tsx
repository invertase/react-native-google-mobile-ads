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

import { AdPools } from '../AdPools';
import {
  getRegisteredAdPool,
  subscribeAdPoolRegistry,
  unregisterAdPool,
} from '../internal/adPoolRegistry';
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
 */
export function AdPoolProvider(props: AdPoolProviderProps): React.ReactElement {
  const { pools, children } = props;
  const ownedRef = React.useRef<Map<string, OwnedEntry>>(new Map());
  const [, bump] = React.useState(0);

  React.useEffect(
    () =>
      subscribeAdPoolRegistry(() => {
        bump(n => n + 1);
      }),
    [],
  );

  React.useEffect(() => {
    const nextIds = new Set(pools.map(p => p.poolId));
    const owned = ownedRef.current;

    // Destroy removed ids.
    for (const poolId of Array.from(owned.keys())) {
      if (!nextIds.has(poolId)) {
        owned.delete(poolId);
        unregisterAdPool(poolId);
      }
    }

    // Create or replace by signature.
    for (const config of pools) {
      const signature = configSignature(config);
      const previous = owned.get(config.poolId);
      if (previous && previous.signature === signature && getRegisteredAdPool(config.poolId)) {
        continue;
      }
      owned.set(config.poolId, { config, signature });
      void AdPools.create(config).catch(() => {
        // Error surfaces via useAdPool status; registry may lack the id.
      });
    }
  }, [pools]);

  React.useEffect(() => {
    return () => {
      const owned = ownedRef.current;
      for (const poolId of Array.from(owned.keys())) {
        unregisterAdPool(poolId);
      }
      owned.clear();
    };
  }, []);

  return React.createElement(React.Fragment, null, children);
}
