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

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type {
  Double,
  Float,
  UnsafeObject,
  EventEmitter,
} from 'react-native/Libraries/Types/CodegenTypes';

export type NativeAdProps = {
  responseId: string;
  advertiser: string | null;
  body: string;
  callToAction: string;
  headline: string;
  price: string | null;
  store: string | null;
  starRating: Double | null;
  icon: NativeAdImage | null;
  images: Array<NativeAdImage> | null;
  mediaContent: NativeMediaContent;
  extras: UnsafeObject | null;
  /** Privacy-filtered ResponseInfo snapshot when native attach succeeded. */
  responseInfo?: UnsafeObject | null;
};

export type NativeAdImage = {
  url: string;
  scale: Double;
};

export type NativeMediaContent = {
  aspectRatio: Float;
  hasVideoContent: boolean;
  duration: Float;
};

/**
 * Loaded Google Ad Manager custom native ad.
 *
 * `adId` is the library registry key (also the `responseId` on emitted events). `responseId` is
 * the SDK response id when the backend exposes one (null on classic Android).
 * `assets` maps exact asset names to `{ type: 'text', text }` or `{ type: 'image', image }`.
 */
export type CustomNativeAdProps = {
  adId: string;
  responseId: string | null;
  customFormatId: string;
  availableAssetNames: Array<string>;
  assets: UnsafeObject;
  mediaContent: NativeMediaContent | null;
  responseInfo?: UnsafeObject | null;
};

export type NativeAdEventPayload = {
  responseId: string;
  type: string;
};

export type NativeAdPaidEventPayload = {
  value: number;
  precision: number;
  /** Public paid key is `currency` (native GMA field is currencyCode). */
  currency: string;
  valueMicros?: string | null;
  responseInfo?: UnsafeObject;
};

/**
 * Count-1 multi-format AdLoader result.
 *
 * `format: 'none'` is a completed request with no winner (clean no-fill or a
 * failed load). When `error` is absent or reason is `no-fill`, JS treats it as
 * clean no-fill. Other error reasons become `errors[]` entries.
 */
export type MultiFormatNativeLoadResult = {
  format: 'native' | 'banner' | 'customNative' | 'none';
  /** Library/native registry id; used for banner attach and destroyHandle. */
  handleId?: string;
  responseId?: string;
  advertiser?: string | null;
  body?: string;
  callToAction?: string;
  headline?: string;
  price?: string | null;
  store?: string | null;
  starRating?: Double | null;
  icon?: NativeAdImage | null;
  images?: Array<NativeAdImage> | null;
  mediaContent?: NativeMediaContent | null;
  extras?: UnsafeObject | null;
  /** Custom native winner only (`format: 'customNative'`); `handleId` is its `adId`. */
  customFormatId?: string;
  availableAssetNames?: Array<string> | null;
  assets?: UnsafeObject | null;
  width?: Double;
  height?: Double;
  responseInfo?: UnsafeObject | null;
  error?: {
    code: string;
    message: string;
    reason?: string;
    phase?: string;
    responseInfo?: UnsafeObject | null;
  } | null;
};

export interface Spec extends TurboModule {
  load(adUnitId: string, requestOptions: UnsafeObject): Promise<NativeAdProps>;
  destroy(responseId: string): void;
  /**
   * One AdLoader request: native and/or GAM banner compete (count 1).
   * Settles on loader completion; never fans out multiple loads.
   */
  loadMultiFormat(
    adUnitId: string,
    requestOptions: UnsafeObject,
  ): Promise<MultiFormatNativeLoadResult>;
  /** Destroys multi-format banner (or native) inventory keyed by handleId. */
  destroyHandle(handleId: string): void;
  /**
   * Loads one Google Ad Manager custom native ad for `requestOptions.customFormatIds`.
   * Release with `destroy(adId)`.
   */
  loadCustomNative(adUnitId: string, requestOptions: UnsafeObject): Promise<CustomNativeAdProps>;
  /**
   * Reports a click on `assetName` to the SDK. With `clickHandling: 'app'` the SDK then invokes
   * the custom click handler instead of navigating, which emits `custom_click`.
   */
  performCustomNativeClick(adId: string, assetName: string): Promise<void>;
  /** Records an impression; the SDK ignores repeats for the same ad. */
  recordCustomNativeImpression(adId: string): void;
  readonly onAdEvent: EventEmitter<NativeAdEventPayload>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNGoogleMobileAdsNativeModule');
