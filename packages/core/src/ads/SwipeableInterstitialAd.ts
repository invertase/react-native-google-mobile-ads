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

import { EmitterSubscription } from 'react-native';
import { isFunction, isOneOf, isString } from '../common';
import {
  adErrorFromNativeEvent,
  parseResponseInfoPayload,
} from '../internal/adErrorFromNativeEvent';
import { AdEventType } from '../AdEventType';
import { SwipeableInterstitialAdEventType } from '../SwipeableInterstitialAdEventType';
import { SharedEventEmitter } from '../internal/SharedEventEmitter';
import { validateSwipeableInterstitialAdRequestOptions } from '../validateSwipeableInterstitialAdRequestOptions';
import { allocateFullscreenRequestId } from '../internal/fullscreenRequestIds';
import NativeSwipeableInterstitialAdModule from '../specs/modules/NativeSwipeableInterstitialAdModule';
import type { AdEventListener, AdEventPayload } from '../types/AdEventListener';
import type { AdEventsListener } from '../types/AdEventsListener';
import type { SwipeableInterstitialAdRequestOptions } from '../types/SwipeableInterstitialAdRequestOptions';
import type { ResponseInfo } from '../types/ResponseInfo';
import { GAMAdEventType } from '../GAMAdEventType';
import type { AppEvent } from '../types/AppEvent';
import type { PaidEvent } from '../types/PaidEventListener';

/** @internal */
type SwipeableInterstitialEventType =
  | AdEventType
  | SwipeableInterstitialAdEventType
  | GAMAdEventType;

/** @internal */
type SwipeableInterstitialLoadedPayload = {
  minScreenHoldDuration?: number;
  isCustomClickGestureEnabled?: boolean;
  responseInfo?: ResponseInfo;
};

/**
 * Swipeable interstitial ads — **Private beta** (Google allowlist) on iOS (GMA ≥ 13.5) and
 * Android Next-Gen.
 *
 * Classic Android reports `getAdCapabilities().swipeableInterstitial === 'unavailable'`.
 * Presentation is view-based: mount {@link SwipeableInterstitialAdView} after
 * {@link AdEventType.LOADED}.
 *
 * @remarks
 * Upstream private-beta APIs may change and require Google account-manager allowlisting.
 */
export class SwipeableInterstitialAd {
  protected _requestId: number;
  protected _adUnitId: string;
  protected _requestOptions: SwipeableInterstitialAdRequestOptions;
  protected _loaded: boolean;
  protected _isLoadCalled: boolean;
  protected _destroyed: boolean;
  protected _adEventsListeners: Map<number, AdEventsListener<SwipeableInterstitialEventType>>;
  protected _adEventListenersMap: Map<
    SwipeableInterstitialEventType,
    Map<number, AdEventListener<SwipeableInterstitialEventType>>
  >;
  protected _adEventsListenerId: number;
  protected _adEventListenerId: number;
  protected _nativeListener: EmitterSubscription;
  protected _responseInfo: ResponseInfo | null;
  protected _minScreenHoldDuration: number;
  protected _isCustomClickGestureEnabled: boolean;

  protected constructor(
    requestId: number,
    adUnitId: string,
    requestOptions: SwipeableInterstitialAdRequestOptions,
  ) {
    this._requestId = requestId;
    this._adUnitId = adUnitId;
    this._requestOptions = requestOptions;
    this._loaded = false;
    this._isLoadCalled = false;
    this._destroyed = false;
    this._responseInfo = null;
    this._minScreenHoldDuration = 0;
    this._isCustomClickGestureEnabled = false;
    this._adEventsListeners = new Map();
    this._adEventListenersMap = new Map();
    Object.values({
      ...AdEventType,
      ...SwipeableInterstitialAdEventType,
      ...GAMAdEventType,
    }).forEach(type => {
      this._adEventListenersMap.set(type as SwipeableInterstitialEventType, new Map());
    });
    this._adEventListenerId = 0;
    this._adEventsListenerId = 0;

    this._nativeListener = SharedEventEmitter.addListener(
      `google_mobile_ads_swipeable_interstitial_event:${adUnitId}:${requestId}`,
      this._handleAdEvent.bind(this),
    );
  }

  /**
   * Creates a SwipeableInterstitialAd instance (private beta).
   */
  static createForAdRequest(
    adUnitId: string,
    requestOptions?: SwipeableInterstitialAdRequestOptions,
  ) {
    if (!isString(adUnitId)) {
      throw new Error(
        "SwipeableInterstitialAd.createForAdRequest(*) 'adUnitId' expected an string value.",
      );
    }

    let options: SwipeableInterstitialAdRequestOptions;
    try {
      options = validateSwipeableInterstitialAdRequestOptions(requestOptions);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`SwipeableInterstitialAd.createForAdRequest(_, *) ${e.message}.`);
      }
      throw e;
    }

    const requestId = allocateFullscreenRequestId();
    return new SwipeableInterstitialAd(requestId, adUnitId, options);
  }

  protected _applyLoadedMetadata(data: SwipeableInterstitialLoadedPayload) {
    if (data.minScreenHoldDuration !== undefined) {
      this._minScreenHoldDuration = data.minScreenHoldDuration;
    }
    if (data.isCustomClickGestureEnabled !== undefined) {
      this._isCustomClickGestureEnabled = data.isCustomClickGestureEnabled;
    }
  }

  protected _handleAdEvent(event: {
    body: {
      type: SwipeableInterstitialEventType;
      error?: {
        code: string;
        message: string;
        responseInfo?: ResponseInfo;
        responseInfoJson?: string;
        reason?: string;
        phase?: 'load' | 'show';
      };
      data?:
        | (AppEvent & { responseInfo?: ResponseInfo })
        | (PaidEvent & { responseInfo?: ResponseInfo })
        | (SwipeableInterstitialLoadedPayload & { responseInfo?: ResponseInfo });
    };
  }) {
    if (this._destroyed) {
      return;
    }

    const { type, error, data } = event.body;
    const nestedResponseInfo =
      parseResponseInfoPayload(data) ?? parseResponseInfoPayload(error) ?? undefined;

    if (type === AdEventType.LOADED) {
      this._loaded = true;
      if (nestedResponseInfo) {
        this._responseInfo = nestedResponseInfo;
      }
      if (data && typeof data === 'object') {
        this._applyLoadedMetadata(data as SwipeableInterstitialLoadedPayload);
      }
    }

    if (type === AdEventType.ERROR) {
      this._loaded = false;
      this._isLoadCalled = false;
      if (nestedResponseInfo) {
        this._responseInfo = nestedResponseInfo;
      }
    }

    let payload: AdEventPayload<SwipeableInterstitialEventType>;
    if (error) {
      payload = adErrorFromNativeEvent(
        error,
        'googleMobileAds',
        'load',
      ) as AdEventPayload<SwipeableInterstitialEventType>;
    } else if (
      type === AdEventType.LOADED &&
      data &&
      typeof data === 'object' &&
      'responseInfo' in data
    ) {
      const rest = { ...(data as Record<string, unknown>) };
      delete rest.responseInfo;
      payload = (
        Object.keys(rest).length > 0 ? rest : undefined
      ) as AdEventPayload<SwipeableInterstitialEventType>;
    } else {
      payload = data as AdEventPayload<SwipeableInterstitialEventType>;
    }

    this._adEventsListeners.forEach(listener => {
      listener({ type, payload });
    });
    this._getAdEventListeners(type).forEach(listener => {
      listener(payload);
    });
  }

  public load() {
    if (this._destroyed) {
      return;
    }
    if (this._loaded || this._isLoadCalled) {
      return;
    }
    this._isLoadCalled = true;
    this._responseInfo = null;
    NativeSwipeableInterstitialAdModule.swipeableInterstitialLoad(
      this._requestId,
      this._adUnitId,
      this._requestOptions,
    );
  }

  /**
   * Records a custom click gesture (Android Next-Gen when the request enabled custom click).
   */
  public recordCustomClickGesture() {
    if (this._destroyed) {
      throw new Error(
        'SwipeableInterstitialAd.recordCustomClickGesture() The ad has been destroyed.',
      );
    }
    if (!this._loaded) {
      throw new Error(
        'SwipeableInterstitialAd.recordCustomClickGesture() The ad has not loaded yet.',
      );
    }
    if (!this._isCustomClickGestureEnabled) {
      throw new Error(
        'SwipeableInterstitialAd.recordCustomClickGesture() Custom click gestures are not enabled for this ad.',
      );
    }
    NativeSwipeableInterstitialAdModule.swipeableInterstitialRecordCustomClickGesture(
      this._requestId,
    );
  }

  public addAdEventsListener(listener: AdEventsListener<SwipeableInterstitialEventType>) {
    if (this._destroyed) {
      throw new Error('SwipeableInterstitialAd.addAdEventsListener(*) ad has been destroyed.');
    }
    if (!isFunction(listener)) {
      throw new Error(
        "SwipeableInterstitialAd.addAdEventsListener(*) 'listener' expected a function.",
      );
    }
    const id = this._adEventsListenerId++;
    this._adEventsListeners.set(id, listener);
    return () => {
      this._adEventsListeners.delete(id);
    };
  }

  public addAdEventListener<T extends SwipeableInterstitialEventType>(
    type: T,
    listener: AdEventListener<T>,
  ): () => void {
    if (this._destroyed) {
      throw new Error('SwipeableInterstitialAd.addAdEventListener(*) ad has been destroyed.');
    }
    if (
      !(
        isOneOf(type, Object.values(AdEventType)) ||
        isOneOf(type, Object.values(SwipeableInterstitialAdEventType)) ||
        isOneOf(type, Object.values(GAMAdEventType))
      )
    ) {
      throw new Error(
        "SwipeableInterstitialAd.addAdEventListener(*) 'type' expected a valid event type value.",
      );
    }
    if (!isFunction(listener)) {
      throw new Error(
        "SwipeableInterstitialAd.addAdEventListener(_, *) 'listener' expected a function.",
      );
    }

    const id = this._adEventListenerId++;
    this._getAdEventListeners(type).set(
      id,
      listener as AdEventListener<SwipeableInterstitialEventType>,
    );
    return () => {
      this._getAdEventListeners(type).delete(id);
    };
  }

  protected _getAdEventListeners<T extends SwipeableInterstitialEventType>(type: T) {
    return this._adEventListenersMap.get(type) as Map<number, AdEventListener<T>>;
  }

  public removeAllListeners() {
    this._adEventsListeners.clear();
    this._adEventListenersMap.forEach((_, type, map) => {
      map.set(type, new Map());
    });
  }

  public get requestId() {
    return this._requestId;
  }

  public get adUnitId() {
    return this._adUnitId;
  }

  public get loaded() {
    return this._loaded;
  }

  public get responseInfo(): ResponseInfo | null {
    return this._responseInfo;
  }

  /** Minimum on-screen hold seconds required by the loaded creative (0 when none). */
  public get minScreenHoldDuration() {
    return this._minScreenHoldDuration;
  }

  /** Whether custom click gesture recording is available (Android Next-Gen). */
  public get isCustomClickGestureEnabled() {
    return this._isCustomClickGestureEnabled;
  }

  public destroy(): void {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    this._nativeListener.remove();
    this.removeAllListeners();
    this._loaded = false;
    this._isLoadCalled = false;
    this._responseInfo = null;
    this._minScreenHoldDuration = 0;
    this._isCustomClickGestureEnabled = false;
    try {
      NativeSwipeableInterstitialAdModule.swipeableInterstitialDestroy(this._requestId);
    } catch {
      // best-effort native release
    }
  }
}
