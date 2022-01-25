import { AdsConsentDebugGeography } from '../AdsConsentDebugGeography';
import { AdsConsentStatus } from '../AdsConsentStatus';

/**
 * Under the Google [EU User Consent Policy](https://www.google.com/about/company/consentstaging.html), you must make certain disclosures to your users in the European Economic Area (EEA)
 * and obtain their consent to use cookies or other local storage, where legally required, and to use personal data
 * (such as AdID) to serve ads. This policy reflects the requirements of the EU ePrivacy Directive and the
 * General Data Protection Regulation (GDPR).
 *
 * It is recommended that you determine the status of a user's consent at every app launch. The user consent status is held
 * on the device until a condition changes which requires the user to consent again, such as a change in publishers.
 *
 * For more information, see [here](https://developers.google.com/admob/android/eu-consent#delay_app_measurement_optional).
 */

/**
 * A AdProvider interface returned from `AdsConsent.getProviders`.
 */
export interface AdProvider {
  /**
   * A provider company ID.
   */
  companyId: string;

  /**
   * A provider company name.
   */
  companyName: string;

  /**
   * A fully formed URL for the privacy policy of the provider.
   */
  privacyPolicyUrl: string;
}

export interface AdsConsentInterface {
  /**
   * Requests user consent for a given list of publisher IDs.
   *
   * The list of publisher IDs can be obtained from the settings panel on the Google Mobile Ads console. If the list of
   * publisher IDs has changed since the last time a user provided consent, their consent status will be reset to
   * 'UNKNOWN' and they must provide consent again.
   *
   * If the request fails with the error "Could not parse Event FE preflight response", this means the state of your
   * Google Mobile Ads account is not complete. Ensure you have validated your account and have setup valid payment
   * information. This error is also thrown when a Publisher ID is invalid.
   *
   * The response from this method provides request location and consent status properties.
   *
   * If request location is within the EEA or unknown, and the consent status is also unknown, you
   * must request consent via the `showForm()` method or your own means.
   *
   * If the consent status is not unknown, the user has already previously provided consent for the current publisher
   * scope.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from 'react-native-google-mobile-ads';
   *
   * const consent = await AdsConsent.requestInfoUpdate(['pub-6189033257628554']);
   * console.log('User location within EEA or Unknown:', consent.isRequestLocationInEeaOrUnknown);
   * console.log('User consent status:', consent.status);
   * ```
   *
   * @param publisherIds A list of publisher IDs found on your Google Mobile Ads dashboard.
   */
  requestInfoUpdate(publisherIds: string[]): Promise<AdsConsentInfo>;

  /**
   * Shows a Google-rendered user consent form.
   *
   * The Google-rendered consent form is a full-screen configurable form that displays over your app content. The form
   * allows the following configuration options:
   *
   *
   * 1. Consent to view personalized ads (via `withPersonalizedAds`).
   * 2. Consent to view non-personalized ads (via `withNonPersonalizedAds`).
   * 3. Use a paid version of the app instead of viewing ads (via `withAdFree`).
   *
   * Every consent form requires a privacy policy URL which outlines the usage of your application.
   *
   * You should review the consent text carefully: what appears by default is a message that might be appropriate if
   * you use Google to monetize your app.
   *
   * If providing an ad-free version of your app, ensure you handle this once the form has been handled by the user
   * via the `userPrefersAdFree` property. The users preference on consent is automatically forwarded onto the Google
   * Mobile SDKs and saved.
   *
   * If the user is outside of the EEA, the request form will error.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';
   *
   * async function requestConsent() {
   *   const consent = await AdsConsent.requestInfoUpdate(['pub-6189033257628554']);
   *
   *   // Check if user requires consent
   *   if (consent.isRequestLocationInEeaOrUnknown && consent.status === AdsConsentStatus.UNKNOWN) {
   *     // Show a Google-rendered form
   *     const result = await AdsConsent.showForm({
   *       privacyPolicy: 'https://invertase.io/privacy-policy',
   *       withPersonalizedAds: true,
   *       withNonPersonalizedAds: true,
   *       withAdFree: true,
   *     });
   *
   *     console.log('User accepted personalized: ', result.status === AdsConsentStatus.PERSONALIZED);
   *     console.log('User accepted non-personalized: ', result.status === AdsConsentStatus.NON_PERSONALIZED);
   *     console.log('User prefers Ad Free version of app: ', result.userPrefersAdFree);
   *   }
   * }
   *
   * ```
   *
   * @param options An AdsConsentFormOptions interface to control the Google-rendered form.
   */
  showForm(options: AdsConsentFormOptions): Promise<AdsConsentFormResult>;

  /**
   * Returns a list of ad providers currently in use for the given Google Mobile Ads App ID.
   *
   * If requesting consent from the user via your own method, this list of ad providers must be shown to the user
   * for them to accept consent.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from 'react-native-google-mobile-ads';
   *
   * const providers = await AdsConsent.getAdProviders();
   * ```
   */
  getAdProviders(): Promise<AdProvider[]>;

  /**
   * Sets the debug geography to locally test consent.
   *
   * If debugging on an emulator (where location cannot be determined) or outside of the EEA,
   * it is possible set your own location to test how your app handles different scenarios.
   *
   * If using a real device, ensure you have set it as a test device via `addTestDevice()` otherwise this method will have
   * no effect.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent, AdsConsentDebugGeography } from 'react-native-google-mobile-ads';
   *
   * // Set disabled
   * await AdsConsentDebugGeography.setDebugGeography(AdsConsentDebugGeography.DISABLED);
   *
   * // Set within EEA
   * await AdsConsentDebugGeography.setDebugGeography(AdsConsentDebugGeography.EEA);
   *
   * // Set outside EEA
   * await AdsConsentDebugGeography.setDebugGeography(AdsConsentDebugGeography.NOT_EEA);
   * ```
   *
   * @param geography The debug geography location.
   */
  setDebugGeography(geography: AdsConsentDebugGeography): Promise<void>;

  /**
   * Manually update the consent status of the user.
   *
   * This method is used when providing your own means of user consent. If using the Google-rendered form via `showForm()`,
   * the consent status is automatically set and calling this method is not required.
   *
   * This method can also be used to reset the consent status, by setting it to `AdsConsentStatus.UNKNOWN`, which may be useful in certain circumstances.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';
   *
   * // User accepted personalized ads
   * await AdsConsent.setStatus(AdsConsentStatus.PERSONALIZED);
   * ```
   *
   * @param status The user consent status.
   */
  setStatus(status: AdsConsentStatus): Promise<void>;

  /**
   * Returns the current consent status of the user.
   *
   * > The user consent status may change at any time, therefore don't reuse old values locally and always request the current value at any time consent is required.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from 'react-native-google-mobile-ads';
   *
   * const status = await AdsConsent.getStatus();
   * ```
   */
  getStatus(): Promise<AdsConsentStatus>;

  /**
   * If a publisher is aware that the user is under the age of consent, all ad requests must set TFUA (Tag For Users
   * Under the Age of consent in Europe). This setting takes effect for all future ad requests.
   *
   * Once the TFUA setting is enabled, the Google-rendered consent form will fail to load. All ad requests that include
   * TFUA will be made ineligible for personalized advertising and remarketing. TFUA disables requests to third-party
   * ad technology providers, such as ad measurement pixels and third-party ad servers.
   *
   * To remove TFUA from ad requests, set the value to `false`.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from 'react-native-google-mobile-ads';
   *
   * // User is under age of consent
   * await AdsConsent.setTagForUnderAgeOfConsent(true);
   * ```
   *
   * @param tag The boolean value to tag for under age consent.
   */
  setTagForUnderAgeOfConsent(tag: boolean): Promise<void>;

  /**
   * If using a real device to test, ensure the device ID is provided to the Google Mobile Ads SDK so any mock debug locations
   * can take effect.
   *
   * Emulators are automatically on the allowlist and should require no action.
   *
   * If you are seeing real ad activity from a test device, examine logcat / console
   * during execution in association with google mobile ads test device documentation to
   * configure your device correctly.
   *
   * @param deviceIds An array of testing device ID.
   */
  addTestDevices(deviceIds: string[]): Promise<void>;
}

/**
 * The options used to show on the Google-rendered consent form. At least one of `withAdFree`, `withPersonalizedAds` and `WithNonPersonalizedAds` needs to be set to `true`.
 */
export interface AdsConsentFormOptions {
  /**
   * A fully formed HTTP or HTTPS privacy policy URL for your application.
   *
   * Users will have the option to visit this web page before consenting to ads.
   */
  privacyPolicy: string;

  /**
   * Set to `true` to provide the option for the user to accept being shown personalized ads, defaults to `false`.
   */
  withPersonalizedAds?: boolean;

  /**
   * Set to `true` to provide the option for the user to accept being shown non-personalized ads, defaults to `false`.
   */
  withNonPersonalizedAds?: boolean;

  /**
   * Set to `true` to provide the option for the user to choose an ad-free version of your app, defaults to `false`.
   *
   * If the user chooses this option, you must handle it as required (e.g. navigating to a paid version of the app,
   * or a subscribe view).
   */
  withAdFree?: boolean;
}

/**
 * The result of a Google-rendered consent form.
 */
export interface AdsConsentFormResult {
  /**
   * The consent status of the user after closing the consent form.
   *
   * - UNKNOWN: The form was unable to determine the users consent status.
   * - NON_PERSONALIZED: The user has accepted non-personalized ads.
   * - PERSONALIZED: The user has accepted personalized ads.
   */
  status: AdsConsentStatus;

  /**
   * If `true`, the user requested an ad-free version of your application.
   */
  userPrefersAdFree: boolean;
}

/**
 * The result of requesting info about a users consent status.
 */
export interface AdsConsentInfo {
  /**
   * The consent status of the user.
   *
   * - UNKNOWN: The consent status is unknown and the user must provide consent to show ads if they are within the EEA or location is also unknown.
   * - NON_PERSONALIZED: The user has accepted non-personalized ads.
   * - PERSONALIZED: The user has accepted personalized ads.
   */
  status: AdsConsentStatus;

  /**
   * If `true` the user is within the EEA or their location could not be determined.
   */
  isRequestLocationInEeaOrUnknown: boolean;
}
