import { BannerAdSize } from '../BannerAdSize';
import { RequestOptions } from './RequestOptions';

/**
 * An interface for a Banner advert component.
 *
 * #### Example
 *
 * The `BannerAd` interface is exposed as a React component, allowing you to integrate ads within your existing React
 * Native code base. The component itself is isolated, meaning any standard `View` props (e.g. `style`) are not
 * forwarded on. It is recommended you wrap the `BannerAd` within your own `View` if you wish to apply custom props for use-cases
 * such as positioning.
 *
 * ```js
 * import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
 *
 * function HomeScreen() {
 *   return (
 *     <BannerAd
 *       unitId={TestIds.BANNER}
 *       size={BannerAdSize.FULL_BANNER}
 *       requestOptions={{
 *         requestNonPersonalizedAdsOnly: true,
 *       }}
 *       onAdLoaded={() => {
 *         console.log('Advert loaded');
 *       }}
 *       onAdFailedToLoad={(error) => {
 *         console.error('Advert failed to load: ', error);
 *       }}
 *     />
 *   );
 * }
 * ```
 */
export type BannerAdProps = {
  /**
   * The Google Mobile Ads unit ID for the banner.
   */
  unitId: string;

  /**
   * The size of the banner. Can be a predefined size via `BannerAdSize` or custom dimensions, e.g. `300x200`.
   *
   * Inventory must be available for the banner size specified, otherwise a no-fill error will be sent to `onAdFailedToLoad`.
   */
  size: BannerAdSize;

  /**
   * The request options for this banner.
   */
  requestOptions?: RequestOptions;

  /**
   * When an ad has finished loading.
   */
  onAdLoaded?: () => void;

  /**
   * When an ad has failed to load. Callback contains an Error.
   */
  onAdFailedToLoad?: (error: Error) => void;

  /**
   * The ad is now visible to the user.
   */
  onAdOpened?: () => void;

  /**
   * Called when the user is about to return to the app after tapping on an ad.
   */
  onAdClosed?: () => void;
};
