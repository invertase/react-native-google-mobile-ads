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

import { EventSubscription } from 'react-native';
import EventEmitter from 'react-native/Libraries/vendor/emitter/EventEmitter';

import { NativeAdEventType } from '../../NativeAdEventType';
import { isFunction, isOneOf, isString } from '../../common';
import NativeGoogleMobileAdsNativeModule, {
  NativeAdEventPayload,
  NativeAdImage,
  NativeAdProps,
  NativeMediaContent,
} from '../../specs/modules/NativeGoogleMobileAdsNativeModule';
import { NativeAdRequestOptions } from '../../types';
import { validateAdRequestOptions } from '../../validateAdRequestOptions';
import { GoogleMobileAdsNativeEventEmitter } from '../../internal/GoogleMobileAdsNativeEventEmitter';

/**
 * A class for loading Native Ads.
 */
export class NativeAd {
  readonly adUnitId: string;
  readonly responseId: string;
  readonly advertiser: string | null;
  readonly body: string;
  readonly callToAction: string;
  readonly headline: string;
  readonly price: string | null;
  readonly store: string | null;
  readonly starRating: number | null;
  readonly icon: NativeAdImage | null;
  readonly images: Array<NativeAdImage> | null;
  readonly mediaContent: NativeMediaContent | null;
  readonly extras: Record<string, unknown> | null;

  private nativeEventSubscription: EventSubscription;
  private eventEmitter: EventEmitter;

  private constructor(adUnitId: string, props: NativeAdProps) {
    this.adUnitId = adUnitId;
    this.responseId = props.responseId;
    this.advertiser = props.advertiser;
    this.body = props.body;
    this.callToAction = props.callToAction;
    this.headline = props.headline;
    this.price = props.price;
    this.store = props.store;
    this.starRating = props.starRating;
    this.icon = props.icon;
    this.images = props.images;
    this.mediaContent = props.mediaContent;
    this.extras = props.extras as Record<string, unknown>;

    // Codegen EventEmitter was introduced in RN 0.76.2, so we can't apply it for now, due to backward compatibility.
    // if ('onAdEvent' in NativeGoogleMobileAdsNativeModule) {
    //   this.nativeEventSubscription = NativeGoogleMobileAdsNativeModule.onAdEvent(
    //     this.onNativeAdEvent.bind(this),
    //   );
    // }

    this.nativeEventSubscription = GoogleMobileAdsNativeEventEmitter.addListener(
      'RNGMANativeAdEvent',
      this.onNativeAdEvent.bind(this),
    );
    this.eventEmitter = new EventEmitter();
  }

  private onNativeAdEvent({ responseId, type }: NativeAdEventPayload) {
    if (this.responseId !== responseId) {
      return;
    }
    this.eventEmitter.emit(type);
  }

  addAdEventListener(type: NativeAdEventType, listener: () => void) {
    if (!isOneOf(type, Object.values(NativeAdEventType))) {
      throw new Error(`NativeAd.addAdEventListener(*) 'type' expected a valid event type value.`);
    }
    if (!isFunction(listener)) {
      throw new Error(`NativeAd.addAdEventListener(_, *) 'listener' expected a function.`);
    }

    return this.eventEmitter.addListener(type, listener);
  }

  removeAllAdEventListeners() {
    this.eventEmitter.removeAllListeners();
  }

  destroy() {
    NativeGoogleMobileAdsNativeModule.destroy(this.responseId);
    this.nativeEventSubscription.remove();
    this.removeAllAdEventListeners();
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
