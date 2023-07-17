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
import { validateAdRequestOptions } from '../validateAdRequestOptions';
import { MobileAd } from './MobileAd';
import { AdEventType } from '../AdEventType';
import { AdEventListener } from '../types/AdEventListener';
import { AdEventsListener } from '../types/AdEventsListener';
import { RequestOptions } from '../types/RequestOptions';

export class AppOpenAd extends MobileAd {
  protected static _appOpenRequest = 0;

  static createForAdRequest(adUnitId: string, requestOptions?: RequestOptions) {
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

    const requestId = AppOpenAd._appOpenRequest++;
    return new AppOpenAd(
      'app_open',
      'RNGoogleMobileAdsAppOpenModule',
      requestId,
      adUnitId,
      options,
    );
  }

  addAdEventsListener<T extends AdEventType>(listener: AdEventsListener<T>): () => void {
    return this._addAdEventsListener(listener);
  }

  addAdEventListener<T extends AdEventType>(type: T, listener: AdEventListener<T>) {
    return this._addAdEventListener(type, listener);
  }
}
