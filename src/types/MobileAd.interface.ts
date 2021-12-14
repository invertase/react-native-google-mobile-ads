import { AdEventType } from './AdEventType';
import { AdShowOptions } from './AdShowOptions';
import { RewardedAdReward } from './RewardedAdReward';
import { RewardedAdEventType } from './RewardedAdEventType';

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
