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
import { NativeError } from '../internal/NativeError';
import { RewardedAdEventType } from '../RewardedAdEventType';
import { AdEventType } from '../AdEventType';
import { AdEventListener } from '../types/AdEventListener';
import { RequestOptions } from '../types/RequestOptions';
import { MobileAdsModuleInterface } from '../types/MobileAdsModule.interface';
import { RewardedAdReward } from '../types/RewardedAdReward';

export class MobileAd {
  _type: 'app_open' | 'interstitial' | 'rewarded';
  _googleMobileAds: MobileAdsModuleInterface;
  _requestId: number;
  _adUnitId: string;
  _requestOptions: RequestOptions;
  _loaded: boolean;
  _isLoadCalled: boolean;
  _onAdEventHandler: AdEventListener | null;
  _nativeListener: EmitterSubscription;

  constructor(
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
    this._onAdEventHandler = null;

    this._nativeListener = googleMobileAds.emitter.addListener(
      `google_mobile_ads_${type}_event:${adUnitId}:${requestId}`,
      this._handleAdEvent.bind(this),
    );
  }

  _handleAdEvent(event: {
    body: {
      type: AdEventType | RewardedAdEventType;
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

    if (this._onAdEventHandler) {
      let nativeError;
      if (error) {
        nativeError = NativeError.fromEvent(error, 'googleMobileAds');
      }

      this._onAdEventHandler(type, nativeError, data);
    }
  }

  _setAdEventHandler(handler: AdEventListener) {
    this._onAdEventHandler = handler;
    return () => (this._onAdEventHandler = null);
  }

  get adUnitId() {
    return this._adUnitId;
  }

  get loaded() {
    return this._loaded;
  }
}
