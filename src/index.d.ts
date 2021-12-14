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
import * as React from 'react';

/**
 * Google Ads package for React Native.
 *
 * #### Example: Using the default export from the `google-ads` package:
 *
 * ```js
 * import googleAds from '@invertase/react-native-google-ads';
 *
 * // googleAds.X
 * ```
 */
export namespace GoogleAdsTypes {
  /**
   * A callback interface for all ad events.
   *
   * @param type The event type, e.g. `AdEventType.LOADED`.
   * @param error An optional JavaScript Error containing the error code and message.
   * @param data Optional data for the event, e.g. reward type and amount
   */
  export type AdEventListener = (
    type:
      | AdEventType['LOADED']
      | AdEventType['ERROR']
      | AdEventType['OPENED']
      | AdEventType['CLICKED']
      | AdEventType['CLOSED']
      | RewardedAdEventType['LOADED']
      | RewardedAdEventType['EARNED_REWARD'],
    error?: Error,
    data?: any | RewardedAdReward,
  ) => void;

  /**
   * Base class for InterstitialAd, RewardedAd, NativeAd and BannerAd.
   */
  export class MobileAd {
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
     * const unsubscribe = advert.onAdEvent((type) => {
     *
     * });
     *
     * // Sometime later...
     * unsubscribe();
     * ```
     *
     * @param listener A listener callback containing a event type, error and data.
     */
    onAdEvent(listener: AdEventListener): () => void;

    /**
     * Show the loaded advert to the user.
     *
     * #### Example
     *
     * ```js
     * // Create InterstitialAd/RewardedAd
     * const advert = InterstitialAd.createForAdRequest('...');
     *
     * advert.onAdEvent((type) => {
     *   if (type === AdEventType.LOADED) {
     *     advert.show({
     *       immersiveModeEnabled: true,
     *     });
     *   }
     * });
     * ```
     *
     * @param showOptions An optional `AdShowOptions` interface.
     */
    show(showOptions?: AdShowOptions): Promise<void>;
  }

  /**
   * A class for interacting and showing Interstitial Ads.
   *
   * An Interstitial advert can be pre-loaded and shown at a suitable point in your apps flow, such as at the end of a level
   * in a game. An Interstitial is a full screen advert, laid on-top of your entire application which the user can interact with.
   * Interactions are passed back via events which should be handled accordingly inside of your app.
   *
   * #### Example
   *
   * First create a new Interstitial instance, passing in your Ad Unit ID from the Google Ads configuration console, and any additional
   * request options. The example below will present a test advert, and only request a non-personalized ad.
   *
   * ```js
   * import { InterstitialAd, TestIds } from '@invertase/react-native-google-ads';
   *
   * const interstitial = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL, {
   *     requestNonPersonalizedAdsOnly: true,
   * });
   *  ```
   *
   * Each advert needs to be loaded from Google Ads before being shown. It is recommended this is performed before the user
   * reaches the checkpoint to show the advert, so it's ready to go. Before loading the advert, we need to setup
   * event listeners to listen for updates from Google Mobile Ads, such as advert loaded or failed to load.
   *
   * Event types match the `AdEventType` interface. Once the advert has loaded, we can trigger it to show:
   *
   * ```js
   * import { AdEventType } from '@invertase/react-native-google-ads';
   *
   * interstitial.onAdEvent((type) => {
   *   if (type === AdEventType.LOADED) {
   *     interstitial.show();
   *   }
   * });
   *
   * interstitial.load();
   *  ```
   *
   * The advert will be presented to the user, and several more events can be triggered such as the user clicking the
   * advert or closing it.
   */
  export class InterstitialAd extends MobileAd {
    /**
     * Creates a new InterstitialAd instance.
     *
     * #### Example
     *
     * ```js
     * import { InterstitialAd, AdEventType, TestIds } from '@invertase/react-native-google-ads';
     *
     * const interstitialAd = await InterstitialAd.request(TestIds.INTERSTITIAL, {
     *   requestAgent: 'CoolAds',
     * });
     *
     * interstitialAd.onAdEvent((type, error) => {
     *   console.log('New event: ', type, error);
     *
     *   if (type === AdEventType.LOADED) {
     *     interstitialAd.show();
     *   }
     * });
     *
     * interstitialAd.load();
     * ```
     *
     * @param adUnitId The Ad Unit ID for the Interstitial. You can find this on your Google Mobile Ads dashboard.
     * @param requestOptions Optional RequestOptions used to load the ad.
     */
    static createForAdRequest(adUnitId: string, requestOptions?: RequestOptions): InterstitialAd;
  }

  /**
   * A class for interacting and showing Rewarded Ads.
   *
   * An Rewarded advert can be pre-loaded and shown at a suitable point in your apps flow, such as at the end of a level
   * in a game. The content of a rewarded advert can be controlled via your Google Mobile Ads dashboard. Typically users are rewarded
   * after completing a specific advert action (e.g. watching a video or submitting an option via an interactive form).
   * Events (such as the user earning a reward or closing a rewarded advert early) are sent back for you to handle accordingly
   * within your application.
   *
   * #### Example
   *
   * First create a new Rewarded instance, passing in your Ad Unit ID from the Google Mobile Ads configuration console, and any additional
   * request options. The example below will present a test advert, and only request a non-personalized ad.
   *
   * ```js
   * import { RewardedAd, TestIds } from '@invertase/react-native-google-ads';
   *
   * const rewarded = RewardedAd.createForAdRequest(TestIds.REWARDED, {
   *     requestNonPersonalizedAdsOnly: true,
   * });
   *  ```
   *
   * Each advert needs to be loaded from Google Ads before being shown. It is recommended this is performed before the user
   * reaches the checkpoint to show the advert, so it's ready to go. Before loading the advert, we need to setup
   * event listeners to listen for updates from Google Ads, such as advert loaded or failed to load.
   *
   * Event types match the `AdEventType` or `RewardedAdEventType` interface. The potential user reward for rewarded
   * adverts are passed back to the event handler on advert load and when the user earns the reward.
   *
   * ```js
   * import { RewardedAdEventType } from '@invertase/react-native-google-ads';
   *
   * rewarded.onAdEvent((type, error, reward) => {
   *   if (type === RewardedAdEventType.LOADED) {
   *     rewarded.show();
   *   }
   *   if (type === RewardedAdEventType.EARNED_REWARD) {
   *     console.log('User earned reward of ', reward);
   *   }
   * });
   *
   * rewarded.load();
   *  ```
   *
   * The rewarded advert will be presented to the user, and several more events can be triggered such as the user clicking the
   * advert, closing it or completing the action.
   */
  export class RewardedAd extends MobileAd {
    /**
     * Creates a new RewardedAd instance.
     *
     * #### Example
     *
     * ```js
     * import { RewardedAd, RewardedAdEventType, TestIds } from '@invertase/react-native-google-ads';
     *
     * const rewardedAd = await RewardedAd.request(TestIds.REWARDED, {
     *   requestAgent: 'CoolAds',
     * });
     *
     * rewardedAd.onAdEvent((type, error, data) => {
     *   console.log('New event: ', type, error);
     *
     *   if (type === RewardedAdEventType.LOADED) {
     *     rewardedAd.show();
     *   }
     * });
     *
     * rewardedAd.load();
     * ```
     *
     * @param adUnitId The Ad Unit ID for the Rewarded Ad. You can find this on your Google Mobile Ads dashboard.
     * @param requestOptions Optional RequestOptions used to load the ad.
     */
    static createForAdRequest(adUnitId: string, requestOptions?: RequestOptions): RewardedAd;
  }
}

export const AdsConsentDebugGeography: GoogleAdsTypes.AdsConsentDebugGeography;
export const AdsConsentStatus: GoogleAdsTypes.AdsConsentStatus;
export const MaxAdContentRating: GoogleAdsTypes.MaxAdContentRating;
export const TestIds: GoogleAdsTypes.TestIds;
export const AdEventType: GoogleAdsTypes.AdEventType;
export const BannerAdSize: GoogleAdsTypes.BannerAdSize;
export const RewardedAdEventType: GoogleAdsTypes.RewardedAdEventType;
export const AdsConsent: GoogleAdsTypes.AdsConsent;
export const InterstitialAd: typeof GoogleAdsTypes.InterstitialAd;
export const RewardedAd: typeof GoogleAdsTypes.RewardedAd;
export const BannerAd: React.SFC<GoogleAdsTypes.BannerAd>;

declare const defaultExport: () => GoogleAdsTypes.Module & GoogleAdsTypes.Statics;

export default defaultExport;
