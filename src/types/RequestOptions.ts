/**
 * Collapsible Placement.
 * The collapsible placement defines how the expanded region anchors to the banner ad.
 */
export type CollapsiblePlacement = 'top' | 'bottom';

export interface ServerSideVerificationOptions {
  /**
   * User identifier.
   * If no user identifier is provided by the app, this query parameter will not be present in the SSV callback.
   */
  userId?: string;

  /**
   * Custom data string.
   * If no custom data string is provided by the app, this query parameter value will not be present in the SSV callback.
   */
  customData?: string;
}

/**
 * The `RequestOptions` interface. Used when passing additional request options before an advert is loaded.
 */
export interface RequestOptions {
  /**
   * If `true` only non-personalized ads will be loaded.
   *
   * Google serves personalized ads by default. This option must be `true` if users who are within the EEA have only
   * given consent to non-personalized ads.
   */
  requestNonPersonalizedAdsOnly?: boolean;

  /**
   * Attaches additional properties to an ad request for direct campaign delivery.
   *
   * Takes an array of string key/value pairs.
   *
   * #### Example
   *
   * Attaches `?campaign=abc&user=123` to the ad request:
   *
   * ```js
   * await Interstitial.createForAdRequest('ca-app-pub-3940256099942544/1033173712', {
   *   networkExtras: {
   *     campaign: 'abc',
   *     user: '123',
   *   },
   * });
   */
  networkExtras?: { [key: string]: string } & { collapsible?: CollapsiblePlacement };

  /**
   * An array of keywords to be sent when loading the ad.
   *
   * Setting keywords helps deliver more specific ads to a user based on the keywords.
   *
   * #### Example
   *
   * ```js
   * await Interstitial.createForAdRequest('ca-app-pub-3940256099942544/1033173712', {
   *   keywords: ['fashion', 'clothing'],
   * });
   * ```
   */
  keywords?: string[];

  /**
   * Sets a content URL for targeting purposes.
   *
   * Max length of 512.
   */
  contentUrl?: string;

  /**
   * key-value pairs used for custom targeting
   *
   * Takes an array of string key/value pairs.
   */
  customTargeting?: { [key: string]: string };

  /**
   * Sets the request agent string to identify the ad request's origin. Third party libraries that reference the Mobile
   * Ads SDK should call this method to denote the platform from which the ad request originated. For example, if a
   * third party ad network called "CoolAds network" mediates requests to the Mobile Ads SDK, it should call this
   * method with "CoolAds".
   *
   * #### Example
   *
   * ```js
   * await Interstitial.createForAdRequest('ca-app-pub-3940256099942544/1033173712', {
   *   requestAgent: 'CoolAds',
   * });
   * ```
   */
  requestAgent?: string;

  /**
   * Server Side Verification(SSV) Options
   * See [Google Mobile SDK Docs](https://developers.google.com/admob/android/ssv) for more information.
   */
  serverSideVerificationOptions?: ServerSideVerificationOptions;

  /**
   * Publisher provided identifier (PPID) for use in frequency capping, audience segmentation and targeting,
   * sequential ad rotation, and other audience-based ad delivery controls across devices.
   * See [this article](https://support.google.com/admanager/answer/2880055) for more information.
   */
  publisherProvidedId?: string;
}
