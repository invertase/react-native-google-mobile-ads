import { AdShowOptions } from './AdShowOptions';
import type { PaidEvent } from './PaidEventListener';
import { RewardedAdReward } from './RewardedAdReward';

export interface AdStates {
  /**
   * Whether the ad is loaded and ready to to be shown to the user.
   */
  isLoaded: boolean;
  /**
   * Whether the ad is opened.
   */
  isOpened: boolean;
  /**
   * Whether the user clicked the advert.
   */
  isClicked: boolean;
  /**
   * Whether the user closed the ad and has returned back to your application.
   */
  isClosed: boolean;
  /**
   * JavaScript Error containing the error code and message thrown by the Ad.
   */
  error?: Error;
  /**
   * Payload from the last impression-level ad revenue event.
   */
  revenue?: PaidEvent;
  /**
   * Loaded reward item of the Rewarded Ad.
   */
  reward?: RewardedAdReward;
  /**
   * Whether the user earned the reward by Rewarded Ad.
   */
  isEarnedReward?: boolean;
}

export interface AdHookReturns extends AdStates {
  /**
   * Whether your ad is showing.
   * The value is equal with `isOpened && !isClosed`.
   */
  isShowing: boolean;
  /**
   * Start loading the advert with the provided RequestOptions.
   * #### Example
   *
   * ```jsx
   * export default function App() {
   *   const interstitial = useInterstitialAd(TestIds.INTERSTITIAL, {
   *     requestNonPersonalizedAdsOnly: true,
   *   });
   *   useEffect(() => {
   *     interstitial.load();
   *   }, [interstitial.load]);
   * }
   * ```
   */
  load: () => void;
  /**
   * Show the loaded advert to the user.
   *
   * #### Example
   *
   * ```jsx
   * export default function App() {
   *   const interstitial = useInterstitialAd(TestIds.INTERSTITIAL, {
   *     requestNonPersonalizedAdsOnly: true,
   *   });
   *   return (
   *     <View>
   *       <Button
   *         title="Navigate to next screen"
   *         onPress={() => {
   *           if (interstitial.isLoaded) {
   *             interstitial.show();
   *           } else {
   *             navigation.navigate('NextScreen');
   *           }
   *         }}
   *       />
   *     </View>
   *   )
   * }
   * ```
   *
   * @param showOptions An optional `AdShowOptions` interface.
   */
  show: (showOptions?: AdShowOptions) => void;
}
