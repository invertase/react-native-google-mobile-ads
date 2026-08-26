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

import type { AdBackend } from './AdBackend';
import type { AdFormat } from './AdFormat';
import type { CapabilitySupport } from './CapabilitySupport';
import type { FullscreenAdFormat } from './FullscreenAdFormat';

export type AdCapabilities = {
  backend: AdBackend;
  /** The actually-linked native SDK version, read from the SDK itself. */
  sdkVersion: string;
  formats: Record<AdFormat, CapabilitySupport>;
  /** GAM native+banner in one AdLoader request, count 1. */
  multiFormatNativeBanner: CapabilitySupport;
  /**
   * Coarse rollup of fullscreen preload. Prefer `fullscreenPreloadFormats` for
   * gating: one value cannot express that Android classic rejects rewarded
   * interstitial while accepting the other three fullscreen formats.
   */
  fullscreenPreload: CapabilitySupport;
  /**
   * Per-format SDK-managed fullscreen preloader support. Gate rewarded
   * interstitial pooling here before `AdPools.create`: on Android classic that
   * format is `unavailable` and create hard-errors with
   * `'pool/format-preload-unsupported'`.
   */
  fullscreenPreloadFormats: Record<FullscreenAdFormat, CapabilitySupport>;
  /** Banner/native preloader. Unsupported on both classic backends. */
  displayPreload: CapabilitySupport;
  /** numberOfAds > 1. Unsupported on mediated units. */
  multiCountNative: CapabilitySupport;
  /**
   * Non-consuming head-of-queue `ResponseInfo` peek on an `AdPool`.
   * Classic Android has no peek API (`unavailable`); classic iOS exposes
   * `adResponseInfoWithPreloadID:` (`supported` when wired). Gate before
   * `AdPool.peekResponseInfo()`: when `unavailable`, peek hard-errors with
   * `'pool/peek-unsupported'` rather than resolving `null` (empty head).
   */
  poolResponseInfoPeek: CapabilitySupport;
  /**
   * App-wide managed-pool depth cap. Always `null`: the effective cap is
   * server-delivered, so any number reported here would be a guess. Read
   * `AdPoolResolvedConfig.effectiveBufferSize` after create instead.
   */
  maxManagedPoolAds: number | null;
  mediation: 'unknown' | 'known-enabled' | 'known-disabled';
};
