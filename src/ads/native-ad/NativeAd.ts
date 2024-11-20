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

import { isString } from '../../common';
import { validateAdRequestOptions } from '../../validateAdRequestOptions';
import { NativeAdRequestOptions } from '../../types';
import NativeGoogleMobileAdsNativeModule, {
  NativeAdImage,
  NativeAdProps,
  NativeMediaContent,
} from '../../specs/modules/NativeGoogleMobileAdsNativeModule';

/**
 * A class for loading Native Ads.
 */
export class NativeAd {
  adUnitId: string;
  responseId!: string;
  advertiser!: string | null;
  body!: string | null;
  callToAction!: string | null;
  headline!: string | null;
  price!: string | null;
  store!: string | null;
  starRating!: number | null;
  icon!: NativeAdImage | null;
  images!: Array<NativeAdImage> | null;
  mediaContent!: NativeMediaContent | null;
  extras!: Record<string, unknown> | null;

  constructor(adUnitId: string, props: NativeAdProps) {
    this.adUnitId = adUnitId;
    Object.assign(this, props);
  }

  /**
   * Creates a new NativeAd instance.
   *
   * #### Example
   *
   * ```js
   * import { NativeAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
   *
   * const nativeAd = await NativeAd.createForAdRequest(TestIds.NATIVE, {
   *   requestAgent: 'CoolAds',
   * });
   * ```
   *
   * @param adUnitId The Ad Unit ID for the Native Ad. You can find this on your Google Mobile Ads dashboard.
   * @param requestOptions Optional RequestOptions used to load the ad.
   */
  static async createForAdRequest(
    adUnitId: string,
    requestOptions?: NativeAdRequestOptions,
  ): Promise<NativeAd> {
    if (!isString(adUnitId)) {
      throw new Error("NativeAd.createForAdRequest(*) 'adUnitId' expected an string value.");
    }

    let options = {};
    try {
      options = validateAdRequestOptions(requestOptions);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`NativeAd.createForAdRequest(_, *) ${e.message}.`);
      }
    }

    const props = await NativeGoogleMobileAdsNativeModule.load(adUnitId, options);

    return new NativeAd(adUnitId, props);
  }
}
