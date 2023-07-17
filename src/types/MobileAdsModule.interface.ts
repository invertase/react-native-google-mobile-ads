import { AdapterStatus } from './AdapterStatus';
import { RequestConfiguration } from './RequestConfiguration';

/**
 * The Google Mobile Ads service interface.
 */
export interface MobileAdsModuleInterface {
  /**
   * Initialize the SDK.
   */
  initialize(): Promise<AdapterStatus[]>;

  /**
   * Sets request options for all future ad requests.
   *
   * #### Example
   *
   * ```js
   * import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
   *
   * await mobileAds().setRequestConfiguration({
   *   // Update all future requests suitable for parental guidance
   *   maxAdContentRating: MaxAdContentRating.PG,
   * });
   * ```
   *
   * @param requestConfiguration An RequestConfiguration interface used on all future Google Mobile Ads ad requests.
   */
  setRequestConfiguration(requestConfiguration: RequestConfiguration): Promise<void>;

  /**
   * Opens the Ad Inspector. Ad inspector is an in-app overlay that enables authorized devices to perform real-time analysis of test ad requests directly within a mobile app.
   *
   * The promise will resolve when the inspector is closed.
   * Also, the promise will reject if ad inspector is closed due to an error.
   *
   * @see https://developers.google.com/ad-manager/mobile-ads-sdk/android/ad-inspector
   */
  openAdInspector(): Promise<void>;

  /**
   * Opens the Ad Debug Menu.
   *
   * Android: `initialize` needs to be called before calling this function.
   *
   * @see https://developers.google.com/ad-manager/mobile-ads-sdk/android/debug
   * @see https://developers.google.com/ad-manager/mobile-ads-sdk/ios/debug
   *
   * @param adUnit Any valid ad unit from your Ad Manager account is sufficient to open the debug options menu.
   */
  openDebugMenu(adUnit: string): void;
}
