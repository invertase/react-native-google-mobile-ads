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

import { isString } from '../common';
import { MobileAds } from '../MobileAds';
import { validateAdRequestOptions } from '../validateAdRequestOptions';
import { validateAdShowOptions } from '../validateAdShowOptions';
import { MobileAd } from './MobileAd';
import { AdEventType } from '../AdEventType';
import { AdEventListener } from '../types/AdEventListener';
import { AdEventsListener } from '../types/AdEventsListener';
import { AdShowOptions } from '../types/AdShowOptions';
import { RequestOptions } from '../types/RequestOptions';
import { MobileAdInterface } from '../types/MobileAd.interface';

let _appOpenRequest = 0;

export class AppOpenAd extends MobileAd implements MobileAdInterface {
  static createForAdRequest(adUnitId: string, requestOptions?: RequestOptions): AppOpenAd {
    if (!isString(adUnitId)) {
      throw new Error("AppOpenAd.createForAdRequest(*) 'adUnitId' expected an string value.");
    }

    let options = {};
    try {
      options = validateAdRequestOptions(requestOptions);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`AppOpenAd.createForAdRequest(_, *) ${e.message}.`);
      }
    }

    const requestId = _appOpenRequest++;
    return new AppOpenAd('app_open', MobileAds(), requestId, adUnitId, options);
  }

  load() {
    // Prevent multiple load calls
    if (this._loaded || this._isLoadCalled) {
      return;
    }

    this._isLoadCalled = true;
    this._googleMobileAds.native.appOpenLoad(this._requestId, this._adUnitId, this._requestOptions);
  }

  show(showOptions?: AdShowOptions) {
    if (!this._loaded) {
      throw new Error(
        'AppOpenAd.show() The requested AppOpenAd has not loaded and could not be shown.',
      );
    }

    let options;
    try {
      options = validateAdShowOptions(showOptions);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`AppOpenAd.show(*) ${e.message}.`);
      }
    }

    return this._googleMobileAds.native.appOpenShow(this._requestId, options);
  }

  addAdEventsListener<T extends AdEventType>(listener: AdEventsListener<T>): () => void {
    return this._addAdEventsListener(listener);
  }

  addAdEventListener<T extends AdEventType>(type: T, listener: AdEventListener<T>) {
    return this._addAdEventListener(type, listener);
  }
}
