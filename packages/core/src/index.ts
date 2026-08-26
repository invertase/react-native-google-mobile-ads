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
export {
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  AdsConsentStatus,
} from './specs/modules/NativeConsentModule';
export type {
  AdsConsentInfo,
  AdsConsentInfoOptions,
  AdsConsentInterface,
  AdsConsentUserChoices,
} from './specs/modules/NativeConsentModule';
export { AdsConsentPurposes } from './AdsConsentPurposes';
export { AdsConsentSpecialFeatures } from './AdsConsentSpecialFeatures';
export { MaxAdContentRating } from './MaxAdContentRating';
export { TestIds } from './TestIds';
export { AdEventType } from './AdEventType';
export { BannerAdSize, GAMBannerAdSize } from './BannerAdSize';
export { GAMAdEventType } from './GAMAdEventType';
export { NativeAdEventType } from './NativeAdEventType';
export { RewardedAdEventType } from './RewardedAdEventType';
export { AdsConsent } from './AdsConsent';
export { AppOpenAd } from './ads/AppOpenAd';
export { InterstitialAd } from './ads/InterstitialAd';
export { RewardedAd } from './ads/RewardedAd';
export { RewardedInterstitialAd } from './ads/RewardedInterstitialAd';
export { BannerAd } from './ads/BannerAd';
export type { MobileAd } from './ads/MobileAd';
export { NativeAd } from './ads/native-ad/NativeAd';
export { NativeAdView } from './ads/native-ad/NativeAdView';
export { NativeMediaView } from './ads/native-ad/NativeMediaView';
export { NativeAsset, NativeAssetType } from './ads/native-ad/NativeAsset';
export { GAMBannerAd } from './ads/GAMBannerAd';
export { GAMInterstitialAd } from './ads/GAMInterstitialAd';
export { MultiFormatAdRequest } from './ads/MultiFormatAdRequest';
export {
  MultiFormatBannerAdView,
  type MultiFormatBannerAdHandle,
  type MultiFormatBannerAdViewProps,
} from './ads/MultiFormatBannerAdView';
export { AdPools } from './AdPools';
export { getAdCapabilities } from './capabilities/getAdCapabilities';
export { AdPoolPresets } from './capabilities/AdPoolPresets';
export { MultiFormatAdPresets } from './capabilities/MultiFormatAdPresets';
export { NativeError } from './internal/NativeError';
export {
  type FullScreenAdHookOptions,
  type UseFullScreenAdResult,
  type UseFullScreenAdStatus,
} from './hooks/useFullScreenAd';
/*
 * The four fullscreen hooks carry `@deprecated` on their positional overload
 * only. Re-exporting the symbol is not a use of that overload, but the rule
 * cannot see which overload an export refers to, so it is disabled across this
 * block rather than at four separate call sites.
 */
/* eslint-disable @typescript-eslint/no-deprecated */
export {
  useAppOpenAd,
  type UseAppOpenAdOptions,
  type UseAppOpenAdResult,
} from './hooks/useAppOpenAd';
export {
  useInterstitialAd,
  type UseInterstitialAdOptions,
  type UseInterstitialAdResult,
} from './hooks/useInterstitialAd';
export {
  useRewardedAd,
  type UseRewardedAdOptions,
  type UseRewardedAdResult,
} from './hooks/useRewardedAd';
export {
  useRewardedInterstitialAd,
  type UseRewardedInterstitialAdOptions,
  type UseRewardedInterstitialAdResult,
} from './hooks/useRewardedInterstitialAd';
/* eslint-enable @typescript-eslint/no-deprecated */
export { useForeground } from './hooks/useForeground';
export { AdPoolProvider, type AdPoolProviderProps } from './hooks/AdPoolProvider';
export { useAdPool, type UseAdPoolResult, type UseAdPoolStatus } from './hooks/useAdPool';
export { usePooledAd, type UsePooledAdResult, type UsePooledAdStatus } from './hooks/usePooledAd';
export {
  useMultiFormatAd,
  type UseMultiFormatAdOptions,
  type UseMultiFormatAdResult,
  type UseMultiFormatAdStatus,
} from './hooks/useMultiFormatAd';
export { RevenuePrecisions } from './common/constants';
export * from './types';
