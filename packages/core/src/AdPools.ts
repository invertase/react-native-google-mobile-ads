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

import { getAdCapabilities } from './capabilities/getAdCapabilities';
import {
  destroyAllAdPools,
  getRegisteredAdPool,
  registerAdPool,
  startNativePool,
} from './internal/adPoolRegistry';
import { MobileAds } from './MobileAds';
import type { AdPool, AdPoolConfig, AdPoolsApi } from './types/AdPool';
import { createPoolAdError, validateAdPoolConfig } from './validateAdPoolConfig';

/**
 * Factory for managed ad pools.
 *
 * Classic fullscreen pools wire to the platform SDK preloader (FEAT-05).
 * Display (banner/native) emulation is FEAT-06.
 */
export const AdPools: AdPoolsApi = {
  getCapabilities: getAdCapabilities,

  async create(config: AdPoolConfig): Promise<AdPool> {
    // Ensure native event bridge subscriptions (including pool events) are live.
    MobileAds();

    let resolved;
    try {
      resolved = validateAdPoolConfig(config);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw createPoolAdError(
        'invalid-request',
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Invalid AdPoolConfig',
      );
    }

    const existing = getRegisteredAdPool(resolved.poolId);
    if (existing) {
      existing.destroy();
    }

    const pool = await startNativePool(resolved);
    registerAdPool(pool);
    if (resolved.degraded) {
      queueMicrotask(() => {
        pool.notifyDegraded();
      });
    }
    return pool;
  },

  get(poolId: string): AdPool | null {
    return getRegisteredAdPool(poolId);
  },

  destroyAll(): void {
    destroyAllAdPools();
  },
};
