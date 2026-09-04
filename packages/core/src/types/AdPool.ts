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

import type { AdEventType } from '../AdEventType';
import type { NativeAd } from '../ads/native-ad/NativeAd';
import type { GAMAdEventType } from '../GAMAdEventType';
import type { RewardedAdEventType } from '../RewardedAdEventType';
import type { AdEventListener } from './AdEventListener';
import type { AdEventsListener } from './AdEventsListener';
import type { AdShowOptions } from './AdShowOptions';
import type { AdErrorPayload } from './AdError';
import type {
  AdExpiry,
  AdIdentity,
  AdInventoryProvenance,
  AdStalenessWindowSource,
} from './AdExpiry';
import type { AdFormat } from './AdFormat';
import type { AdCapabilities } from './AdCapabilities';
import type { FullscreenAdFormat } from './FullscreenAdFormat';
import type { MultiFormatAdRequestOptions } from './MultiFormatAd';
import type { RequestOptions } from './RequestOptions';
import type { ResponseInfo } from './ResponseInfo';

/**
 * Default `poolId` for `AdPoolPresets.display`. Prefer reading
 * `AdPoolPresets.display(unit).poolId` (or this template with the same unit
 * constant) at both provider and consumer so a typo fails at compile time.
 */
export type DisplayPoolId<TAdUnitId extends string = string> = `display-${TAdUnitId}`;

/**
 * Default `poolId` for `AdPoolPresets.fullscreen`. Prefer reading
 * `AdPoolPresets.fullscreen(format, unit).poolId` at both ends of the joint.
 */
export type FullscreenPoolId<
  TFormat extends FullscreenAdFormat = FullscreenAdFormat,
  TAdUnitId extends string = string,
> = `fullscreen-${TFormat}-${TAdUnitId}`;

export type AdPoolConfig = {
  poolId: string;
  formats: AdFormat[];
  adUnitId: string;
  requestOptions?: RequestOptions;
  bufferSize?: number;
  pollTimeoutMillis?: number;
  /**
   * Publisher staleness window in milliseconds. When omitted, the pool applies
   * Google's published guidance for the format (four hours for app open, one
   * hour otherwise) and records that source on each handed-out ad. Not the
   * SDK's cache timeout.
   */
  stalenessWindowMillis?: number;
  adServer?: 'ad-manager' | 'admob';
  mediation?: 'unknown' | 'known-enabled' | 'known-disabled';
  bannerSizes?: MultiFormatAdRequestOptions['bannerSizes'];
};

/**
 * Override bag for `AdPoolPresets.*`. Omits `formats` and `adUnitId` so a
 * preset cannot be type-undercut into a different family or unit. `poolId`
 * remains overridable when you need a stable custom id; overriding it widens
 * the preset return's `poolId` to `string`.
 */
export type AdPoolPresetOverrides = Omit<Partial<AdPoolConfig>, 'formats' | 'adUnitId'>;

/**
 * Degradation reasons reported on `resolved`.
 *
 * `'pool/emulated-no-sdk-preloader'` is also the provenance tag for every
 * library-performed load path: it separates that path from an SDK-managed
 * poll, which is what decides how much can honestly be said about freshness.
 */
export type AdPoolDegradeReason =
  | 'pool/degraded-buffer-size'
  | 'pool/degraded-request-count'
  | 'pool/emulated-no-sdk-preloader';

export type AdPoolResolvedConfig = AdPoolConfig & {
  requestedBufferSize?: number;
  effectiveBufferSize: number;
  /**
   * Applied staleness window after config defaulting. Readable so callers do
   * not have to re-derive the guidance table.
   */
  effectiveStalenessWindowMillis: number;
  effectiveStalenessWindowSource: AdStalenessWindowSource;
  degraded: boolean;
  degradeReasons: AdPoolDegradeReason[];
};

/**
 * Identity carried by every pooled ad, for correlation and diagnostics.
 *
 * Alias of the shared `AdIdentity`, kept so the pooled-ad vocabulary reads
 * naturally. Multi-format handles carry the same members.
 */
export type PooledAdIdentity = AdIdentity;

/**
 * Publisher-policy staleness surface on the object the consumer owns after
 * `poll()`.
 *
 * Alias of the shared `AdExpiry`, which multi-format handles also carry.
 *
 * Pool churn events describe pool-owned inventory only: a polled ad has
 * already left the pool, so those events can never identify it.
 *
 * The canonical pattern is still to poll at show time: Google's guidance is to
 * leave ads in the SDK cache until you are ready to show. Holding a polled ad
 * is the consumer's risk.
 */
export type PooledAdExpiry = AdExpiry;

type PooledAdBase = AdIdentity &
  AdExpiry & {
    /**
     * How this ad was obtained. Decides what `observedAt` measures and how much
     * the policy window can honestly claim.
     */
    provenance: AdInventoryProvenance;
    responseInfo: ResponseInfo | null;
    /**
     * Releases this ad's native resources; idempotent.
     *
     * On the native arm this also destroys the inner `ad`. Do not call
     * `ad.destroy()` separately: the pooled ad owns it, and after `poll()` the
     * caller (or the holding hook) owns the pooled ad.
     *
     * When `usePooledAd` still owns this ad, do not call `destroy()` on it.
     * Call `release()` first, or leave destruction to the hook. Destroying
     * hook-owned inventory leaves the hook able to report `filled` with a dead
     * ad.
     *
     * Also releases `onStaleByPolicy` listeners; a later unsubscribe is a no-op.
     * The staleness timer lives on this object: it keeps running after
     * `release()` and is unaffected by pool `destroy()`.
     */
    destroy(): void;
  };

export type PooledAd =
  | (Omit<PooledAdBase, 'provenance'> & {
      format: AdFormat.NATIVE;
      /**
       * Owned by this pooled ad. Destroyed by the pooled ad's `destroy()`;
       * never destroy it directly.
       */
      ad: NativeAd;
      /** Display pools are always library-emulated on classic backends. */
      provenance: 'pool/emulated-no-sdk-preloader';
    })
  | (Omit<PooledAdBase, 'provenance'> & {
      format: AdFormat.BANNER;
      size: { width: number; height: number };
      /** Display pools are always library-emulated on classic backends. */
      provenance: 'pool/emulated-no-sdk-preloader';
    })
  | (PooledAdBase & {
      format:
        | AdFormat.INTERSTITIAL
        | AdFormat.REWARDED
        | AdFormat.REWARDED_INTERSTITIAL
        | AdFormat.APP_OPEN;
      show(options?: AdShowOptions): Promise<void>;
      /** Same listener contract as fullscreen MobileAd / GAMInterstitialAd. */
      addAdEventListener<T extends AdEventType | RewardedAdEventType | GAMAdEventType>(
        type: T,
        listener: AdEventListener<T>,
      ): () => void;
      addAdEventsListener<T extends AdEventType | RewardedAdEventType | GAMAdEventType>(
        listener: AdEventsListener<T>,
      ): () => void;
      removeAllListeners(): void;
    });

/**
 * Outcome of `poll()`. Replaces a bare `null`, which could not distinguish an
 * exhausted buffer from a timeout, a no-fill, or a transport failure: cases
 * that call for different consumer responses.
 *
 * `empty` and `timeout` are not errors: the pool is still refilling.
 *
 * A `filled` result means an ad came out of the buffer and nothing more. There
 * is no hand-off freshness guarantee: on an SDK-managed pool the poll path
 * performs no age sweep. An ad that already exceeds the configured policy
 * window is still handed over with `isStaleByPolicy()` true; the publisher
 * decides, because a poll removes the ad with no put-back and the publisher's
 * window may be stricter than the platform's own timeout.
 */
export type PollResult =
  /** Ad handed out; ownership transfers to the caller, including destruction. */
  | { status: 'filled'; ad: PooledAd }
  /** Buffer exhausted, refill in flight. Retry later. */
  | { status: 'empty' }
  /** `pollTimeoutMillis` elapsed. The pool keeps filling. */
  | { status: 'timeout' }
  /** Request completed with no ad. Routine ad-server outcome, not a defect. */
  | { status: 'no-fill'; error: AdErrorPayload }
  /** Network or internal failure. */
  | { status: 'error'; error: AdErrorPayload };

/**
 * Pool lifecycle events.
 *
 * Per-ad eviction (`expired`) and replacement correlation (`refreshed` with
 * `replacedAdId`) are emitted only for pools the library manages itself
 * (`provenance: 'pool/emulated-no-sdk-preloader'`). SDK-managed pools expose
 * only what is observable: buffer exhaustion (cause unknown) and
 * per-response-id availability.
 *
 * Library-managed pools do not perpetually refill on policy eviction without
 * consumer demand: an unprompted forever-refill produces unshown fills that
 * depress match rate.
 */
export type AdPoolEvent =
  | {
      type: 'degraded';
      poolId: string;
      reasons: AdPoolDegradeReason[];
      resolved: AdPoolResolvedConfig;
    }
  | { type: 'error'; poolId: string; error: AdErrorPayload }
  /**
   * Library-managed pools only. Pool-owned inventory crossed the policy window
   * (or was refreshed) and was evicted, so it can never be polled. Never
   * describes an already-polled ad: use `AdExpiry` on the held ad.
   */
  | {
      type: 'expired';
      poolId: string;
      adId: string;
      reason: 'stale-by-policy' | 'refresh';
      provenance: 'pool/emulated-no-sdk-preloader';
    }
  /**
   * Library-managed pools only. Pool-owned inventory was replaced.
   * `replacedAdId` is the `adId` of the evicted ad (correlates with the
   * preceding `expired` event), or `null` when this fill replaced nothing
   * (a plain refill into free depth).
   */
  | {
      type: 'refreshed';
      poolId: string;
      adId: string;
      replacedAdId: string | null;
      provenance: 'pool/emulated-no-sdk-preloader';
    }
  /**
   * SDK-managed pools: the buffer became empty. Cause unknown — a normal poll
   * draining the last ad raises the same signal as a platform eviction.
   *
   * This is the exhaustion signal (`onAdsExhausted` / `adsExhausted` on the
   * platforms). There is no separate "stopped refilling" event: observe that
   * by an `exhausted` with no later `available`, together with
   * `getAvailability().observedCount === 0`.
   */
  | { type: 'exhausted'; poolId: string }
  /**
   * SDK-managed pools: a specific response id became available in the buffer.
   * The correlation key for an observed availability time on a later poll.
   * Refresh observability on this path is `exhausted` → `available`, not a
   * per-ad `refreshed` with `replacedAdId` (that chain is library-managed only).
   */
  | { type: 'available'; poolId: string; responseId: string };

/**
 * Snapshot of pool buffer readiness from `AdPool.getAvailability()`.
 *
 * Both classic platforms expose a count for SDK-managed preloaders
 * (`getNumAdsAvailable` on Android, `numberOfAdsAvailableWithPreloadID:` on
 * iOS). Library-managed (emulated) pools report the library's own buffer
 * depth. `observedCount` is therefore always present — not optional.
 *
 * Caveat: on the Android V2 path neither the boolean nor the count sweeps for
 * expiry, so both are upper bounds rather than a count of ads the SDK would
 * still consider valid. Whether iOS sweeps is UNKNOWN.
 */
export type AdPoolAvailability = {
  /** True when `observedCount > 0`. */
  available: boolean;
  /**
   * Observed buffer depth. Upper bound: does not sweep for expiry on Android
   * V2; iOS sweep UNKNOWN.
   */
  observedCount: number;
};

export interface AdPool {
  readonly poolId: string;
  readonly formats: AdFormat[];
  readonly resolved: AdPoolResolvedConfig;
  /**
   * Reads current buffer readiness. See `AdPoolAvailability` for the count
   * contract and the upper-bound caveat (no expiry sweep on Android V2).
   *
   * Prefer this (or the hook's live `available` / `observedCount`) over
   * inventing a retained-count promise: the SDK may optimize cache order and
   * the app-wide cap is server-delivered.
   */
  getAvailability(): Promise<AdPoolAvailability>;
  /**
   * Non-consuming snapshot of the buffer head only. Carries no time
   * information, so it is not a freshness / age check. Racy: do not treat it
   * as a poll.
   *
   * **SDK-managed** (classic fullscreen) pools are capability-gated by
   * `AdCapabilities.poolResponseInfoPeek` (classic Android has no SDK peek API;
   * classic iOS does). When that capability is `unavailable`, this call
   * hard-errors with reason `'pool/peek-unsupported'`.
   *
   * **Library-managed (emulated) display pools** peek the library's own buffer
   * head and do **not** consult `poolResponseInfoPeek` — they resolve on both
   * platforms. A successful Android peek on an emulated pool is not proof that
   * the SDK peek capability is supported.
   *
   * On either path, a resolved `null` means the head is empty — not
   * "unsupported". Check the capability (or catch `'pool/peek-unsupported'`)
   * before treating `null` as empty inventory on SDK-managed pools.
   */
  peekResponseInfo(): Promise<ResponseInfo | null>;
  /**
   * Takes the next ad, transferring ownership to the caller. Async because a
   * poll crosses to native and GMA delivers load callbacks on the main thread.
   * Never call during render: polling consumes inventory.
   *
   * Hands over whatever came out of the buffer, including inventory that
   * already exceeds the configured staleness window (reported via
   * `isStaleByPolicy()` on the ad). Does not auto-discard past the window.
   *
   * Never rejects: every outcome, including failures, is a `PollResult`.
   */
  poll(): Promise<PollResult>;
  /**
   * Subscribe to pool lifecycle events. Refresh / exhaustion observability:
   * - Library-managed: `expired` + `refreshed` (with `replacedAdId`)
   * - SDK-managed: `exhausted` + `available` (per response id)
   *
   * Returns an unsubscribe function.
   */
  addListener(listener: (event: AdPoolEvent) => void): () => void;
  /**
   * Destroys this pool.
   *
   * Staleness policy on an already-polled ad lives on that ad, not on the pool:
   * the policy timer keeps running after `poll()` / `release()` and is not
   * stopped by this call. Do not rely on pool `destroy()` to tear down ads
   * already handed out; destroy held ads explicitly when you are done.
   */
  destroy(): void;
}

export type AdPoolsApi = {
  getCapabilities(): AdCapabilities;
  /**
   * Async because `resolved` is only knowable after native answers: buffer
   * clamping depends on app-wide pool accounting, and validation consults live
   * backend capabilities. Hard-errors on an impossible config; loud-degrades
   * when a milder adjustment is safe.
   *
   * Hard-errors include rewarded interstitial pooling on Android classic: the
   * platform preloader rejects that format with no usable signal, so the pool
   * can never fill. Check `fullscreenPreloadFormats` before creating, or catch
   * reason `'pool/format-preload-unsupported'`.
   */
  create(config: AdPoolConfig): Promise<AdPool>;
  get(poolId: string): AdPool | null;
  destroyAll(): void;
};
