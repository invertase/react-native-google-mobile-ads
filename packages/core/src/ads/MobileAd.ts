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
import { isFunction, isOneOf } from '../common';
import {
  adErrorFromNativeEvent,
  parseResponseInfoPayload,
} from '../internal/adErrorFromNativeEvent';
import { AdEventType } from '../AdEventType';
import { RewardedAdEventType } from '../RewardedAdEventType';
import { SharedEventEmitter } from '../internal/SharedEventEmitter';
import { AdEventListener, AdEventPayload } from '../types/AdEventListener';
import { AdEventsListener } from '../types/AdEventsListener';
import { AdShowOptions } from '../types/AdShowOptions';
import { RequestOptions } from '../types/RequestOptions';
import { MobileAdInterface } from '../types/MobileAd.interface';
import type { ResponseInfo } from '../types/ResponseInfo';
import { RewardedAdReward } from '../types/RewardedAdReward';
import { GAMAdEventType } from '../GAMAdEventType';
import { AppEvent } from '../types/AppEvent';
import { validateAdShowOptions } from '../validateAdShowOptions';
import type { PaidEvent } from '../types/PaidEventListener';

type AdType = 'app_open' | 'interstitial' | 'rewarded' | 'rewarded_interstitial';
type EventType = AdEventType | RewardedAdEventType | GAMAdEventType;
type AdLoadFunction = (requestId: number, adUnitId: string, requestOptions: RequestOptions) => void;
type AdShowFunction = (
  requestId: number,
  adUnitId: string,
  showOptions?: AdShowOptions,
) => Promise<void>;
type AdDestroyFunction = (requestId: number) => void;

export abstract class MobileAd implements MobileAdInterface {
  protected _type: AdType;
  protected _requestId: number;
  protected _adUnitId: string;
  protected _adLoadFunction: AdLoadFunction;
  protected _adShowFunction: AdShowFunction;
  protected _adDestroyFunction: AdDestroyFunction;
  protected _requestOptions: RequestOptions;
  protected _loaded: boolean;
  protected _isLoadCalled: boolean;
  protected _showRequested: boolean;
  protected _destroyed: boolean;
  protected _adEventsListeners: Map<number, AdEventsListener<EventType>>;
  protected _adEventListenersMap: Map<EventType, Map<number, AdEventListener<EventType>>>;
  protected _adEventsListenerId: number;
  protected _adEventListenerId: number;
  protected _nativeListener: EmitterSubscription;
  protected _responseInfo: ResponseInfo | null;

  protected constructor(
    type: AdType,
    requestId: number,
    adUnitId: string,
    adLoadFunction: AdLoadFunction,
    adShowFunction: AdShowFunction,
    adDestroyFunction: AdDestroyFunction,
    requestOptions: RequestOptions,
  ) {
    this._type = type;
    this._requestId = requestId;
    this._adUnitId = adUnitId;
    this._adLoadFunction = adLoadFunction;
    this._adShowFunction = adShowFunction;
    this._adDestroyFunction = adDestroyFunction;
    this._requestOptions = requestOptions;

    this._loaded = false;
    this._isLoadCalled = false;
    this._showRequested = false;
    this._destroyed = false;
    this._responseInfo = null;
    this._adEventsListeners = new Map();
    this._adEventListenersMap = new Map();
    Object.values({
      ...AdEventType,
      ...RewardedAdEventType,
      ...GAMAdEventType,
      _: AdEventType.LOADED, // since AdEventType.LOADED is overwritten by RewardedAdEventType.LOADED
    }).forEach(type => {
      this._adEventListenersMap.set(type as EventType, new Map());
    });
    this._adEventListenerId = 0;
    this._adEventsListenerId = 0;

    this._nativeListener = SharedEventEmitter.addListener(
      `google_mobile_ads_${type}_event:${adUnitId}:${requestId}`,
      this._handleAdEvent.bind(this),
    );
  }

  protected _handleAdEvent(event: {
    body: {
      type: EventType;
      error?: {
        code: string;
        message: string;
        responseInfo?: ResponseInfo;
        responseInfoJson?: string;
        reason?: string;
        phase?: 'load' | 'show';
      };
      data?:
        | (RewardedAdReward & { responseInfo?: ResponseInfo })
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

    if (type === AdEventType.LOADED || type === RewardedAdEventType.LOADED) {
      this._loaded = true;
      if (nestedResponseInfo) {
        this._responseInfo = nestedResponseInfo;
      }
    }

    if (type === AdEventType.CLOSED) {
      this._loaded = false;
      this._isLoadCalled = false;
      this._showRequested = false;
      this._responseInfo = null;
    }

    if (type === AdEventType.ERROR) {
      this._loaded = false;
      this._isLoadCalled = false;
      this._showRequested = false;
      if (nestedResponseInfo) {
        this._responseInfo = nestedResponseInfo;
      }
    }

    let payload: AdEventPayload<EventType>;
    if (error) {
      payload = adErrorFromNativeEvent(
        error,
        'googleMobileAds',
        'load',
      ) as AdEventPayload<EventType>;
    } else if (
      (type === AdEventType.LOADED || type === RewardedAdEventType.LOADED) &&
      data &&
      typeof data === 'object' &&
      'responseInfo' in data
    ) {
      // ResponseInfo is cached on the ad; strip it from reward / empty load payloads.
      const rest = { ...(data as Record<string, unknown>) };
      delete rest.responseInfo;
      payload = (Object.keys(rest).length > 0 ? rest : undefined) as AdEventPayload<EventType>;
    } else {
      payload = data as AdEventPayload<EventType>;
    }

    this._adEventsListeners.forEach(listener => {
      listener({
        type,
        payload,
      });
    });
    this._getAdEventListeners(type).forEach(listener => {
      listener(payload);
    });
  }

  protected _addAdEventsListener<T extends EventType>(listener: AdEventsListener<T>) {
    if (this._destroyed) {
      throw new Error(`${this._className}.addAdEventsListener(*) ad has been destroyed.`);
    }
    if (!isFunction(listener)) {
      throw new Error(`${this._className}.addAdEventsListener(*) 'listener' expected a function.`);
    }

    const id = this._adEventsListenerId++;
    this._adEventsListeners.set(id, listener as AdEventsListener<EventType>);
    return () => {
      this._adEventsListeners.delete(id);
    };
  }

  protected _addAdEventListener<T extends EventType>(type: T, listener: AdEventListener<T>) {
    if (this._destroyed) {
      throw new Error(`${this._className}.addAdEventListener(*) ad has been destroyed.`);
    }
    if (
      !(
        isOneOf(type, Object.values(AdEventType)) ||
        isOneOf(type, Object.values(GAMAdEventType)) ||
        (isOneOf(type, Object.values(RewardedAdEventType)) &&
          (this._type === 'rewarded' || this._type === 'rewarded_interstitial'))
      )
    ) {
      throw new Error(
        `${this._className}.addAdEventListener(*) 'type' expected a valid event type value.`,
      );
    }
    if (!isFunction(listener)) {
      throw new Error(
        `${this._className}.addAdEventListener(_, *) 'listener' expected a function.`,
      );
    }

    const id = this._adEventListenerId++;
    this._getAdEventListeners(type).set(id, listener);
    return () => {
      this._getAdEventListeners(type).delete(id);
    };
  }

  protected _getAdEventListeners<T extends EventType>(type: T) {
    return this._adEventListenersMap.get(type) as Map<number, AdEventListener<T>>;
  }

  protected get _className() {
    return this.constructor.name;
  }

  public load() {
    if (this._destroyed) {
      return;
    }
    // Prevent multiple load calls
    if (this._loaded || this._isLoadCalled) {
      return;
    }

    this._isLoadCalled = true;
    this._showRequested = false;
    this._responseInfo = null;
    this._adLoadFunction(this._requestId, this._adUnitId, this._requestOptions);
  }

  public show(showOptions?: AdShowOptions) {
    if (this._destroyed) {
      throw new Error(
        `${this._className}.show() The requested ${this._className} has been destroyed.`,
      );
    }
    if (!this._loaded) {
      throw new Error(
        `${this._className}.show() The requested ${this._className} has not loaded and could not be shown.`,
      );
    }
    if (this._showRequested) {
      throw new Error(
        `${this._className}.show() Show has already been requested for this ${this._className}.`,
      );
    }

    let options;
    try {
      options = validateAdShowOptions(showOptions);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`${this._className}.show(*) ${e.message}.`);
      } else {
        throw e;
      }
    }

    this._showRequested = true;
    return this._adShowFunction(this._requestId, this._adUnitId, options);
  }

  public abstract addAdEventsListener<T extends never>(listener: AdEventsListener<T>): () => void;

  public abstract addAdEventListener<T extends never>(type: T, listener: AdEventListener<T>): void;

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
    this._showRequested = false;
    this._responseInfo = null;
    try {
      this._adDestroyFunction(this._requestId);
    } catch {
      // best-effort native release
    }
  }
}
