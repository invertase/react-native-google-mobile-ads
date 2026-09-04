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

import { createAdExpiry } from '../internal/adExpiry';
import { adErrorFromNativeEvent, reasonFromNativeCode } from '../internal/adErrorFromNativeEvent';
import { NativeError } from '../internal/NativeError';
import NativeGoogleMobileAdsNativeModule, {
  MultiFormatNativeLoadResult,
  NativeAdProps,
} from '../specs/modules/NativeGoogleMobileAdsNativeModule';
import type { AdError } from '../types/AdError';
import { AdFormat } from '../types/AdFormat';
import type {
  MultiFormatAdConfig,
  MultiFormatAdHandle,
  MultiFormatAdRequestOptions,
} from '../types/MultiFormatAd';
import type { ResponseInfo } from '../types/ResponseInfo';
import { validateMultiFormatAdConfig } from '../validateMultiFormatAdConfig';
import { NativeAd } from './native-ad/NativeAd';

function asAdError(error: unknown, fallbackMessage: string): AdError {
  if (error && typeof error === 'object' && 'reason' in error && 'phase' in error) {
    return error as AdError;
  }
  if (error instanceof Error) {
    const wrapped = NativeError.fromEvent(
      { code: 'invalid-request', message: error.message },
      'googleMobileAds/multi-format',
    ) as AdError;
    wrapped.reason = 'invalid-request';
    wrapped.phase = 'load';
    return wrapped;
  }
  return adErrorFromNativeEvent(
    { code: 'unknown', message: fallbackMessage },
    'googleMobileAds/multi-format',
    'load',
  );
}

function mapNativeError(error: NonNullable<MultiFormatNativeLoadResult['error']>): AdError {
  return adErrorFromNativeEvent(
    {
      code: error.code,
      message: error.message,
      reason: error.reason,
      phase: (error.phase as 'load' | 'show' | undefined) ?? 'load',
      responseInfo: error.responseInfo as ResponseInfo | undefined,
    },
    'googleMobileAds/multi-format',
    'load',
  );
}

function isCleanNoFill(error: AdError | null | undefined): boolean {
  if (!error) {
    return true;
  }
  return error.reason === 'no-fill' || error.reason === 'mediation-no-fill';
}

/**
 * One AdLoader / GADAdLoader request that may return native and/or GAM banner.
 *
 * Multi-format means several formats compete for one ad. It is not multi-count:
 * `requestCount` stays 1 in v1.
 */
export class MultiFormatAdRequest {
  readonly adUnitId: string;
  readonly options: MultiFormatAdRequestOptions;

  private destroyed = false;
  private ownedHandleIds = new Set<string>();
  private readonly bridgeOptions: Record<string, unknown>;

  private constructor(config: MultiFormatAdConfig) {
    const validated = validateMultiFormatAdConfig(config);
    this.adUnitId = validated.adUnitId;
    this.options = validated.requestOptions as MultiFormatAdRequestOptions;
    this.bridgeOptions = validated.requestOptions as unknown as Record<string, unknown>;
  }

  /**
   * Builds a request from one config object, the same object
   * `useMultiFormatAd` accepts, mirroring how `AdPools.create` takes a single
   * `AdPoolConfig`.
   *
   * Throws synchronously when the config cannot be honored without dropping a
   * format or inventing an API (empty formats, banner without sizes, illegal
   * sizes, AdMob unit + banner, requestCount ≠ 1).
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
   */
  async load(): Promise<{
    ads: MultiFormatAdHandle[];
    errors: AdError[];
    responseInfo: ResponseInfo | null;
  }> {
    if (this.destroyed) {
      throw asAdError(
        new Error('MultiFormatAdRequest.load(*) request has been destroyed.'),
        'request destroyed',
      );
    }

    let nativeResult: MultiFormatNativeLoadResult;
    try {
      nativeResult = await NativeGoogleMobileAdsNativeModule.loadMultiFormat(
        this.adUnitId,
        this.bridgeOptions,
      );
    } catch (nativeError: unknown) {
      const err = nativeError as {
        code?: string;
        message?: string;
        userInfo?: {
          code?: string;
          message?: string;
          reason?: string;
          phase?: 'load' | 'show';
          responseInfo?: ResponseInfo;
        };
      };
      const userInfo = err.userInfo ?? {};
      let code = userInfo.code ?? err.code ?? 'unknown';
      const slash = code.lastIndexOf('/');
      if (slash >= 0) {
        code = code.slice(slash + 1);
      }
      const mapped = adErrorFromNativeEvent(
        {
          code,
          message: userInfo.message ?? err.message ?? 'Multi-format ad failed to load',
          reason: userInfo.reason ?? reasonFromNativeCode(code),
          phase: userInfo.phase,
          responseInfo: userInfo.responseInfo,
        },
        'googleMobileAds/multi-format',
        'load',
      );
      if (isCleanNoFill(mapped)) {
        return {
          ads: [],
          errors: [],
          responseInfo: mapped.responseInfo ?? null,
        };
      }
      return {
        ads: [],
        errors: [mapped],
        responseInfo: mapped.responseInfo ?? null,
      };
    }

    const topResponseInfo = (nativeResult.responseInfo as ResponseInfo | null) ?? null;
    const nativeError = nativeResult.error ? mapNativeError(nativeResult.error) : null;

    if (nativeResult.format === 'none' || !nativeResult.handleId) {
      if (isCleanNoFill(nativeError)) {
        return {
          ads: [],
          errors: [],
          responseInfo: topResponseInfo ?? nativeError?.responseInfo ?? null,
        };
      }
      return {
        ads: [],
        errors: nativeError ? [nativeError] : [],
        responseInfo: topResponseInfo ?? nativeError?.responseInfo ?? null,
      };
    }

    const observedAt = Date.now();
    const expiry = createAdExpiry({
      observedAt,
      stalenessWindowMillis: this.options.stalenessWindowMillis,
      format: 'other',
    });
    const handleId = nativeResult.handleId;
    this.ownedHandleIds.add(handleId);

    const destroyBanner = () => {
      if (!this.ownedHandleIds.has(handleId)) {
        return;
      }
      this.ownedHandleIds.delete(handleId);
      expiry.clear();
      NativeGoogleMobileAdsNativeModule.destroyHandle(handleId);
    };

    if (nativeResult.format === 'native') {
      const props: NativeAdProps = {
        responseId: nativeResult.responseId ?? handleId,
        advertiser: nativeResult.advertiser ?? null,
        body: nativeResult.body ?? '',
        callToAction: nativeResult.callToAction ?? '',
        headline: nativeResult.headline ?? '',
        price: nativeResult.price ?? null,
        store: nativeResult.store ?? null,
        starRating: nativeResult.starRating ?? null,
        icon: nativeResult.icon ?? null,
        images: nativeResult.images ?? null,
        mediaContent: nativeResult.mediaContent ?? {
          aspectRatio: 0,
          hasVideoContent: false,
          duration: 0,
        },
        extras: nativeResult.extras ?? null,
        responseInfo: nativeResult.responseInfo ?? null,
      };
      const ad = NativeAd.fromLoadedProps(this.adUnitId, props);
      const handle: MultiFormatAdHandle = {
        format: AdFormat.NATIVE,
        adId: handleId,
        observedAt,
        provenance: 'pool/emulated-no-sdk-preloader',
        responseInfo: (props.responseInfo as ResponseInfo | null) ?? topResponseInfo,
        stalenessWindowMillis: expiry.stalenessWindowMillis,
        stalenessWindowSource: expiry.stalenessWindowSource,
        isStaleByPolicy: () => expiry.isStaleByPolicy(),
        onStaleByPolicy: listener => expiry.onStaleByPolicy(listener),
        ad,
        destroy: () => {
          if (!this.ownedHandleIds.has(handleId)) {
            return;
          }
          this.ownedHandleIds.delete(handleId);
          expiry.clear();
          ad.destroy();
          // Also drop multi-format handle bookkeeping if native used handleId ≠ responseId.
          if (handleId !== props.responseId) {
            NativeGoogleMobileAdsNativeModule.destroyHandle(handleId);
          }
        },
      };
      return {
        ads: [handle],
        errors: nativeError && !isCleanNoFill(nativeError) ? [nativeError] : [],
        responseInfo: handle.responseInfo,
      };
    }

    const handle: MultiFormatAdHandle = {
      format: AdFormat.BANNER,
      adId: handleId,
      observedAt,
      provenance: 'pool/emulated-no-sdk-preloader',
      responseInfo: topResponseInfo,
      stalenessWindowMillis: expiry.stalenessWindowMillis,
      stalenessWindowSource: expiry.stalenessWindowSource,
      isStaleByPolicy: () => expiry.isStaleByPolicy(),
      onStaleByPolicy: listener => expiry.onStaleByPolicy(listener),
      size: {
        width: nativeResult.width ?? 0,
        height: nativeResult.height ?? 0,
      },
      destroy: destroyBanner,
    };
    return {
      ads: [handle],
      errors: nativeError && !isCleanNoFill(nativeError) ? [nativeError] : [],
      responseInfo: topResponseInfo,
    };
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    for (const handleId of [...this.ownedHandleIds]) {
      this.ownedHandleIds.delete(handleId);
      NativeGoogleMobileAdsNativeModule.destroyHandle(handleId);
    }
  }
}
