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

import { isFunction, isString } from '../common';
import googleAds from '../index';
import validateAdRequestOptions from '../validateAdRequestOptions';
import validateAdShowOptions from '../validateAdShowOptions';
import MobileAd from './MobileAd';

let _interstitialRequest = 0;

export default class InterstitialAd extends MobileAd {
  static createForAdRequest(adUnitId, requestOptions) {
    if (!isString(adUnitId)) {
      throw new Error("InterstitialAd.createForAdRequest(*) 'adUnitId' expected an string value.");
    }

    let options = {};
    try {
      options = validateAdRequestOptions(requestOptions);
    } catch (e) {
      throw new Error(`InterstitialAd.createForAdRequest(_, *) ${e.message}.`);
    }

    const requestId = _interstitialRequest++;
    return new InterstitialAd('interstitial', googleAds(), requestId, adUnitId, options);
  }

  load() {
    // Prevent multiple load calls
    if (this._loaded || this._isLoadCalled) {
      return;
    }

    this._isLoadCalled = true;
    this._googleAds.native.interstitialLoad(this._requestId, this._adUnitId, this._requestOptions);
  }

  onAdEvent(handler) {
    if (!isFunction(handler)) {
      throw new Error("InterstitialAd.onAdEvent(*) 'handler' expected a function.");
    }

    return this._setAdEventHandler(handler);
  }

  show(showOptions) {
    if (!this._loaded) {
      throw new Error(
        'InterstitialAd.show() The requested InterstitialAd has not loaded and could not be shown.',
      );
    }

    let options;
    try {
      options = validateAdShowOptions(showOptions);
    } catch (e) {
      throw new Error(`InterstitialAd.show(*) ${e.message}.`);
    }

    return this._googleAds.native.interstitialShow(this._requestId, options);
  }
}
