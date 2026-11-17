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
import { PictureInPictureAdEventType } from '../PictureInPictureAdEventType';
import { SharedEventEmitter } from '../internal/SharedEventEmitter';
import { validateAdRequestOptions } from '../validateAdRequestOptions';
import { validatePictureInPictureAdShowOptions } from '../validatePictureInPictureAdShowOptions';
import { allocateFullscreenRequestId } from '../internal/fullscreenRequestIds';
import NativePictureInPictureModule from '../specs/modules/NativePictureInPictureModule';
import type { AdEventListener, AdEventPayload } from '../types/AdEventListener';
import type { AdEventsListener } from '../types/AdEventsListener';
import type { RequestOptions } from '../types/RequestOptions';
import type { PictureInPictureAdShowOptions } from '../types/PictureInPictureAdShowOptions';
import type { ResponseInfo } from '../types/ResponseInfo';
import { GAMAdEventType } from '../GAMAdEventType';
import type { AppEvent } from '../types/AppEvent';
import type { PaidEvent } from '../types/PaidEventListener';

type PipEventType = AdEventType | PictureInPictureAdEventType | GAMAdEventType;

/**
 * Picture-in-picture (PiP) ads — **Preview (Google open beta)** on iOS and Android Next-Gen.
 *
 * Classic Android builds report `getAdCapabilities().pictureInPicture === 'unavailable'`;
 * calls on that backend fail with a structured unavailable error from native code.
 *
 * Load before show, listen for {@link AdEventType.LOADED}, then {@link show}. Use {@link hide}
 * to remove the floating window without destroying inventory; call {@link destroy} when finished.
 *
 * @preview Google Mobile Ads open beta — upstream APIs and allowlisting may change.
 */
export class PictureInPictureAd {
  protected _requestId: number;
  protected _adUnitId: string;
  protected _requestOptions: RequestOptions;
  protected _loaded: boolean;
  protected _isLoadCalled: boolean;
  protected _destroyed: boolean;
  protected _adEventsListeners: Map<number, AdEventsListener<PipEventType>>;
  protected _adEventListenersMap: Map<PipEventType, Map<number, AdEventListener<PipEventType>>>;
  protected _adEventsListenerId: number;
  protected _adEventListenerId: number;
  protected _nativeListener: EmitterSubscription;
  protected _responseInfo: ResponseInfo | null;

  protected constructor(
    requestId: number,
    adUnitId: string,
    requestOptions: RequestOptions,
  ) {
    this._requestId = requestId;
    this._adUnitId = adUnitId;
    this._requestOptions = requestOptions;
    this._loaded = false;
    this._isLoadCalled = false;
    this._destroyed = false;
    this._responseInfo = null;
    this._adEventsListeners = new Map();
    this._adEventListenersMap = new Map();
    Object.values({
      ...AdEventType,
      ...PictureInPictureAdEventType,
      ...GAMAdEventType,
    }).forEach(type => {
      this._adEventListenersMap.set(type as PipEventType, new Map());
    });
    this._adEventListenerId = 0;
    this._adEventsListenerId = 0;

    this._nativeListener = SharedEventEmitter.addListener(
      `google_mobile_ads_picture_in_picture_event:${adUnitId}:${requestId}`,
      this._handleAdEvent.bind(this),
    );
  }

  /**
   * Creates a PictureInPictureAd instance (Preview — Google open beta).
   */
  static createForAdRequest(adUnitId: string, requestOptions?: RequestOptions) {
    if (!isString(adUnitId)) {
      throw new Error(
        "PictureInPictureAd.createForAdRequest(*) 'adUnitId' expected an string value.",
      );
    }

    let options = {};
    try {
      options = validateAdRequestOptions(requestOptions);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`PictureInPictureAd.createForAdRequest(_, *) ${e.message}.`);
      }
    }

    const requestId = allocateFullscreenRequestId();
    return new PictureInPictureAd(requestId, adUnitId, options);
  }

  protected _handleAdEvent(event: {
    body: {
      type: PipEventType;
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
        | { responseInfo?: ResponseInfo };
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
    }

    if (type === AdEventType.ERROR) {
      this._loaded = false;
      this._isLoadCalled = false;
      if (nestedResponseInfo) {
        this._responseInfo = nestedResponseInfo;
      }
    }

    let payload: AdEventPayload<PipEventType>;
    if (error) {
      payload = adErrorFromNativeEvent(
        error,
        'googleMobileAds',
        'load',
      ) as AdEventPayload<PipEventType>;
    } else if (
      type === AdEventType.LOADED &&
      data &&
      typeof data === 'object' &&
      'responseInfo' in data
    ) {
      const rest = { ...(data as Record<string, unknown>) };
      delete rest.responseInfo;
      payload = (Object.keys(rest).length > 0 ? rest : undefined) as AdEventPayload<PipEventType>;
    } else {
      payload = data as AdEventPayload<PipEventType>;
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
    NativePictureInPictureModule.pictureInPictureLoad(
      this._requestId,
      this._adUnitId,
      this._requestOptions,
    );
  }

  public show(showOptions?: PictureInPictureAdShowOptions) {
    if (this._destroyed) {
      throw new Error(
        'PictureInPictureAd.show() The requested PictureInPictureAd has been destroyed.',
      );
    }
    if (!this._loaded) {
      return Promise.reject(
        new Error(
          'PictureInPictureAd.show() The requested PictureInPictureAd has not loaded and could not be shown.',
        ),
      );
    }

    let options: PictureInPictureAdShowOptions;
    try {
      options = validatePictureInPictureAdShowOptions(showOptions);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`PictureInPictureAd.show(*) ${e.message}.`);
      }
      throw e;
    }

    return NativePictureInPictureModule.pictureInPictureShow(
      this._requestId,
      this._adUnitId,
      options,
    );
  }

  public hide() {
    if (this._destroyed) {
      throw new Error(
        'PictureInPictureAd.hide() The requested PictureInPictureAd has been destroyed.',
      );
    }
    NativePictureInPictureModule.pictureInPictureHide(this._requestId);
  }

  public addAdEventsListener(listener: AdEventsListener<PipEventType>) {
    if (this._destroyed) {
      throw new Error('PictureInPictureAd.addAdEventsListener(*) ad has been destroyed.');
    }
    if (!isFunction(listener)) {
      throw new Error("PictureInPictureAd.addAdEventsListener(*) 'listener' expected a function.");
    }
    const id = this._adEventsListenerId++;
    this._adEventsListeners.set(id, listener);
    return () => {
      this._adEventsListeners.delete(id);
    };
  }

  public addAdEventListener<T extends PipEventType>(
    type: T,
    listener: AdEventListener<T>,
  ): () => void {
    if (this._destroyed) {
      throw new Error('PictureInPictureAd.addAdEventListener(*) ad has been destroyed.');
    }
    if (
      !(
        isOneOf(type, Object.values(AdEventType)) ||
        isOneOf(type, Object.values(PictureInPictureAdEventType)) ||
        isOneOf(type, Object.values(GAMAdEventType))
      )
    ) {
      throw new Error(
        "PictureInPictureAd.addAdEventListener(*) 'type' expected a valid event type value.",
      );
    }
    if (!isFunction(listener)) {
      throw new Error("PictureInPictureAd.addAdEventListener(_, *) 'listener' expected a function.");
    }

    const id = this._adEventListenerId++;
    this._getAdEventListeners(type).set(id, listener as AdEventListener<PipEventType>);
    return () => {
      this._getAdEventListeners(type).delete(id);
    };
  }

  protected _getAdEventListeners<T extends PipEventType>(type: T) {
    return this._adEventListenersMap.get(type) as Map<number, AdEventListener<T>>;
  }

  public removeAllListeners() {
    this._adEventsListeners.clear();
    this._adEventListenersMap.forEach((_, type, map) => {
      map.set(type, new Map());
    });
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
    try {
      NativePictureInPictureModule.pictureInPictureDestroy(this._requestId);
    } catch {
      // best-effort native release
    }
  }
}