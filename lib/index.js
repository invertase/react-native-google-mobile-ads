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

import version from './version';

// import { SDK_VERSION } from '@invertase/react-native-google-ads';
export const SDK_VERSION = version;

export { default } from './googleMobileAds';
export { default as AdsConsentDebugGeography } from './AdsConsentDebugGeography';
export { default as AdsConsentStatus } from './AdsConsentStatus';
export { default as MaxAdContentRating } from './MaxAdContentRating';
export { default as TestIds } from './TestIds';
export { default as AdEventType } from './AdEventType';
export { default as BannerAdSize } from './BannerAdSize';
export { default as RewardedAdEventType } from './RewardedAdEventType';
export { default as AdsConsent } from './AdsConsent';
export { default as InterstitialAd } from './ads/InterstitialAd';
export { default as RewardedAd } from './ads/RewardedAd';
export { default as BannerAd } from './ads/BannerAd';
