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
  beginAdPoolCreation,
  completeAdPoolCreation,
  destroyAllAdPools,
  getRegisteredAdPool,
  isCurrentAdPoolCreation,
  registerAdPool,
  startNativePool,
} from './internal/adPoolRegistry';
import { MobileAds, ensureMobileAdsInitialized } from './MobileAds';
import type { AdPool, AdPoolConfig, AdPoolsApi } from './types/AdPool';
import { createPoolAdError, validateAdPoolConfig } from './validateAdPoolConfig';
import { AdFormat } from './types/AdFormat';
import type { FullscreenAdFormat } from './types/FullscreenAdFormat';

type CreationAttempt = {
  promise: Promise<AdPool>;
  resolve(value: AdPool | PromiseLike<AdPool>): void;
  reject(error: unknown): void;
};

const creationAttempts = new Map<string, CreationAttempt>();
const creationOwners = new WeakMap<AdPool, object>();

function createAttempt(): CreationAttempt {
  let settled = false;
  let resolvePromise!: (value: AdPool | PromiseLike<AdPool>) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<AdPool>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve(value) {
      if (!settled) {
        settled = true;
        resolvePromise(value);
      }
    },
    reject(error) {
      if (!settled) {
        settled = true;
        rejectPromise(error);
      }
    },
  };
}

function isSdkManagedFormat(format: AdFormat): format is FullscreenAdFormat {
  return format !== AdFormat.BANNER && format !== AdFormat.NATIVE;
}

/**
 * Factory for managed ad pools.
 *
 * Classic fullscreen pools wire to the platform SDK preloader.
 * Display (banner/native) pools are library-emulated depth-1.
 */
type InternalAdPoolsApi = Omit<AdPoolsApi, 'create'> & {
  create(config: AdPoolConfig, owner?: object | null): Promise<AdPool>;
};

const adPools: InternalAdPoolsApi = {
  getCapabilities: getAdCapabilities,

  /**
   * Create (or replace) a managed ad pool.
   *
   * @remarks
   * **WARNING:** Calling this triggers Android native `initialize()` via
   * `ensureMobileAdsInitialized()`. Do **not** call before consent is
   * resolved. Prefer gating declarative ownership with `AdPoolProvider`'s
   * `enabled` prop (mirrors hook `autoLoad`), or only invoke this after
   * UMP / consent has finished.
   */
  async create(config: AdPoolConfig, owner = null): Promise<AdPool> {
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

    const attempt = createAttempt();
    const format = resolved.formats[0];
    const generation = beginAdPoolCreation(
      resolved.poolId,
      isSdkManagedFormat(format) ? format : null,
      () => {
        if (creationAttempts.get(resolved.poolId) === attempt) {
          creationAttempts.delete(resolved.poolId);
        }
        attempt.reject(
          createPoolAdError('internal-error', `Pool "${resolved.poolId}" creation was cancelled`),
        );
      },
      winner => {
        attempt.resolve(winner);
      },
      attempt.promise,
    );
    creationAttempts.set(resolved.poolId, attempt);

    void Promise.resolve().then(async () => {
      try {
        if (!isCurrentAdPoolCreation(resolved.poolId, generation)) {
          return;
        }

        await ensureMobileAdsInitialized();

        const pool = await startNativePool(resolved, generation);
        if (!isCurrentAdPoolCreation(resolved.poolId, generation)) {
          pool.destroy();
          return;
        }

        if (owner) {
          creationOwners.set(pool, owner);
        }
        registerAdPool(pool);
        completeAdPoolCreation(resolved.poolId, generation);
        if (resolved.degraded) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            // eslint-disable-next-line no-console
            console.warn(
              `[AdPools] pool "${resolved.poolId}" created in degraded mode: ${resolved.degradeReasons.join(
                ', ',
              )}`,
            );
          }
          pool.notifyDegraded();
        }
        attempt.resolve(pool);
        if (creationAttempts.get(resolved.poolId) === attempt) {
          creationAttempts.delete(resolved.poolId);
        }
      } catch (error) {
        if (!isCurrentAdPoolCreation(resolved.poolId, generation)) {
          return;
        }
        completeAdPoolCreation(resolved.poolId, generation);
        attempt.reject(error);
        if (creationAttempts.get(resolved.poolId) === attempt) {
          creationAttempts.delete(resolved.poolId);
        }
      }
    });
    return attempt.promise;
  },

  get(poolId: string): AdPool | null {
    return getRegisteredAdPool(poolId);
  },

  destroyAll(): void {
    destroyAllAdPools();
  },
};

export const AdPools: AdPoolsApi = adPools;

export function createOwnedAdPool(config: AdPoolConfig): {
  promise: Promise<AdPool>;
  abandon(pool: AdPool): void;
} {
  const owner = {};
  return {
    promise: adPools.create(config, owner),
    abandon(pool) {
      if (creationOwners.get(pool) === owner && getRegisteredAdPool(pool.poolId) === pool) {
        pool.destroy();
      }
    },
  };
}
