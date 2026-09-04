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

/**
 * Google's published guidance figures used as **publisher policy defaults**,
 * not as the SDK's cache timeout. The real preload TTL is server-delivered and
 * unreadable; these millis are only the defaults applied when the publisher
 * does not configure a window. Public contract: Option 1 — report and hand over
 * inventory that already exceeds the window; do not auto-discard on poll
 * (`isStaleByPolicy` / `onStaleByPolicy` on the held object).
 */
export const AdStalenessGuidanceMillis = {
  /** App open guides: four hours. */
  APP_OPEN: 4 * 60 * 60 * 1000,
  /** Other formats: one hour tip. The Android interstitial figure is contested. */
  OTHER: 60 * 60 * 1000,
} as const;

/**
 * Where the applied staleness window on a handed-out object came from.
 *
 * Readable so a log line can explain a stale verdict without guessing which
 * number was applied (app open defaults differ from other formats by 4×).
 */
export type AdStalenessWindowSource = 'configured' | 'guidance/app-open' | 'guidance/other';

/**
 * Who performed the load for this handed-out object.
 *
 * Reuses the existing `'pool/emulated-no-sdk-preloader'` vocabulary for every
 * library-performed load (emulated pools, multi-format handles, one-shot loads
 * that land on this surface) rather than inventing a parallel tag. SDK-managed
 * polls use `'pool/sdk-managed-preloader'`. Knowability differs by provenance;
 * see the canonical inventory expiry record.
 */
export type AdInventoryProvenance = 'pool/emulated-no-sdk-preloader' | 'pool/sdk-managed-preloader';

/**
 * Identity carried by every piece of inventory the library hands to a
 * consumer, for correlation and diagnostics.
 *
 * Shared by pooled ads and multi-format handles so the two read as siblings
 * and so a log line from either can be correlated the same way.
 */
export type AdIdentity = {
  /** Stable id, unique within the app for this ad's lifetime. */
  adId: string;
  /**
   * Wall-clock epoch millis of the library's own observation of this ad, or
   * `null` when the library never saw it arrive.
   *
   * Per provenance:
   * - `'pool/emulated-no-sdk-preloader'`: load completion observed by this
   *   library. There is no hidden platform cache age underneath.
   * - `'pool/sdk-managed-preloader'`: ad availability observed by this library
   *   (correlated from the preload availability callback). Not the platform's
   *   own cache age, and `null` when the library was not listening when the ad
   *   became available (for example after a JS context reload).
   *
   * Neither value is the SDK's cache age. Wall clock matches the platform's
   * own predicate basis; a monotonic companion may land with native wiring for
   * lifecycle safety across clock changes.
   */
  observedAt: number | null;
};

/**
 * Publisher-owned staleness policy on inventory the consumer holds.
 *
 * Protects against the library or the publisher holding an ad too long. It
 * does **not** certify that an ad inside the window is valid: on an
 * SDK-managed poll the ad may already be past the platform's own timeout at
 * hand-off.
 *
 * Scope still matters: these members describe the object the consumer holds.
 * Pool churn events describe pool-owned inventory only, and a handed-out ad
 * has already left the pool, so those events can never identify it.
 */
export type AdExpiry = {
  /**
   * Applied staleness window in milliseconds. Either the publisher's
   * configured value or the guidance default for the format.
   */
  stalenessWindowMillis: number;
  /** Whether the applied window was configured or inherited from guidance. */
  stalenessWindowSource: AdStalenessWindowSource;
  /**
   * True once `observedAt` is non-null and older than `stalenessWindowMillis`.
   * When `observedAt` is `null`, returns `false` (unknown age is not treated as
   * stale by policy; the publisher still decides whether to show).
   *
   * A `false` result is not a validity certificate.
   */
  isStaleByPolicy(): boolean;
  /**
   * Fires when the held ad crosses the applied policy window. Returns an
   * unsubscribe function.
   *
   * Edge semantics:
   * - Subscribing when already stale by policy invokes the listener
   *   synchronously once.
   * - When `observedAt` is `null`, `isStaleByPolicy()` is `false` and this
   *   subscription never fires (unknown age is not treated as stale).
   * - `destroy()` releases listeners; a later unsubscribe is a no-op.
   * - The timer lives on this object, not on the pool or the hook, so it keeps
   *   running after `release()` transfers ownership to the caller and after
   *   pool `destroy()`. Pool teardown does not own or cancel this timer.
   */
  onStaleByPolicy(listener: () => void): () => void;
};
