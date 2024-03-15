import { BannerAdSize, GAMBannerAdSize } from '../BannerAdSize';
import { AppEvent } from './AppEvent';
import type { PaidEventListener } from './PaidEventListener';
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
export interface BannerAdProps {
  /**
   * The Google Mobile Ads unit ID for the banner.
   */
  unitId: string;

  /**
   * The size of the banner. Can be a predefined size via `BannerAdSize` or custom dimensions, e.g. `300x200`.
   *
   * Inventory must be available for the banner size specified, otherwise a no-fill error will be sent to `onAdFailedToLoad`.
   */
  size: BannerAdSize | string;

  /**
   * The request options for this banner.
   */
  requestOptions?: RequestOptions;

  /**
   * When an ad has finished loading.
   */
  onAdLoaded?: (dimensions: { width: number; height: number }) => void;

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

  /**
   * Called when ad generates revenue.
   * See: https://developers.google.com/admob/android/impression-level-ad-revenue
   */
  onPaid?: PaidEventListener;
}

/**
 * An interface for a GAM Banner advert component.
 *
 * #### Example
 *
 * The `GAMBannerAd` interface is exposed as a React component, allowing you to integrate ads within your existing React
 * Native code base. The component itself is isolated, meaning any standard `View` props (e.g. `style`) are not
 * forwarded on. It is recommended you wrap the `GAMBannerAd` within your own `View` if you wish to apply custom props for use-cases
 * such as positioning.
 *
 * ```js
 * import { GAMBannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
 *
 * function HomeScreen() {
 *   return (
 *     <GAMBannerAd
 *       unitId={TestIds.GAM_BANNER}
 *       sizes={[BannerAdSize.FULL_BANNER]}
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
export interface GAMBannerAdProps extends Omit<BannerAdProps, 'size'> {
  /**
   * The available sizes of the banner. Can be a array of predefined sizes via `BannerAdSize` or custom dimensions, e.g. `300x200`.
   *
   * Inventory must be available for the banner sizes specified, otherwise a no-fill error will be sent to `onAdFailedToLoad`.
   */
  sizes: typeof GAMBannerAdSize[keyof typeof GAMBannerAdSize][] | string[];

  /**
   * Whether to enable the manual impression counting.
   *
   * #### Example
   *
   * After setting this value to `true`, call `recordManualImpression()` from the ref object.
   *
   * ```js
   * import { GAMBannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
   *
   * function HomeScreen() {
   *   const ref = useRef<GAMBannerAd>(null);
   *
   *   const recordManualImpression = () => {
   *     ref.current?.recordManualImpression();
   *   }
   *
   *   return (
   *     <GAMBannerAd
   *       ref={ref}
   *       unitId={TestIds.GAM_BANNER}
   *       sizes={[BannerAdSize.FULL_BANNER]}
   *       manualImpressionsEnabled={true}
   *     />
   *   );
   * }
   * ```
   */
  manualImpressionsEnabled?: boolean;

  /**
   * When an ad received Ad Manager specific app events.
   */
  onAppEvent?: (appEvent: AppEvent) => void;
}
