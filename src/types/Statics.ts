import { AdsConsentStatus, AdsConsentDebugGeography } from './AdsConsent.interface';
import { MaxAdContentRating } from './MaxAdContentRating';
import { AdEventType } from './AdEventType';
import { RewardedAdEventType } from './RewardedAdEventType';
import { TestIds } from './TestIds';
import { BannerAdSize } from './BannerAdSize';

/**
 * googleAds.X
 */
export interface Statics {
  /**
   * This module version.
   */
  readonly SDK_VERSION: string;

  /**
   * AdsConsentStatus interface.
   */
  AdsConsentStatus: AdsConsentStatus;

  /**
   * AdsConsentDebugGeography interface.
   */
  AdsConsentDebugGeography: AdsConsentDebugGeography;

  /**
   * AdsConsentDebugGeography interface.
   */
  MaxAdContentRating: MaxAdContentRating;

  /**
   * AdEventType enum.
   */
  AdEventType: AdEventType;

  /**
   * RewardedAdEventType enum.
   */
  RewardedAdEventType: RewardedAdEventType;

  /**
   * TestIds interface
   */
  TestIds: TestIds;

  /**
   * Used to sets the size of an Advert.
   */
  BannerAdSize: BannerAdSize;
}
