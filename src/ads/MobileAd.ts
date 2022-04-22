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
import { NativeError } from '../internal/NativeError';
import { AdEventType } from '../AdEventType';
import { RewardedAdEventType } from '../RewardedAdEventType';
import { AdEventListener, AdEventPayload } from '../types/AdEventListener';
import { AdEventsListener } from '../types/AdEventsListener';
import { RequestOptions } from '../types/RequestOptions';
import { MobileAdsModuleInterface } from '../types/MobileAdsModule.interface';
import { RewardedAdReward } from '../types/RewardedAdReward';

type EventType = AdEventType | RewardedAdEventType;

export class MobileAd {
  protected _type: 'app_open' | 'interstitial' | 'rewarded';
  protected _googleMobileAds: MobileAdsModuleInterface;
  protected _requestId: number;
  protected _adUnitId: string;
  protected _requestOptions: RequestOptions;
  protected _loaded: boolean;
  protected _isLoadCalled: boolean;
  protected _adEventsListeners: Map<number, AdEventsListener<EventType>>;
  protected _adEventListenersMap: Map<EventType, Map<number, AdEventListener<EventType>>>;
  protected _adEventsListenerId: number;
  protected _adEventListenerId: number;
  protected _nativeListener: EmitterSubscription;

  protected constructor(
    type: 'app_open' | 'interstitial' | 'rewarded',
    googleMobileAds: MobileAdsModuleInterface,
    requestId: number,
    adUnitId: string,
    requestOptions: RequestOptions,
  ) {
    this._type = type;
    this._googleMobileAds = googleMobileAds;
    this._requestId = requestId;
    this._adUnitId = adUnitId;
    this._requestOptions = requestOptions;

    this._loaded = false;
    this._isLoadCalled = false;
    this._adEventsListeners = new Map();
    this._adEventListenersMap = new Map();
    Object.values({
      ...AdEventType,
      ...RewardedAdEventType,
      _: AdEventType.LOADED, // since AdEventType.LOADED is overwritten by RewardedAdEventType.LOADED
    }).forEach(type => {
      this._adEventListenersMap.set(type as EventType, new Map());
    });
    this._adEventListenerId = 0;
    this._adEventsListenerId = 0;

    this._nativeListener = googleMobileAds.emitter.addListener(
      `google_mobile_ads_${type}_event:${adUnitId}:${requestId}`,
      this._handleAdEvent.bind(this),
    );
  }

  protected _handleAdEvent(event: {
    body: {
      type: EventType;
      error?: { code: string; message: string };
      data?: RewardedAdReward;
    };
  }) {
    const { type, error, data } = event.body;

    if (type === AdEventType.LOADED || type === RewardedAdEventType.LOADED) {
      this._loaded = true;
    }

    if (type === AdEventType.CLOSED) {
      this._loaded = false;
      this._isLoadCalled = false;
    }

    let payload: AdEventPayload<EventType> = data;
    if (error) {
      payload = NativeError.fromEvent(error, 'googleMobileAds');
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
    if (!isFunction(listener)) {
      throw new Error(
        `${this.constructor.name}.addAdEventsListener(*) 'listener' expected a function.`,
      );
    }

    const id = this._adEventsListenerId++;
    this._adEventsListeners.set(id, listener as AdEventsListener<EventType>);
    return () => {
      this._adEventsListeners.delete(id);
    };
  }

  protected _addAdEventListener<T extends EventType>(type: T, listener: AdEventListener<T>) {
    if (
      !(
        isOneOf(type, Object.values(AdEventType)) ||
        (isOneOf(type, Object.values(RewardedAdEventType)) && this._type === 'rewarded')
      )
    ) {
      throw new Error(
        `${this.constructor.name}.addAdEventListener(*) 'type' expected a valid event type value.`,
      );
    }
    if (!isFunction(listener)) {
      throw new Error(
        `${this.constructor.name}.addAdEventListener(_, *) 'listener' expected a function.`,
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

  removeAllListeners() {
    this._adEventsListeners.clear();
    this._adEventListenersMap.forEach((_, type, map) => {
      map.set(type, new Map());
    });
  }

  get adUnitId() {
    return this._adUnitId;
  }

  get loaded() {
    return this._loaded;
  }
}
