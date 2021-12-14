import { RequestConfiguration } from './RequestConfiguration';

/**
 * An immutable snapshot of a mediation adapter's initialization status.
 */
export type AdapterStatus = {
  name: string;
  description: string;
  status: 0 | 1;
};

/**
 * The Google Ads service interface.
 */
export interface MobileAdsModule {
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
   * import googleAds, { MaxAdContentRating } from '@invertase/react-native-google-ads';
   *
   * await googleAds().setRequestConfiguration({
   *   // Update all future requests suitable for parental guidance
   *   maxAdContentRating: MaxAdContentRating.PG,
   * });
   * ```
   *
   * @param requestConfiguration An RequestConfiguration interface used on all future Google Ads ad requests.
   */
  setRequestConfiguration(requestConfiguration: RequestConfiguration): Promise<void>;

  /**
   * The native module instance for the Google Ads service.
   */
  native: any;

  /**
   * Returns the shared event emitter instance used for all JS event routing.
   */
  emitter: any;
}
