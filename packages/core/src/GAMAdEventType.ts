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

export enum GAMAdEventType {
  /**
   * An event fired when the ad received Ad Manager specific app event.
   *
   * The app event contains a `name` and `data`. `data` could be undefeined.
   *
   * #### Example
   *
   * ```js
   * import { GAMAdEventType } from 'react-native-google-mobile-ads';
   *
   * interstitialAd.onAdEvent((type, error, data) => {
   *   if (type === GAMAdEventType.APP_EVENT) {
   *    console.log(`Received app event: ${data.name} with data: ${data.data}`);
   *   }
   * });
   * ```
   */
  APP_EVENT = 'app_event',
}
