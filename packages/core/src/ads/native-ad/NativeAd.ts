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

import { EventSubscription, NativeEventEmitter, Platform } from 'react-native';
import EventEmitter from 'react-native/Libraries/vendor/emitter/EventEmitter';

import { NativeAdEventType } from '../../NativeAdEventType';
import { isFunction, isOneOf, isString } from '../../common';
import { adErrorFromNativeEvent } from '../../internal/adErrorFromNativeEvent';
import NativeGoogleMobileAdsNativeModule, {
  NativeAdEventPayload,
  NativeAdImage,
  NativeAdPaidEventPayload,
  NativeAdProps,
  NativeMediaContent,
} from '../../specs/modules/NativeGoogleMobileAdsNativeModule';
import { NativeAdRequestOptions } from '../../types';
import type { ResponseInfo } from '../../types/ResponseInfo';
import { validateNativeAdRequestOptions } from '../../validateNativeAdRequestOptions';

type NativeAdListenerPayload<EventType extends NativeAdEventType> =
  EventType extends NativeAdEventType.PAID ? NativeAdPaidEventPayload : never;

/**
 * A class for loading Native Ads.
 */
export class NativeAd {
  readonly adUnitId: string;
  readonly responseId: string;
  /**
   * Snapshot of the loaded ad's response info, or null before load / after destroy.
   * Additive; top-level `responseId` remains the registry key.
   */
  readonly responseInfo: ResponseInfo | null;
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
  private destroyed = false;

  private constructor(adUnitId: string, props: NativeAdProps) {
    this.adUnitId = adUnitId;
    this.responseId = props.responseId;
    this.responseInfo = (props.responseInfo as ResponseInfo | null) ?? null;
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

    if ('onAdEvent' in NativeGoogleMobileAdsNativeModule) {
      this.nativeEventSubscription = NativeGoogleMobileAdsNativeModule.onAdEvent(
        this.onNativeAdEvent.bind(this),
      );
    } else {
      let eventEmitter;
      if (Platform.OS === 'ios') {
        eventEmitter = new NativeEventEmitter(NativeGoogleMobileAdsNativeModule);
      } else {
        eventEmitter = new NativeEventEmitter();
      }
      this.nativeEventSubscription = eventEmitter.addListener(
        'RNGMANativeAdEvent',
        this.onNativeAdEvent.bind(this),
      );
    }
    this.eventEmitter = new EventEmitter();
  }

  private onNativeAdEvent({ responseId, type, ...data }: NativeAdEventPayload) {
    if (this.destroyed || this.responseId !== responseId) {
      return;
    }
    this.eventEmitter.emit(type, data);
  }

  addAdEventListener<EventType extends NativeAdEventType>(
    type: EventType,
    listener: (payload: NativeAdListenerPayload<EventType>) => void,
  ) {
    if (this.destroyed) {
      throw new Error('NativeAd.addAdEventListener(*) ad has been destroyed.');
    }
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
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
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
      options = validateNativeAdRequestOptions(requestOptions);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`NativeAd.createForAdRequest(_, *) ${e.message}.`);
      }
    }

    const props = await NativeGoogleMobileAdsNativeModule.load(adUnitId, options).catch(
      (nativeError: unknown) => {
        throw nativeAdErrorFromRejection(nativeError);
      },
    );

    return new NativeAd(adUnitId, props);
  }

  /**
   * Hydrate a NativeAd from an already-loaded native payload (multi-format path).
   * Does not issue a second network request. Package-internal.
   */
  static fromLoadedProps(adUnitId: string, props: NativeAdProps): NativeAd {
    return new NativeAd(adUnitId, props);
  }
}

/**
 * Normalize a TurboModule / bridge rejection into `Error & AdErrorPayload`.
 * Native attaches `reason` / `phase` / optional `responseInfo` on the userInfo map;
 * iOS keeps legacy `ERROR_LOAD` as `code`.
 */
function nativeAdErrorFromRejection(nativeError: unknown) {
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
  // RN may namespace the reject code; strip to the wire token for reason mapping.
  const slash = code.lastIndexOf('/');
  if (slash >= 0) {
    code = code.slice(slash + 1);
  }
  return adErrorFromNativeEvent(
    {
      code,
      message: userInfo.message ?? err.message ?? 'Native ad failed to load',
      reason: userInfo.reason,
      phase: userInfo.phase,
      responseInfo: userInfo.responseInfo,
    },
    'googleMobileAds',
    'load',
  );
}
