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

import { MultiFormatAdRequest } from '../ads/MultiFormatAdRequest';
import type { AdErrorPayload } from '../types/AdError';
import { AdFormat } from '../types/AdFormat';
import type {
  AdPool,
  AdPoolAvailability,
  AdPoolEvent,
  AdPoolResolvedConfig,
  PollResult,
  PooledAd,
} from '../types/AdPool';
import type { MultiFormatAdFormat, MultiFormatAdHandle } from '../types/MultiFormatAd';
import type { ResponseInfo } from '../types/ResponseInfo';
import { createPoolAdError } from '../validateAdPoolConfig';

type BufferedSlot = {
  ad: PooledAd;
  unsubStale: () => void;
};

/**
 * Library-managed depth-1 display pool (banner / native).
 *
 * Fills via multi-format `MultiFormatAdRequest` (count 1). Classic backends have no
 * SDK display preloader, so create always reports
 * `'pool/emulated-no-sdk-preloader'` and clamps buffer depth to 1.
 *
 * Expiry of pool-owned inventory is library-owned (Option 1): policy eviction
 * emits `expired` and does **not** unprompted forever-refill. Refill is
 * demand-gated (create + after successful poll / empty poll kick).
 */
export class EmulatedAdPool implements AdPool {
  readonly poolId: string;
  readonly formats: Array<AdFormat.BANNER | AdFormat.NATIVE>;
  readonly resolved: AdPoolResolvedConfig;

  private destroyed = false;
  private generation = 0;
  private readonly listeners = new Set<(event: AdPoolEvent) => void>();
  private slot: BufferedSlot | null = null;
  private loadInFlight: Promise<void> | null = null;
  private lastNoFill: AdErrorPayload | null = null;
  private readonly pollTimeoutMillis: number | undefined;
  private readonly onDestroyed: (() => void) | undefined;
  private pendingDegraded = false;

  constructor(resolved: AdPoolResolvedConfig, onDestroyed?: () => void) {
    this.poolId = resolved.poolId;
    this.formats = resolved.formats as Array<AdFormat.BANNER | AdFormat.NATIVE>;
    this.resolved = resolved;
    this.pollTimeoutMillis = resolved.pollTimeoutMillis;
    this.onDestroyed = onDestroyed;
  }

  /** Emits a create-time degraded event after the pool is registered. */
  notifyDegraded(): void {
    if (!this.resolved.degraded) {
      return;
    }
    if (this.listeners.size === 0) {
      this.pendingDegraded = true;
      return;
    }
    this.emit({
      type: 'degraded',
      poolId: this.poolId,
      reasons: this.resolved.degradeReasons,
      resolved: this.resolved,
    });
  }

  /** Kick the initial depth-1 fill (create is demand). */
  start(): void {
    this.ensureFilling();
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

  private clearSlot(reason: 'stale-by-policy' | 'refresh' | 'destroy'): void {
    const current = this.slot;
    if (!current) {
      return;
    }
    this.slot = null;
    try {
      current.unsubStale();
    } catch {
      // ignore
    }
    if (reason === 'stale-by-policy' || reason === 'refresh') {
      this.emit({
        type: 'expired',
        poolId: this.poolId,
        adId: current.ad.adId,
        reason,
        provenance: 'pool/emulated-no-sdk-preloader',
      });
    }
    try {
      current.ad.destroy();
    } catch {
      // ignore
    }
  }

  private handleAsPooledAd(handle: MultiFormatAdHandle): PooledAd {
    if (handle.format === AdFormat.NATIVE) {
      return {
        format: AdFormat.NATIVE,
        ad: handle.ad,
        adId: handle.adId,
        observedAt: handle.observedAt,
        provenance: 'pool/emulated-no-sdk-preloader',
        responseInfo: handle.responseInfo,
        stalenessWindowMillis: handle.stalenessWindowMillis,
        stalenessWindowSource: handle.stalenessWindowSource,
        isStaleByPolicy: () => handle.isStaleByPolicy(),
        onStaleByPolicy: listener => handle.onStaleByPolicy(listener),
        destroy: () => {
          handle.destroy();
        },
      };
    }
    return {
      format: AdFormat.BANNER,
      size: handle.size,
      adId: handle.adId,
      observedAt: handle.observedAt,
      provenance: 'pool/emulated-no-sdk-preloader',
      responseInfo: handle.responseInfo,
      stalenessWindowMillis: handle.stalenessWindowMillis,
      stalenessWindowSource: handle.stalenessWindowSource,
      isStaleByPolicy: () => handle.isStaleByPolicy(),
      onStaleByPolicy: listener => handle.onStaleByPolicy(listener),
      destroy: () => {
        handle.destroy();
      },
    };
  }

  private installSlot(pooled: PooledAd, replacedAdId: string | null): void {
    const unsubStale = pooled.onStaleByPolicy(() => {
      if (this.destroyed || this.slot?.ad !== pooled) {
        return;
      }
      // Demand-gated: do not forever-refill on policy eviction.
      this.clearSlot('stale-by-policy');
    });
    this.slot = { ad: pooled, unsubStale };
    this.emit({
      type: 'refreshed',
      poolId: this.poolId,
      adId: pooled.adId,
      replacedAdId,
      provenance: 'pool/emulated-no-sdk-preloader',
    });
  }

  private buildRequest(): MultiFormatAdRequest {
    const formats = this.formats as MultiFormatAdFormat[];
    const wantsBanner = formats.includes(AdFormat.BANNER);
    return MultiFormatAdRequest.create({
      adUnitId: this.resolved.adUnitId,
      requestOptions: {
        ...(this.resolved.requestOptions ?? {}),
        formats,
        requestCount: 1,
        ...(wantsBanner
          ? {
              adServer: 'ad-manager' as const,
              bannerSizes: this.resolved.bannerSizes,
            }
          : {}),
        stalenessWindowMillis: this.resolved.stalenessWindowMillis,
      },
    });
  }

  private ensureFilling(): void {
    if (this.destroyed || this.slot || this.loadInFlight) {
      return;
    }
    const gen = this.generation;
    const request = this.buildRequest();
    this.loadInFlight = (async () => {
      try {
        const result = await request.load();
        if (this.destroyed || gen !== this.generation) {
          result.ads.forEach(ad => {
            try {
              ad.destroy();
            } catch {
              // ignore
            }
          });
          request.destroy();
          return;
        }

        if (result.ads.length === 0) {
          if (result.errors.length > 0) {
            const err = result.errors[0];
            this.lastNoFill = err;
            this.emit({ type: 'error', poolId: this.poolId, error: err });
          } else {
            this.lastNoFill = createPoolAdError('no-fill', 'Display pool load returned no fill');
          }
          // No live handle: safe to tear down the request bookkeeping.
          request.destroy();
          return;
        }

        this.lastNoFill = null;
        const pooled = this.handleAsPooledAd(result.ads[0]);
        // Do not `request.destroy()` after a successful fill: that would
        // destroyHandle the inventory. The handle's destroy closure keeps the
        // request alive until the pooled ad is destroyed.
        this.installSlot(pooled, null);
      } catch (error: unknown) {
        if (this.destroyed || gen !== this.generation) {
          return;
        }
        const payload =
          error && typeof error === 'object' && 'reason' in error
            ? (error as AdErrorPayload)
            : createPoolAdError(
                'internal-error',
                error instanceof Error ? error.message : 'Display pool load failed',
              );
        this.lastNoFill = payload;
        this.emit({ type: 'error', poolId: this.poolId, error: payload });
        try {
          request.destroy();
        } catch {
          // ignore
        }
      }
    })().finally(() => {
      this.loadInFlight = null;
    });
  }

  private takeSlot(): PooledAd | null {
    const current = this.slot;
    if (!current) {
      return null;
    }
    this.slot = null;
    try {
      current.unsubStale();
    } catch {
      // ignore
    }
    return current.ad;
  }

  getAvailability(): Promise<AdPoolAvailability> {
    if (this.destroyed) {
      return Promise.resolve({ available: false, observedCount: 0 });
    }
    const observedCount = this.slot ? 1 : 0;
    return Promise.resolve({ available: observedCount > 0, observedCount });
  }

  peekResponseInfo(): Promise<ResponseInfo | null> {
    if (this.destroyed) {
      return Promise.resolve(null);
    }
    // Library owns the buffer head — peek does not need the SDK peek API.
    return Promise.resolve(this.slot?.ad.responseInfo ?? null);
  }

  async poll(): Promise<PollResult> {
    if (this.destroyed) {
      return {
        status: 'error',
        error: createPoolAdError('internal-error', 'Pool has been destroyed'),
      };
    }

    const runPoll = (): PollResult => {
      const filled = this.takeSlot();
      if (filled) {
        this.ensureFilling();
        return { status: 'filled', ad: filled };
      }

      if (this.lastNoFill) {
        const error = this.lastNoFill;
        this.lastNoFill = null;
        this.ensureFilling();
        return { status: 'no-fill', error };
      }

      this.ensureFilling();
      return { status: 'empty' };
    };

    const timeoutMs = this.pollTimeoutMillis;
    if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
      return await Promise.race([
        (async () => {
          // Wait for an in-flight fill once, then re-run poll logic.
          const inflight = this.loadInFlight;
          if (inflight) {
            await inflight;
          } else {
            this.ensureFilling();
            const kicked = this.loadInFlight;
            if (kicked) {
              await kicked;
            }
          }
          return runPoll();
        })(),
        new Promise<PollResult>(resolve => {
          setTimeout(() => {
            resolve({ status: 'timeout' });
          }, timeoutMs);
        }),
      ]);
    }

    return runPoll();
  }

  addListener(listener: (event: AdPoolEvent) => void): () => void {
    this.listeners.add(listener);
    if (this.pendingDegraded) {
      this.pendingDegraded = false;
      try {
        listener({
          type: 'degraded',
          poolId: this.poolId,
          reasons: this.resolved.degradeReasons,
          resolved: this.resolved,
        });
      } catch {
        // consumer errors must not break other listeners
      }
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.generation += 1;
    this.listeners.clear();
    this.clearSlot('destroy');
    this.loadInFlight = null;
    this.lastNoFill = null;
    this.onDestroyed?.();
  }
}

export function createEmulatedDisplayPool(
  resolved: AdPoolResolvedConfig,
  onDestroyed?: () => void,
): EmulatedAdPool {
  const pool = new EmulatedAdPool(resolved, onDestroyed);
  pool.start();
  return pool;
}
