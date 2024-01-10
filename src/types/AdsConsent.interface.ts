import { TCModel } from '@iabtcf/core';
import { AdsConsentDebugGeography } from '../AdsConsentDebugGeography';
import { AdsConsentStatus } from '../AdsConsentStatus';
import { AdsConsentPrivacyOptionsRequirementStatus } from '../AdsConsentPrivacyOptionsRequirementStatus';

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
  showForm(): Promise<AdsConsentInfo>;

  /**
   * Presents a privacy options form if privacyOptionsRequirementStatus is required.
   */
  showPrivacyOptionsForm(): Promise<AdsConsentInfo>;

  /**
   * Loads a consent form and immediately presents it if consentStatus is required.
   *
   * This method is intended for the use case of showing a form if needed when the app starts.
   */
  loadAndShowConsentFormIfRequired(): Promise<AdsConsentInfo>;

  /**
   * Returns the UMP Consent Information from the last known session.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from '@invertase/react-native-google-ads';
   *
   * const consentInfo = await AdsConsent.getConsentInfo();
   * ```
   */
  getConsentInfo(): Promise<AdsConsentInfo>;

  /**
   * Returns the value stored under the `IABTCF_TCString` key
   * in NSUserDefaults (iOS) / SharedPreferences (Android) as
   * defined by the IAB Europe Transparency & Consent Framework.
   *
   * More information available here:
   * https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md#in-app-details
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from '@invertase/react-native-google-ads';
   *
   * const tcString = await AdsConsent.getTCString();
   * ```
   */
  getTCString(): Promise<string>;

  /**
   * Returns the TC Model of the saved IAB TCF 2.0 String.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from '@invertase/react-native-google-ads';
   *
   * const tcModel = await AdsConsent.getTCModel();
   * ```
   */
  getTCModel(): Promise<TCModel>;

  /**
   * Returns the value stored under the `IABTCF_gdprApplies` key
   * in NSUserDefaults (iOS) / SharedPreferences (Android) as
   * defined by the IAB Europe Transparency & Consent Framework.
   *
   * More information available here:
   * https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md#in-app-details
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from '@invertase/react-native-google-ads';
   *
   * await AdsConsent.requestInfoUpdate();
   * const gdprApplies = await AdsConsent.getGdprApplies();
   * ```
   */
  getGdprApplies(): Promise<boolean>;

  /**
   * Returns the value stored under the `IABTCF_PurposeConsents` key
   * in NSUserDefaults (iOS) / SharedPreferences (Android) as
   * defined by the IAB Europe Transparency & Consent Framework.
   *
   * More information available here:
   * https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md#in-app-details
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from '@invertase/react-native-google-ads';
   *
   * await AdsConsent.requestInfoUpdate();
   * const purposeConsents = await AdsConsent.getPurposeConsents();
   * const hasConsentForPurposeOne = purposeConsents.startsWith("1");
   * ```
   */
  getPurposeConsents(): Promise<string>;

  /**
   * Provides information about a user's consent choices.
   *
   * #### Example
   *
   * ```js
   * import { AdsConsent } from '@invertase/react-native-google-ads';
   *
   * const { storeAndAccessInformationOnDevice } = await AdsConsent.getUserChoices();
   * ```
   */
  getUserChoices(): Promise<AdsConsentUserChoices>;

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
   * Indicates whether the app has completed the necessary steps for gathering updated user consent.
   */
  canRequestAds: boolean;

  /**
   * Privacy options requirement status.
   */
  privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus;

  /**
   * If `true` a consent form is available.
   */
  isConsentFormAvailable: boolean;
}

/**
 * The options used when requesting consent information.
 *
 * https://vendor-list.consensu.org/v2/vendor-list.json
 * https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework
 */
export interface AdsConsentUserChoices {
  /**
   * Your device can be identified based on a scan of your device's
   * unique combination of characteristics.
   *
   * Vendors can:
   *   - Create an identifier using data collected via actively scanning a device for
   *   - specific characteristics, e.g. installed fonts or screen resolution.
   *   - Use such an identifier to re-identify a device.
   */
  activelyScanDeviceCharacteristicsForIdentification: boolean;
  /**
   * Market research can be used to learn more about the audiences who visit sites/apps and view ads.
   *
   * To apply market research to generate audience insights vendors can:
   *   - Provide aggregate reporting to advertisers or their representatives about
   *     the audiences reached by their ads, through panel-based and similarly derived insights.
   *   - Provide aggregate reporting to publishers about the audiences that were served or
   *     interacted with content and/or ads on their property by applying
   *     panel-based and similarly derived insights.
   *   - Associate offline data with an online user for the purposes of
   *     market research to generate audience insights if vendors have declared to match and
   *     combine offline data sources (Feature 1)
   *   - Combine this information with other information previously collected including from
   *     across websites and apps.
   *
   * Vendors cannot:
   *   - Measure the performance and effectiveness of ads that a specific user was served or
   *     interacted with, without a Legal Basis to measure ad performance.
   *   - Measure which content a specific user was served and how they interacted with it,
   *     without a Legal Basis to measure content performance.
   */
  applyMarketResearchToGenerateAudienceInsights: boolean;
  /**
   * A profile can be built about you and your interests to show you personalised ads
   * that are relevant to you.
   *
   * To create a personalised ads profile vendors can:
   *   - Collect information about a user, including a user's activity, interests,
   *     demographic information, or location, to create or edit a user profile for use
   *     in personalised advertising.
   *   - Combine this information with other information previously collected,
   *     including from across websites and apps, to create or edit a user profile
   *     for use in personalised advertising.
   */
  createAPersonalisedAdsProfile: boolean;
  /**
   * A profile can be built about you and your interests to show you personalised content
   * that is relevant to you.
   *
   * To create a personalised content profile vendors can:
   *   - Collect information about a user, including a user's activity, interests, visits to
   *     sites or apps, demographic information, or location, to create or edit a user profile
   *     for personalising content.
   *   - Combine this information with other information previously collected,
   *     including from across websites and apps, to create or edit a user profile for use
   *     in personalising content.
   */
  createAPersonalisedContentProfile: boolean;
  /**
   * Your data can be used to improve existing systems and software,
   * and to develop new products
   *
   * To develop new products and improve products vendors can:
   *   - Use information to improve their existing products with new features and
   *     to develop new products
   *   - Create new models and algorithms through machine learning
   *
   * Vendors cannot:
   *   - Conduct any other data processing operation allowed under
   *     a different purpose under this purpose
   */
  developAndImproveProducts: boolean;
  /**
   * The performance and effectiveness of ads that you see or interact with can be measured.
   *
   * To measure ad performance vendors can:
   *   - Measure whether and how ads were delivered to and interacted with by a user
   *   - Provide reporting about ads including their effectiveness and performance
   *   - Provide reporting about users who interacted with ads using data observed during
   *     the course of the user's interaction with that ad
   *   - Provide reporting to publishers about the ads displayed on their property
   *   - Measure whether an ad is serving in a suitable editorial environment (brand-safe) context
   *   - Determine the percentage of the ad that had the opportunity to be seen and
   *     the duration of that opportunity
   *   - Combine this information with other information previously collected,
   *     including from across websites and apps
   *
   * Vendors cannot:
   *   - Apply panel- or similarly-derived audience insights data to ad measurement data
   *     without a Legal Basis to apply market research to generate audience insights (Purpose 9)
   */
  measureAdPerformance: boolean;
  /**
   * The performance and effectiveness of content that you see or interact with can be measured.
   *
   * To measure content performance vendors can:
   *   - Measure and report on how content was delivered to and interacted with by users.
   *   - Provide reporting, using directly measurable or known information, about users who
   *     interacted with the content
   *   - Combine this information with other information previously collected,
   *     including from across websites and apps.
   *
   * Vendors cannot:
   *   - Measure whether and how ads (including native ads) were delivered to and
   *     interacted with by a user.
   *   - Apply panel- or similarly derived audience insights data to ad measurement
   *     data without a Legal Basis to apply market research to generate audience insights (Purpose 9)
   */
  measureContentPerformance: boolean;
  /**
   * Ads can be shown to you based on the content you’re viewing,
   * the app you’re using, your approximate location, or your device type.
   *
   * To do basic ad selection vendors can:
   *  - Use real-time information about the context in which the ad will be shown,
   *    to show the ad, including information about the content and the device, such as:
   *    device type and capabilities, user agent, URL, IP address
   *  - Use a user’s non-precise geolocation data
   *  - Control the frequency of ads shown to a user.
   *  - Sequence the order in which ads are shown to a user.
   *  - Prevent an ad from serving in an unsuitable editorial (brand-unsafe) context
   *
   * Vendors cannot:
   *  - Create a personalised ads profile using this information for the selection of
   *    future ads without a separate legal basis to create a personalised ads profile.
   *  - N.B. Non-precise means only an approximate location involving at least a radius
   *    of 500 meters is permitted.
   */
  selectBasicAds: boolean;
  /**
   * Personalised ads can be shown to you based on a profile about you.
   *
   * To select personalised ads vendors can:
   *   - Select personalised ads based on a user profile or other historical user data,
   *     including a user’s prior activity, interests, visits to sites or apps, location,
   *     or demographic information.
   */
  selectPersonalisedAds: boolean;
  /**
   * Personalised content can be shown to you based on a profile about you.
   *
   * To select personalised content vendors can:
   *   - Select personalised content based on a user profile or other historical user data,
   *     including a user’s prior activity, interests, visits to sites or apps, location,
   *     or demographic information.
   */
  selectPersonalisedContent: boolean;
  /**
   * Cookies, device identifiers, or other information can be stored or
   * accessed on your device for the purposes presented to you.
   *
   * Vendors can:
   *   - Store and access information on the device such as cookies and
   *     device identifiers presented to a user.
   */
  storeAndAccessInformationOnDevice: boolean;
  /**
   * Your precise geolocation data can be used in support of one or more purposes.
   * This means your location can be accurate to within several meters.
   *
   * Vendors can:
   *   - Collect and process precise geolocation data in support of one or more purposes.
   *   - Precise geolocation means that there are no restrictions on the precision of
   *     a user's location; this can be accurate to within several meters.
   */
  usePreciseGeolocationData: boolean;
}
