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

import type { NativeAd } from '../ads/native-ad/NativeAd';
import type { AdError } from './AdError';
import type { AdExpiry, AdIdentity, AdInventoryProvenance } from './AdExpiry';
import type { AdFormat } from './AdFormat';
import type { MultiFormatBannerSize } from './MultiFormatBannerSize';
import type { RequestOptions } from './RequestOptions';
import type { ResponseInfo } from './ResponseInfo';

export type MultiFormatAdFormat = AdFormat.NATIVE | AdFormat.BANNER;

export type MultiFormatAdRequestOptions = RequestOptions & {
  formats: MultiFormatAdFormat[];
  bannerSizes?: MultiFormatBannerSize[];
  requestCount?: 1;
  adServer?: 'ad-manager';
  /**
   * Publisher staleness window in milliseconds. When omitted, the request
   * applies the one-hour guidance default for display formats and records that
   * source on each handle. Not the SDK's cache timeout.
   */
  stalenessWindowMillis?: number;
};

/**
 * Members every multi-format handle carries.
 *
 * Identity and the publisher-policy staleness surface are the same shapes
 * pooled ads use. A multi-format handle is always a library-performed load
 * (`provenance: 'pool/emulated-no-sdk-preloader'`): the library's own observed
 * load completion is the whole truth available to any client, and the observed
 * time starts at hand-off.
 */
type MultiFormatAdHandleBase = AdIdentity &
  AdExpiry & {
    /**
     * Always `'pool/emulated-no-sdk-preloader'`: this library performed the load.
     */
    provenance: Extract<AdInventoryProvenance, 'pool/emulated-no-sdk-preloader'>;
    responseInfo: ResponseInfo | null;
    /**
     * Releases the handle's native resources; idempotent.
     *
     * On the native arm this also destroys the inner `ad`. Do not call
     * `ad.destroy()` separately: the handle owns it.
     *
     * When `useMultiFormatAd` still owns this handle, do not call `destroy()`
     * on it. Call `release()` first, or leave destruction to the hook.
     * Destroying hook-owned inventory leaves the hook able to report `loaded`
     * / `loaded-partial` with a dead handle.
     *
     * Also releases `onStaleByPolicy` listeners; a later unsubscribe is a no-op.
     * The staleness timer lives on this handle and keeps running after
     * `release()`.
     */
    destroy(): void;
  };

export type MultiFormatAdHandle =
  | (MultiFormatAdHandleBase & {
      format: AdFormat.NATIVE;
      /** Owned by this handle. Destroyed by `destroy()`, never on its own. */
      ad: NativeAd;
    })
  | (MultiFormatAdHandleBase & {
      format: AdFormat.BANNER;
      size: { width: number; height: number };
    });

/**
 * The ad unit plus the request that describes one multi-format load.
 *
 * `MultiFormatAdRequest.create` and `useMultiFormatAd` accept this same
 * object, the way `AdPools.create` and `AdPoolProvider` share `AdPoolConfig`.
 * The hook adds `autoLoad` on top and nothing else.
 *
 * `requestOptions` is nested rather than spread flat so that hook-level fields
 * and request-level fields can never grow into each other: adding a field to
 * `MultiFormatAdRequestOptions` can never collide with a hook option name.
 * The key is named `requestOptions` to match `AdPoolConfig.requestOptions`.
 */
export type MultiFormatAdConfig = {
  adUnitId: string;
  requestOptions: MultiFormatAdRequestOptions;
};

/**
 * Facts every load outcome carries, whichever arm it lands on.
 */
type MultiFormatLoadResultBase = {
  /**
   * The ad server's record of this response, or `null` when the request never
   * reached a response.
   *
   * Present on every arm, including `'no-fill'`, because a response record is
   * not a failure and so does not belong in `errors`. That split is what keeps
   * the two channels honest: `errors` lists what went wrong, and this reports
   * what came back. On a clean no-fill there is nothing to list but there is
   * still a `responseId`, which is the value an ad-serving investigation
   * actually needs.
   *
   * The single-ad paths reach the same record through `error.responseInfo`,
   * because a single outcome has one payload to hang it on. A load that can
   * report zero or many failures has no such place, so it is surfaced here.
   */
  responseInfo: ResponseInfo | null;
};

/**
 * Outcome of one multi-format load, discriminated on `status`.
 *
 * The status values are the terminal subset of `UseMultiFormatAdStatus`, so a
 * hook consumer and a caller awaiting `load()` branch on the same words.
 *
 * A load never resolves `stale-by-policy`. This library performed the load and
 * returns the handles straight out of its own completion callback, so the
 * observed time starts at hand-off. That is a provenance fact, not a guarantee
 * inherited from `PollResult`.
 */
export type MultiFormatLoadResult = MultiFormatLoadResultBase &
  /** At least one handle, no errors. */
  (| { status: 'loaded'; ads: MultiFormatAdHandle[]; errors: never[] }
    /** At least one handle plus at least one error. */
    | { status: 'loaded-partial'; ads: MultiFormatAdHandle[]; errors: AdError[] }
    /**
     * Request completed with no handle and nothing failed. Routine ad-server
     * outcome, not a defect, so `errors` is empty. Read `responseInfo` for the
     * response id.
     */
    | { status: 'no-fill'; ads: never[]; errors: never[] }
    /** No handle, and at least one leg failed. */
    | { status: 'error'; ads: never[]; errors: AdError[] }
  );
