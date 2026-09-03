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

import type { AdError } from '../types/AdError';
import type {
  MultiFormatAdConfig,
  MultiFormatAdHandle,
  MultiFormatAdRequestOptions,
} from '../types/MultiFormatAd';
import type { ResponseInfo } from '../types/ResponseInfo';

/**
 * One AdLoader / GADAdLoader request that may return native and/or GAM banner.
 *
 * Multi-format means several formats compete for one ad. It is not multi-count:
 * `requestCount` stays 1 in v1.
 *
 * Stub: load() rejects until native wiring lands.
 */
export class MultiFormatAdRequest {
  readonly adUnitId: string;
  readonly options: MultiFormatAdRequestOptions;

  private constructor(config: MultiFormatAdConfig) {
    this.adUnitId = config.adUnitId;
    this.options = config.requestOptions;
  }

  /**
   * Builds a request from one config object, the same object
   * `useMultiFormatAd` accepts, mirroring how `AdPools.create` takes a single
   * `AdPoolConfig`.
   *
   * Stub today: synchronously stores the supplied config without validation.
   * The wired implementation is intended to reject every documented illegal
   * shape consistently, rather than exposing a partial JS-only validator.
   */
  static create(config: MultiFormatAdConfig): MultiFormatAdRequest {
    return new MultiFormatAdRequest(config);
  }

  /**
   * Imperative load. The caller owns every returned handle: `destroy()` it, and
   * evaluate `isStaleByPolicy()` before rendering, since a handle can cross the
   * configured window between load and render. The policy timer lives on the
   * handle; subscribe with `onStaleByPolicy` while holding if needed.
   *
   * Resolves the raw triple rather than a `MultiFormatLoadResult`, so there is
   * no `status` word on this path: both arrays empty is a clean no-fill, a
   * non-empty `errors` with a handle is the partial case, and a non-empty
   * `errors` with no handle is a failure. `responseInfo` is the ad server's
   * record of the response and is populated even on a clean no-fill, because a
   * response record is not a failure and so does not belong in `errors`.
   *
   * Errors carry the structured `AdErrorPayload` fields as well as being real
   * `Error` objects, the same `AdError` shape the hooks expose.
   */
  load(): Promise<{
    ads: MultiFormatAdHandle[];
    errors: AdError[];
    responseInfo: ResponseInfo | null;
  }> {
    return Promise.reject(new Error('MultiFormatAdRequest.load is not implemented'));
  }

  destroy(): void {
    // no-op stub
  }
}
