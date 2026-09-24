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
   * gating: one value cannot express that both Android backends (classic and
   * Next-Gen) reject rewarded interstitial while accepting the other three
   * fullscreen formats.
   */
  fullscreenPreload: CapabilitySupport;
  /**
   * Per-format SDK-managed fullscreen preloader support. Gate rewarded
   * interstitial pooling here before `AdPools.create`: on both Android
   * backends (classic and Next-Gen) that format is `unavailable` and create
   * hard-errors with `'pool/format-preload-unsupported'`.
   */
  fullscreenPreloadFormats: Record<FullscreenAdFormat, CapabilitySupport>;
  /**
   * Banner/native preloader. No backend (iOS, Android classic, Android
   * Next-Gen) ships one, so this is `emulated` everywhere: display pools are
   * library-managed depth-1.
   */
  displayPreload: CapabilitySupport;
  /** numberOfAds > 1. Unsupported on mediated units. */
  multiCountNative: CapabilitySupport;
  /**
   * Non-consuming head-of-queue `ResponseInfo` peek for **SDK-managed** pools.
   * iOS (`adResponseInfoWithPreloadID:`) and Android Next-Gen
   * (`peekAdResponseInfo`) expose one (`supported`); classic Android has no
   * SDK peek API (`unavailable`). When `unavailable`,
   * SDK-managed `AdPool.peekResponseInfo()` hard-errors with
   * `'pool/peek-unsupported'` rather than resolving `null` (empty head).
   * Library-managed (emulated) pools peek their own buffer without this gate.
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
