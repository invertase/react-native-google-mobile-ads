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

import { EmitterSubscription } from 'react-native';

import { getAdCapabilities } from '../capabilities/getAdCapabilities';
import { adErrorFromNativeEvent } from './adErrorFromNativeEvent';
import { allocateFullscreenRequestId, createPooledFullscreenAd } from './pooledFullscreenAd';
import { SharedEventEmitter } from './SharedEventEmitter';
import NativeGoogleMobileAdsPoolModule from '../specs/modules/NativeGoogleMobileAdsPoolModule';
import type { AdErrorPayload } from '../types/AdError';
import type {
  AdPool,
  AdPoolAvailability,
  AdPoolEvent,
  AdPoolResolvedConfig,
  PollResult,
} from '../types/AdPool';
import type { FullscreenAdFormat } from '../types/FullscreenAdFormat';
import type { ResponseInfo } from '../types/ResponseInfo';
import { createPoolAdError } from '../validateAdPoolConfig';

type PoolNativeEvent = {
  type: 'available' | 'exhausted' | 'error';
  poolId?: string;
  responseId?: string;
  data?: { responseId?: string };
  error?: {
    code: string;
    message: string;
    reason?: string;
    phase?: 'load' | 'show';
    responseInfo?: ResponseInfo;
  };
};

/**
 * Tracks first-seen response ids so poll can set observedAt when the library
 * saw availability (Option 1 / inventory-expiry canonical).
 */
export class SdkManagedAdPool implements AdPool {
  readonly poolId: string;
  readonly formats: FullscreenAdFormat[];
  readonly resolved: AdPoolResolvedConfig;

  private destroyed = false;
  private readonly listeners = new Set<(event: AdPoolEvent) => void>();
  private readonly observedResponseIds = new Map<string, number>();
  private readonly nativeSubscription: EmitterSubscription;
  private readonly format: FullscreenAdFormat;
  private readonly pollTimeoutMillis: number | undefined;

  constructor(resolved: AdPoolResolvedConfig) {
    this.poolId = resolved.poolId;
    this.formats = resolved.formats as FullscreenAdFormat[];
    this.resolved = resolved;
    this.format = this.formats[0];
    this.pollTimeoutMillis = resolved.pollTimeoutMillis;

    this.nativeSubscription = SharedEventEmitter.addListener(
      `google_mobile_ads_pool_event:${this.poolId}:0`,
      (event: { body?: PoolNativeEvent } & PoolNativeEvent) => {
        if (this.destroyed) {
          return;
        }
        const payload = event.body ?? event;
        const responseId = payload.responseId ?? payload.data?.responseId;
        if (payload.type === 'available' && responseId) {
          if (!this.observedResponseIds.has(responseId)) {
            this.observedResponseIds.set(responseId, Date.now());
          }
          this.emit({
            type: 'available',
            poolId: this.poolId,
            responseId,
          });
          return;
        }
        if (payload.type === 'exhausted') {
          this.emit({ type: 'exhausted', poolId: this.poolId });
          return;
        }
        if (payload.type === 'error' && payload.error) {
          const errPayload = adErrorFromNativeEvent(
            payload.error,
            'googleMobileAds/pool',
            'load',
          ) as AdErrorPayload;
          this.emit({ type: 'error', poolId: this.poolId, error: errPayload });
        }
      },
    );
  }

  /** Emits a create-time degraded event after the pool is registered. */
  notifyDegraded(): void {
    if (!this.resolved.degraded) {
      return;
    }
    this.emit({
      type: 'degraded',
      poolId: this.poolId,
      reasons: this.resolved.degradeReasons,
      resolved: this.resolved,
    });
  }

  private emit(event: AdPoolEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch {
        // consumer errors must not break other listeners
      }
    });
  }

  async getAvailability(): Promise<AdPoolAvailability> {
    if (this.destroyed) {
      return { available: false, observedCount: 0 };
    }
    const result = await NativeGoogleMobileAdsPoolModule.poolGetAvailability(
      this.poolId,
      this.format,
    );
    return {
      available: result.observedCount > 0,
      observedCount: result.observedCount,
    };
  }

  async peekResponseInfo(): Promise<ResponseInfo | null> {
    if (this.destroyed) {
      return null;
    }
    const caps = getAdCapabilities();
    if (caps.poolResponseInfoPeek === 'unavailable') {
      throw createPoolAdError(
        'pool/peek-unsupported',
        `AdPool.peekResponseInfo is unsupported on backend '${caps.backend}'`,
      );
    }
    const info = await NativeGoogleMobileAdsPoolModule.poolPeekResponseInfo(
      this.poolId,
      this.format,
    );
    return (info as ResponseInfo | null) ?? null;
  }

  async poll(): Promise<PollResult> {
    if (this.destroyed) {
      return {
        status: 'error',
        error: createPoolAdError('internal-error', 'Pool has been destroyed'),
      };
    }

    const runPoll = async (): Promise<PollResult> => {
      try {
        const availability = await this.getAvailability();
        if (!availability.available) {
          return { status: 'empty' };
        }

        const requestId = allocateFullscreenRequestId();
        const result = await NativeGoogleMobileAdsPoolModule.poolPoll(
          this.poolId,
          this.format,
          requestId,
          this.resolved.adUnitId,
        );

        if (!result.filled) {
          return { status: 'empty' };
        }

        const responseId =
          typeof result.responseId === 'string' && result.responseId.length > 0
            ? result.responseId
            : null;
        const observedAt =
          responseId != null ? (this.observedResponseIds.get(responseId) ?? null) : null;
        if (responseId != null) {
          this.observedResponseIds.delete(responseId);
        }

        const ad = createPooledFullscreenAd({
          format: this.format,
          adUnitId: this.resolved.adUnitId,
          requestId: result.requestId ?? requestId,
          responseInfo: (result.responseInfo as ResponseInfo | null) ?? null,
          observedAt,
          stalenessWindowMillis: this.resolved.effectiveStalenessWindowMillis,
        });

        return { status: 'filled', ad };
      } catch (error) {
        const payload =
          error && typeof error === 'object' && 'reason' in error
            ? (error as AdErrorPayload)
            : createPoolAdError(
                'internal-error',
                error instanceof Error ? error.message : 'Pool poll failed',
              );
        return { status: 'error', error: payload };
      }
    };

    if (
      typeof this.pollTimeoutMillis === 'number' &&
      Number.isFinite(this.pollTimeoutMillis) &&
      this.pollTimeoutMillis > 0
    ) {
      return await Promise.race([
        runPoll(),
        new Promise<PollResult>(resolve => {
          setTimeout(() => {
            resolve({ status: 'timeout' });
          }, this.pollTimeoutMillis);
        }),
      ]);
    }

    return runPoll();
  }

  addListener(listener: (event: AdPoolEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.nativeSubscription.remove();
    this.listeners.clear();
    this.observedResponseIds.clear();
    if (registry.get(this.poolId) === this) {
      registry.delete(this.poolId);
      notifyRegistry();
    }
    try {
      NativeGoogleMobileAdsPoolModule.poolDestroy(this.poolId, this.format);
    } catch {
      // native may already be torn down
    }
  }
}

const registry = new Map<string, SdkManagedAdPool>();

/** Notifies AdPoolProvider / hooks when the registry changes. */
type RegistryListener = () => void;
const registryListeners = new Set<RegistryListener>();

export function subscribeAdPoolRegistry(listener: RegistryListener): () => void {
  registryListeners.add(listener);
  return () => {
    registryListeners.delete(listener);
  };
}

function notifyRegistry(): void {
  registryListeners.forEach(listener => {
    try {
      listener();
    } catch {
      // ignore
    }
  });
}

export function getRegisteredAdPool(poolId: string): AdPool | null {
  return registry.get(poolId) ?? null;
}

export function registerAdPool(pool: SdkManagedAdPool): void {
  const existing = registry.get(pool.poolId);
  if (existing && existing !== pool) {
    existing.destroy();
  }
  registry.set(pool.poolId, pool);
  notifyRegistry();
}

export function unregisterAdPool(poolId: string): void {
  const existing = registry.get(poolId);
  if (!existing) {
    return;
  }
  registry.delete(poolId);
  notifyRegistry();
  existing.destroy();
}

export function destroyAllAdPools(): void {
  const pools = Array.from(registry.values());
  registry.clear();
  pools.forEach(pool => {
    pool.destroy();
  });
  notifyRegistry();
}

export async function startNativePool(resolved: AdPoolResolvedConfig): Promise<SdkManagedAdPool> {
  const format = resolved.formats[0] as FullscreenAdFormat;
  NativeGoogleMobileAdsPoolModule.addListener('google_mobile_ads_pool_event');
  const start = await NativeGoogleMobileAdsPoolModule.poolStart(
    resolved.poolId,
    format,
    resolved.adUnitId,
    resolved.effectiveBufferSize,
    (resolved.requestOptions ?? {}) as Record<string, unknown>,
  );

  const pool = new SdkManagedAdPool({
    ...resolved,
    effectiveBufferSize: start.effectiveBufferSize || resolved.effectiveBufferSize,
  });

  return pool;
}
