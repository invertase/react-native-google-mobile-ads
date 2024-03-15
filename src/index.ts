/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { version } from './version';

// import { SDK_VERSION } from 'react-native-google-mobile-ads';
export const SDK_VERSION = version;

export { default, MobileAds } from './MobileAds';
export { AdsConsentDebugGeography } from './AdsConsentDebugGeography';
export { AdsConsentPurposes } from './AdsConsentPurposes';
export { AdsConsentSpecialFeatures } from './AdsConsentSpecialFeatures';
export { AdsConsentStatus } from './AdsConsentStatus';
export { AdsConsentPrivacyOptionsRequirementStatus } from './AdsConsentPrivacyOptionsRequirementStatus';
export { MaxAdContentRating } from './MaxAdContentRating';
export { TestIds } from './TestIds';
export { AdEventType } from './AdEventType';
export { BannerAdSize } from './BannerAdSize';
export { GAMAdEventType } from './GAMAdEventType';
export { RewardedAdEventType } from './RewardedAdEventType';
export { AdsConsent } from './AdsConsent';
export { AppOpenAd } from './ads/AppOpenAd';
export { InterstitialAd } from './ads/InterstitialAd';
export { RewardedAd } from './ads/RewardedAd';
export { RewardedInterstitialAd } from './ads/RewardedInterstitialAd';
export { BannerAd } from './ads/BannerAd';
export { GAMBannerAd } from './ads/GAMBannerAd';
export { GAMInterstitialAd } from './ads/GAMInterstitialAd';
export { useAppOpenAd } from './hooks/useAppOpenAd';
export { useInterstitialAd } from './hooks/useInterstitialAd';
export { useRewardedAd } from './hooks/useRewardedAd';
export { useRewardedInterstitialAd } from './hooks/useRewardedInterstitialAd';
export { RevenuePrecisions } from './common/constants';
export * from './types';
