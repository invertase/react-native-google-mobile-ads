/**
 * Common event types for ads.
 */
export interface AdEventType {
  /**
   * When an ad has loaded. At this point, the ad is ready to be shown to the user.
   *
   * #### Example
   *
   * ```js
   * import { AdEventType } from '@invertase/react-native-google-ads';
   *
   * advert.onAdEvent((type,error,data) => {
   *   if (type === AdEventType.LOADED) {
   *     advert.show();
   *   }
   * });
   * ```
   */
  LOADED: 'loaded';

  /**
   * The ad has thrown an error. See the error parameter the listener callback for more information.
   *
   * #### Example
   *
   * ```js
   * import { AdEventType } from '@invertase/react-native-google-ads';
   *
   * advert.onAdEvent((type, error, data) => {
   *   if (type === AdEventType.ERROR) {
   *     console.log('Ad error:', error);
   *   }
   * });
   * ```
   */
  ERROR: 'error';

  /**
   * The ad opened and is currently visible to the user. This event is fired after the `show()`
   * method has been called.
   */
  OPENED: 'opened';

  /**
   * The user clicked the advert.
   */
  CLICKED: 'clicked';

  /**
   * The user closed the ad and has returned back to your application.
   */
  CLOSED: 'closed';
}
