import { MaxAdContentRating } from '../MaxAdContentRating';

/**
 * The `RequestConfiguration` used when setting global ad settings via `setRequestConfiguration`.
 */
export interface RequestConfiguration {
  /**
   * The maximum ad content rating for all ads.  Google Mobile Ads returns ads at or below the specified level.
   *
   * Ratings are based on the [digital content label classifications](https://support.google.com/admob/answer/7562142).
   */
  maxAdContentRating?: MaxAdContentRating;

  /**
   * If `true`, indicates that you want your content treated as child-directed for purposes of COPPA.
   *
   * For purposes of the [Children's Online Privacy Protection Act (COPPA)](http://business.ftc.gov/privacy-and-security/children%27s-privacy),
   * there is a setting called "tag for child-directed treatment". By setting this tag, you certify that this notification
   * is accurate and you are authorized to act on behalf of the owner of the app. You understand that abuse of this
   * setting may result in termination of your Google account.
   */
  tagForChildDirectedTreatment?: boolean;

  /**
   * If `true`, indicates that you want the ad request to be handled in a manner suitable for users under the age of consent.
   *
   * You can mark your ad requests to receive treatment for users in the European Economic Area (EEA) under the age of consent.
   * This feature is designed to help facilitate compliance with the [General Data Protection Regulation (GDPR)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679).
   *
   * See the [Google Mobile SDK docs](https://developers.google.com/admob/android/targeting#ad_content_filtering) for more information.
   */
  tagForUnderAgeOfConsent?: boolean;

  /**
   * An array of test device IDs to add to the allowlist.
   *
   * If using an emulator, set the device ID to `EMULATOR`.
   */
  testDeviceIdentifiers?: string[];
}
