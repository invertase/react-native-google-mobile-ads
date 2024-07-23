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

  /**
   * Sets the application's audio volume. Affects audio volumes of all ads relative to other audio output.
   *
   * Warning: Lowering your app's audio volume reduces video ad eligibility and may reduce your app's ad revenue.
   * You should only utilize this API if your app provides custom volume controls to the user, and you should reflect
   * the user's volume choice in this API.
   *
   * @see https://developers.google.com/ad-manager/mobile-ads-sdk/android/global-settings
   * @see https://developers.google.com/ad-manager/mobile-ads-sdk/ios/global-settings
   *
   * @param volume the volume as a float from 0 (muted) to 1.0 (full media volume). Defaults to 1.0
   */
  setAppVolume(volume: number): void;

  /**
   * Indicates whether the application's audio is muted. Affects initial mute state for all ads.
   *
   * Warning: Muting your application reduces video ad eligibility and may reduce your app's ad revenue.
   * You should only utilize this API if your app provides a custom mute control to the user, and you should
   * reflect the user's mute decision in this API.
   *
   * @see https://developers.google.com/ad-manager/mobile-ads-sdk/android/global-settings
   * @see https://developers.google.com/ad-manager/mobile-ads-sdk/ios/global-settings
   *
   * @param muted true if the app is muted, false otherwise. Defaults to false.
   */
  setAppMuted(muted: boolean): void;
}
