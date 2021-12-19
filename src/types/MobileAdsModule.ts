import { EventEmitter } from 'react-native';

import { RequestConfiguration } from './RequestConfiguration';
import { getNativeModule } from '../internal/registry/nativeModule';

export enum InitializationState {
  /**
   * The mediation adapter is less likely to fill ad requests.
   */
  AdapterInitializationStateNotReady = 0,

  /**
   * The mediation adapter is ready to service ad requests.
   */
  AdapterInitializationStateReady = 1,
}

/**
 * An immutable snapshot of a mediation adapter's initialization status.
 */
export type AdapterStatus = {
  name: string;
  description: string;
  status: InitializationState;
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
  native: typeof getNativeModule;

  /**
   * Returns the shared event emitter instance used for all JS event routing.
   */
  emitter: EventEmitter;
}
