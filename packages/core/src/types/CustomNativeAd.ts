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

import type { RequestOptions } from './RequestOptions';

/**
 * Who navigates when a Google Ad Manager custom native ad is clicked.
 *
 * - `'app'` (default): the library installs the SDK's custom click handler. The click is still
 *   reported to Ad Manager, but the SDK does not navigate: the app decides where the user goes
 *   (for example after `await ad.performClick(...)`, or on `NativeAdEventType.CUSTOM_CLICK`).
 * - `'sdk'`: no custom click handler is installed. The SDK reports the click and navigates to the
 *   deep link or click-through URL configured on the creative in Ad Manager.
 */
export type CustomNativeClickHandling = 'app' | 'sdk';

export interface CustomNativeAdRequestOptions extends RequestOptions {
  /**
   * Google Ad Manager custom native format IDs to request (for example `'12345678'`).
   *
   * Required and non-empty. IDs are sent exactly as given.
   */
  customFormatIds: string[];
  /**
   * Who navigates on click. Defaults to `'app'`.
   */
  clickHandling?: CustomNativeClickHandling;
}

/**
 * Image asset of a custom native ad. Same shape as `NativeAd` images.
 */
export type CustomNativeAdImage = {
  url: string;
  scale: number;
};

/**
 * One custom native asset, discriminated on `type`.
 *
 * Only text and image assets carry a value. The video asset (`_videoMediaView`) is described by
 * `CustomNativeAd.mediaContent` instead.
 */
export type CustomNativeAsset =
  | { type: 'text'; text: string }
  | { type: 'image'; image: CustomNativeAdImage };

/**
 * Payload of `NativeAdEventType.CUSTOM_CLICK`.
 *
 * Emitted when the SDK has recorded a click and invoked the custom click handler
 * (`clickHandling: 'app'`). The SDK did not navigate; the app decides what happens next.
 */
export type CustomNativeClickEventPayload = {
  /** Asset name the SDK reported, exactly as configured in Ad Manager. */
  assetName: string;
};
