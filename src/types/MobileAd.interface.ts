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

import { AdEventListener } from './AdEventListener';
import { AdEventsListener } from './AdEventsListener';
import { AdShowOptions } from './AdShowOptions';

/**
 * Base class for InterstitialAd, RewardedAd, NativeAd and BannerAd.
 */
export interface MobileAdInterface {
  /**
   * The Ad Unit ID for this Gogole Mobile Ads ad.
   */
  adUnitId: string;

  /**
   * Whether the advert is loaded and can be shown.
   */
  loaded: boolean;

  /**
   * Start loading the advert with the provided RequestOptions.
   *
   * It is recommended you setup ad event handlers before calling this method.
   */
  load(): void;

  /**
   * Show the loaded advert to the user.
   *
   * #### Example
   *
   * ```js
   * // Create InterstitialAd/RewardedAd
   * const advert = InterstitialAd.createForAdRequest('...');
   *
   * advert.addAdEventListener(AdEventType.LOADED, () => {
   *   advert.show({
   *     immersiveModeEnabled: true,
   *   });
   * });
   * ```
   *
   * @param showOptions An optional `AdShowOptions` interface.
   */
  show(showOptions?: AdShowOptions): Promise<void>;

  /**
   * Listen to ad events. See AdEventTypes for more information.
   *
   * Returns an unsubscriber function to stop listening to further events.
   *
   * #### Example
   *
   * ```js
   * // Create InterstitialAd/RewardedAd
   * const advert = InterstitialAd.createForAdRequest('...');
   *
   * const unsubscribe = advert.addAdEventsListener(({ type, payload }) => {
   * });
   *
   * // Sometime later...
   * unsubscribe();
   * ```
   *
   * @param listener A listener callback containing a event type, error and data.
   */
  addAdEventsListener<T extends never>(listener: AdEventsListener<T>): () => void;

  /**
   * Listen to ad events. See AdEventTypes for more information.
   *
   * Returns an unsubscriber function to stop listening to further events.
   *
   * #### Example
   *
   * ```js
   * // Create InterstitialAd/RewardedAd
   * const advert = InterstitialAd.createForAdRequest('...');
   *
   * const unsubscribe = advert.addAdEventListener(AdEventType.Loaded, () => {
   *
   * });
   *
   * // Sometime later...
   * unsubscribe();
   * ```
   *
   * @param type The event type, e.g. `AdEventType.LOADED`.
   * @param listener A listener callback containing a event type, error and data.
   */
  addAdEventListener<T extends never>(type: T, listener: AdEventListener<T>): void;

  /**
   * Remove all registered event listeners.
   */
  removeAllListeners(): void;
}
