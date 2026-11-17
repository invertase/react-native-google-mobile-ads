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
import { SharedEventEmitter } from '../internal/SharedEventEmitter';
import { validateAdRequestOptions } from '../validateAdRequestOptions';
import { allocateFullscreenRequestId } from '../internal/fullscreenRequestIds';
import NativeIconAdModule from '../specs/modules/NativeIconAdModule';
import type { AdEventListener, AdEventPayload } from '../types/AdEventListener';
import type { AdEventsListener } from '../types/AdEventsListener';
import type { RequestOptions } from '../types/RequestOptions';
import type { ResponseInfo } from '../types/ResponseInfo';
import { GAMAdEventType } from '../GAMAdEventType';
import type { AppEvent } from '../types/AppEvent';
import type { PaidEvent } from '../types/PaidEventListener';
import type { NativeAdImage } from '../specs/modules/NativeGoogleMobileAdsNativeModule';
import type { IconAdChoicesInfo } from '../types/IconAdChoicesInfo';

type IconAdEventType = AdEventType | GAMAdEventType;

type LoadedAssetPayload = {
  headline?: string;
  callToAction?: string;
  packageName?: string;
  starRating?: number | null;
  icon?: NativeAdImage | null;
  adChoicesInfo?: IconAdChoicesInfo | null;
  responseInfo?: ResponseInfo;
};

/**
 * Icon ads — **Alpha (experimental)** on Android Next-Gen only.
 *
 * Classic Android and iOS report `getAdCapabilities().iconAd === 'unavailable'`; load fails with
 * a structured unavailable error from native code. This is a dedicated icon format — not the
 * `icon` asset on {@link NativeAd}.
 *
 * Load before rendering {@link IconAdView}; assign registered {@link IconAsset} children, then
 * let the native view call `registerIconAd` when assets are ready.
 *
 * @remarks
 * Upstream Icon ad APIs may change on the Next-Gen Android SDK.
 */
export class IconAd {
  protected _requestId: number;
  protected _adUnitId: string;
  protected _requestOptions: RequestOptions;
  protected _loaded: boolean;
  protected _isLoadCalled: boolean;
  protected _destroyed: boolean;
  protected _adEventsListeners: Map<number, AdEventsListener<IconAdEventType>>;
  protected _adEventListenersMap: Map<
    IconAdEventType,
    Map<number, AdEventListener<IconAdEventType>>
  >;
  protected _adEventsListenerId: number;
  protected _adEventListenerId: number;
  protected _nativeListener: EmitterSubscription;
  protected _responseInfo: ResponseInfo | null;
  protected _headline: string | null;
  protected _callToAction: string | null;
  protected _packageName: string | null;
  protected _starRating: number | null;
  protected _icon: NativeAdImage | null;
  protected _adChoicesInfo: IconAdChoicesInfo | null;

  protected constructor(requestId: number, adUnitId: string, requestOptions: RequestOptions) {
    this._requestId = requestId;
    this._adUnitId = adUnitId;
    this._requestOptions = requestOptions;
    this._loaded = false;
    this._isLoadCalled = false;
    this._destroyed = false;
    this._responseInfo = null;
    this._headline = null;
    this._callToAction = null;
    this._packageName = null;
    this._starRating = null;
    this._icon = null;
    this._adChoicesInfo = null;
    this._adEventsListeners = new Map();
    this._adEventListenersMap = new Map();
    Object.values({
      ...AdEventType,
      ...GAMAdEventType,
    }).forEach(type => {
      this._adEventListenersMap.set(type as IconAdEventType, new Map());
    });
    this._adEventListenerId = 0;
    this._adEventsListenerId = 0;

    this._nativeListener = SharedEventEmitter.addListener(
      `google_mobile_ads_icon_ad_event:${adUnitId}:${requestId}`,
      this._handleAdEvent.bind(this),
    );
  }

  /**
   * Creates an IconAd instance (alpha — Android Next-Gen only).
   */
  static createForAdRequest(adUnitId: string, requestOptions?: RequestOptions) {
    if (!isString(adUnitId)) {
      throw new Error("IconAd.createForAdRequest(*) 'adUnitId' expected an string value.");
    }

    let options = {};
    try {
      options = validateAdRequestOptions(requestOptions);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`IconAd.createForAdRequest(_, *) ${e.message}.`);
      }
    }

    const requestId = allocateFullscreenRequestId();
    return new IconAd(requestId, adUnitId, options);
  }

  protected _applyLoadedAssets(data: LoadedAssetPayload) {
    if (data.headline !== undefined) {
      this._headline = data.headline ?? null;
    }
    if (data.callToAction !== undefined) {
      this._callToAction = data.callToAction ?? null;
    }
    if (data.packageName !== undefined) {
      this._packageName = data.packageName ?? null;
    }
    if (data.starRating !== undefined) {
      this._starRating = data.starRating ?? null;
    }
    if (data.icon !== undefined) {
      this._icon = data.icon ?? null;
    }
    if (data.adChoicesInfo !== undefined) {
      this._adChoicesInfo = data.adChoicesInfo ?? null;
    }
  }

  protected _handleAdEvent(event: {
    body: {
      type: IconAdEventType;
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
        | (LoadedAssetPayload & { responseInfo?: ResponseInfo });
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
        this._applyLoadedAssets(data as LoadedAssetPayload);
      }
    }

    if (type === AdEventType.ERROR) {
      this._loaded = false;
      this._isLoadCalled = false;
      if (nestedResponseInfo) {
        this._responseInfo = nestedResponseInfo;
      }
    }

    let payload: AdEventPayload<IconAdEventType>;
    if (error) {
      payload = adErrorFromNativeEvent(
        error,
        'googleMobileAds',
        'load',
      ) as AdEventPayload<IconAdEventType>;
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
      ) as AdEventPayload<IconAdEventType>;
    } else {
      payload = data as AdEventPayload<IconAdEventType>;
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
    NativeIconAdModule.iconAdLoad(this._requestId, this._adUnitId, this._requestOptions);
  }

  public addAdEventsListener(listener: AdEventsListener<IconAdEventType>) {
    if (this._destroyed) {
      throw new Error('IconAd.addAdEventsListener(*) ad has been destroyed.');
    }
    if (!isFunction(listener)) {
      throw new Error("IconAd.addAdEventsListener(*) 'listener' expected a function.");
    }
    const id = this._adEventsListenerId++;
    this._adEventsListeners.set(id, listener);
    return () => {
      this._adEventsListeners.delete(id);
    };
  }

  public addAdEventListener<T extends IconAdEventType>(
    type: T,
    listener: AdEventListener<T>,
  ): () => void {
    if (this._destroyed) {
      throw new Error('IconAd.addAdEventListener(*) ad has been destroyed.');
    }
    if (
      !(isOneOf(type, Object.values(AdEventType)) || isOneOf(type, Object.values(GAMAdEventType)))
    ) {
      throw new Error("IconAd.addAdEventListener(*) 'type' expected a valid event type value.");
    }
    if (!isFunction(listener)) {
      throw new Error("IconAd.addAdEventListener(_, *) 'listener' expected a function.");
    }

    const id = this._adEventListenerId++;
    this._getAdEventListeners(type).set(id, listener as AdEventListener<IconAdEventType>);
    return () => {
      this._getAdEventListeners(type).delete(id);
    };
  }

  protected _getAdEventListeners<T extends IconAdEventType>(type: T) {
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

  public get headline(): string | null {
    return this._headline;
  }

  public get callToAction(): string | null {
    return this._callToAction;
  }

  public get packageName(): string | null {
    return this._packageName;
  }

  public get starRating(): number | null {
    return this._starRating;
  }

  public get icon(): NativeAdImage | null {
    return this._icon;
  }

  public get adChoicesInfo(): IconAdChoicesInfo | null {
    return this._adChoicesInfo;
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
    this._headline = null;
    this._callToAction = null;
    this._packageName = null;
    this._starRating = null;
    this._icon = null;
    this._adChoicesInfo = null;
    try {
      NativeIconAdModule.iconAdDestroy(this._requestId);
    } catch {
      // best-effort native release
    }
  }
}
