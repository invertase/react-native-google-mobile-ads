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
import { hasOwnProperty, isFunction, isNumber, isObject, isOneOf, isString } from '../../common';
import { adErrorFromNativeEvent } from '../../internal/adErrorFromNativeEvent';
import NativeGoogleMobileAdsNativeModule, {
  CustomNativeAdProps,
  NativeAdEventPayload,
  NativeAdPaidEventPayload,
  NativeMediaContent,
} from '../../specs/modules/NativeGoogleMobileAdsNativeModule';
import type {
  CustomNativeAdImage,
  CustomNativeAdRequestOptions,
  CustomNativeAsset,
  CustomNativeClickEventPayload,
  CustomNativeClickHandling,
} from '../../types/CustomNativeAd';
import type { ResponseInfo } from '../../types/ResponseInfo';
import { validateCustomNativeAdRequestOptions } from '../../validateCustomNativeAdRequestOptions';

type CustomNativeAdListenerPayload<EventType extends NativeAdEventType> =
  EventType extends NativeAdEventType.PAID
    ? NativeAdPaidEventPayload
    : EventType extends NativeAdEventType.CUSTOM_CLICK
      ? CustomNativeClickEventPayload
      : never;

/**
 * Builds a null-prototype asset map from the bridge payload so asset names such as
 * `constructor` cannot collide with `Object.prototype`. Names are kept verbatim.
 */
function assetsFromNative(raw: unknown): Readonly<Record<string, CustomNativeAsset>> {
  const out = Object.create(null) as Record<string, CustomNativeAsset>;
  if (!isObject(raw)) {
    return out;
  }
  for (const name of Object.keys(raw as object)) {
    const entry = (raw as Record<string, unknown>)[name] as
      | { type?: unknown; text?: unknown; image?: { url?: unknown; scale?: unknown } | null }
      | null
      | undefined;
    if (!entry) {
      continue;
    }
    if (entry.type === 'text' && isString(entry.text)) {
      out[name] = { type: 'text', text: entry.text };
    } else if (
      entry.type === 'image' &&
      entry.image &&
      isString(entry.image.url) &&
      entry.image.url.length > 0
    ) {
      out[name] = {
        type: 'image',
        image: {
          url: entry.image.url,
          scale: isNumber(entry.image.scale) ? entry.image.scale : 1,
        },
      };
    }
  }
  return Object.freeze(out);
}

/**
 * A Google Ad Manager custom native ad (custom native ad format).
 *
 * Unlike `NativeAd`, a custom native ad has no system-defined assets and is not rendered with
 * `NativeAdView`: read its assets by their exact Ad Manager names and build the UI yourself. You
 * must call `recordImpression()` when the ad is shown and `performClick(assetName)` when the user
 * taps it; the SDK does not track views for custom native ads.
 */
export class CustomNativeAd {
  readonly adUnitId: string;
  /** Library registry key. Stable for the lifetime of this ad. */
  readonly adId: string;
  /** SDK response id, or null when the backend does not expose one (classic Android). */
  readonly responseId: string | null;
  readonly responseInfo: ResponseInfo | null;
  /** The Ad Manager custom native format ID that served this ad. */
  readonly customFormatId: string;
  /** Every asset name the creative carries, verbatim (case-sensitive). */
  readonly availableAssetNames: ReadonlyArray<string>;
  /** Text and image assets keyed by their exact Ad Manager name. */
  readonly assets: Readonly<Record<string, CustomNativeAsset>>;
  /** Video asset description, or null when the creative has no media content. */
  readonly mediaContent: NativeMediaContent | null;
  readonly clickHandling: CustomNativeClickHandling;

  private nativeEventSubscription: EventSubscription;
  private eventEmitter: EventEmitter;
  private destroyed = false;

  private constructor(
    adUnitId: string,
    props: CustomNativeAdProps,
    clickHandling: CustomNativeClickHandling,
  ) {
    this.adUnitId = adUnitId;
    this.adId = props.adId;
    this.responseId = props.responseId ?? null;
    this.responseInfo = (props.responseInfo as ResponseInfo | null) ?? null;
    this.customFormatId = props.customFormatId;
    this.availableAssetNames = Object.freeze([...props.availableAssetNames]);
    this.assets = assetsFromNative(props.assets);
    this.mediaContent = props.mediaContent ?? null;
    this.clickHandling = clickHandling;

    // Same subscription strategy as NativeAd (shared native event channel).
    if ('onAdEvent' in NativeGoogleMobileAdsNativeModule) {
      this.nativeEventSubscription = NativeGoogleMobileAdsNativeModule.onAdEvent(
        this.onNativeAdEvent.bind(this),
      );
    } else {
      const eventEmitter =
        Platform.OS === 'ios'
          ? new NativeEventEmitter(NativeGoogleMobileAdsNativeModule)
          : new NativeEventEmitter();
      this.nativeEventSubscription = eventEmitter.addListener(
        'RNGMANativeAdEvent',
        this.onNativeAdEvent.bind(this),
      );
    }
    this.eventEmitter = new EventEmitter();
  }

  private onNativeAdEvent({ responseId, type, ...data }: NativeAdEventPayload) {
    // Custom native events are keyed by adId (sent as `responseId` on the shared emitter).
    if (this.destroyed || this.adId !== responseId) {
      return;
    }
    this.eventEmitter.emit(type, data);
  }

  /**
   * Returns the text asset named `assetName` (exact, case-sensitive), or null when the creative
   * has no such text asset.
   */
  getText(assetName: string): string | null {
    const asset = this.getAsset(assetName);
    return asset?.type === 'text' ? asset.text : null;
  }

  /**
   * Returns the image asset named `assetName` (exact, case-sensitive), or null when the creative
   * has no such image asset.
   */
  getImage(assetName: string): CustomNativeAdImage | null {
    const asset = this.getAsset(assetName);
    return asset?.type === 'image' ? asset.image : null;
  }

  /**
   * Returns the asset named `assetName` (exact, case-sensitive), or null when missing.
   */
  getAsset(assetName: string): CustomNativeAsset | null {
    if (!isString(assetName) || !hasOwnProperty(this.assets, assetName)) {
      return null;
    }
    // Own property confirmed above, so the entry exists.
    return this.assets[assetName];
  }

  /**
   * Records an impression. Call once the ad is visible; the SDK drops repeats for the same ad.
   */
  recordImpression() {
    if (this.destroyed) {
      throw new Error('CustomNativeAd.recordImpression() ad has been destroyed.');
    }
    NativeGoogleMobileAdsNativeModule.recordCustomNativeImpression(this.adId);
  }

  /**
   * Reports a click on `assetName` to Google Ad Manager. The library never navigates.
   *
   * With `clickHandling: 'app'` the SDK records the click and calls the custom click handler
   * instead of navigating, which emits `NativeAdEventType.CUSTOM_CLICK`. Navigate however the app
   * prefers once this resolves (deep link, router, in-app browser, …).
   *
   * With `clickHandling: 'sdk'` the SDK navigates to the creative's own click-through.
   *
   * Resolves once the SDK has been told about the click. Rejects when the ad is unknown to native
   * (for example after `destroy()`).
   */
  async performClick(assetName: string) {
    if (this.destroyed) {
      throw new Error('CustomNativeAd.performClick(*) ad has been destroyed.');
    }
    if (!isString(assetName) || assetName.length === 0) {
      throw new Error("CustomNativeAd.performClick(*) 'assetName' expected a non-empty string.");
    }
    await NativeGoogleMobileAdsNativeModule.performCustomNativeClick(this.adId, assetName).catch(
      (nativeError: unknown) => {
        throw customNativeErrorFromRejection(nativeError, 'show', 'Custom native click failed');
      },
    );
  }

  addAdEventListener<EventType extends NativeAdEventType>(
    type: EventType,
    listener: (payload: CustomNativeAdListenerPayload<EventType>) => void,
  ) {
    if (this.destroyed) {
      throw new Error('CustomNativeAd.addAdEventListener(*) ad has been destroyed.');
    }
    if (!isOneOf(type, Object.values(NativeAdEventType))) {
      throw new Error(
        `CustomNativeAd.addAdEventListener(*) 'type' expected a valid event type value.`,
      );
    }
    if (!isFunction(listener)) {
      throw new Error(`CustomNativeAd.addAdEventListener(_, *) 'listener' expected a function.`);
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
    NativeGoogleMobileAdsNativeModule.destroy(this.adId);
    this.nativeEventSubscription.remove();
    this.removeAllAdEventListeners();
  }

  /**
   * Loads a Google Ad Manager custom native ad.
   *
   * #### Example
   *
   * ```js
   * import { CustomNativeAd, NativeAdEventType } from 'react-native-google-mobile-ads';
   *
   * const ad = await CustomNativeAd.createForAdRequest('/1234/carousel', {
   *   customFormatIds: ['12345678'],
   * });
   * const cta = ad.getText('Calltoaction');
   * const image = ad.getImage('Secondaryimage');
   * ad.recordImpression();
   * // on tap: report the click, then navigate however the app prefers
   * await ad.performClick('Calltoaction');
   * openInAppBrowser(ad.getText('Clickurl'));
   * ```
   *
   * @param adUnitId Google Ad Manager ad unit ID.
   * @param requestOptions Request options; `customFormatIds` is required.
   */
  static async createForAdRequest(
    adUnitId: string,
    requestOptions: CustomNativeAdRequestOptions,
  ): Promise<CustomNativeAd> {
    if (!isString(adUnitId) || adUnitId.length === 0) {
      throw new Error("CustomNativeAd.createForAdRequest(*) 'adUnitId' expected a string value.");
    }
    if (adUnitId.startsWith('ca-app-pub-')) {
      throw new Error(
        "CustomNativeAd.createForAdRequest(*) 'adUnitId' custom native formats require a Google Ad Manager unit, not an AdMob unit.",
      );
    }

    let options: ReturnType<typeof validateCustomNativeAdRequestOptions>;
    try {
      options = validateCustomNativeAdRequestOptions(requestOptions);
    } catch (e) {
      throw new Error(`CustomNativeAd.createForAdRequest(_, *) ${(e as Error).message}.`);
    }

    const props = await NativeGoogleMobileAdsNativeModule.loadCustomNative(adUnitId, options).catch(
      (nativeError: unknown) => {
        throw customNativeErrorFromRejection(
          nativeError,
          'load',
          'Custom native ad failed to load',
        );
      },
    );

    return new CustomNativeAd(adUnitId, props, options.clickHandling);
  }

  /**
   * Hydrate from an already-loaded native payload (multi-format path). Package-internal.
   */
  static fromLoadedProps(
    adUnitId: string,
    props: CustomNativeAdProps,
    clickHandling: CustomNativeClickHandling,
  ): CustomNativeAd {
    return new CustomNativeAd(adUnitId, props, clickHandling);
  }
}

/**
 * Normalize a TurboModule rejection into `Error & AdErrorPayload` (same shape as `NativeAd`).
 */
function customNativeErrorFromRejection(
  nativeError: unknown,
  phase: 'load' | 'show',
  fallbackMessage: string,
) {
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
  return adErrorFromNativeEvent(
    {
      code,
      message: userInfo.message ?? err.message ?? fallbackMessage,
      reason: userInfo.reason,
      phase: userInfo.phase ?? phase,
      responseInfo: userInfo.responseInfo,
    },
    'googleMobileAds',
    phase,
  );
}
