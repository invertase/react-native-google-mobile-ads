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
 * For more information, see [here](https://developers.google.com/admob/ump/android/quick-start#delay_app_measurement_optional).
 */

export interface AdsConsentInterface {
  /**
   * Requests user consent information.
   *
   * The response from this method provides information about consent form availability and consent status.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from 'react-native-google-mobile-ads';
   *
   * const consentInfo = await AdsConsent.requestInfoUpdate();
   * console.log('A consent form is available:', consentInfo.isConsentFormAvailable);
   * console.log('User consent status:', consentInfo.status);
   * ```
   * @param options An AdsConsentInfoOptions interface.
   */
  requestInfoUpdate(options?: AdsConsentInfoOptions): Promise<AdsConsentInfo>;

  /**
   * Shows a Google-rendered user consent form.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';
   *
   * async function requestConsent() {
   *   const consentInfo = await AdsConsent.requestInfoUpdate();
   *
   *   // Check if user requires consent
   *   if (
   *     consentInfo.isConsentFormAvailable &&
   *     (consentInfo.status === AdsConsentStatus.UNKNOWN ||
   *       consentInfo.status === AdsConsentStatus.REQUIRED)) {
   *     // Show a Google-rendered form
   *     const formResult = await AdsConsent.showForm();
   *
   *     console.log('User consent obtained: ', formResult.status === AdsConsentStatus.OBTAINED);
   *   }
   * }
   *
   * ```
   */
  showForm(): Promise<AdsConsentFormResult>;

  /**
   * Resets the UMP SDK state.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from '@invertase/react-native-google-ads';
   *
   * AdsConsent.reset();
   * ```
   */
  reset(): void;
}

/**
 * The options used when requesting consent information.
 */
export interface AdsConsentInfoOptions {
  /**
   * Sets the debug geography to locally test consent.
   */
  debugGeography?: AdsConsentDebugGeography;

  /**
   * Set to `true` to provide the option for the user to accept being shown personalized ads, defaults to `false`.
   */
  tagForUnderAgeOfConsent?: boolean;

  /**
   * An array of test device IDs to allow.
   */
  testDeviceIdentifiers?: string[];
}

/**
 * The result of a Google-rendered consent form.
 */
export interface AdsConsentFormResult {
  /**
   * The consent status of the user after closing the consent form.
   *
   *  - `UNKNOWN`: Unknown consent status.
   *  - `REQUIRED`: User consent required but not yet obtained.
   *  - `NOT_REQUIRED`: User consent not required.
   *  - `OBTAINED`: User consent already obtained.
   */
  status: AdsConsentStatus;
}

/**
 * The result of requesting info about a users consent status.
 */
export interface AdsConsentInfo {
  /**
   * The consent status of the user.
   *
   *  - `UNKNOWN`: Unknown consent status.
   *  - `REQUIRED`: User consent required but not yet obtained.
   *  - `NOT_REQUIRED`: User consent not required.
   *  - `OBTAINED`: User consent already obtained.
   */
  status: AdsConsentStatus;

  /**
   * If `true` a consent form is available.
   */
  isConsentFormAvailable: boolean;
}
