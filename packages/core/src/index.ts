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

/**
 * React Native bindings for Google Mobile Ads.
 *
 * ## Choose the smallest API that fits
 *
 * | Need | API and ownership |
 * | --- | --- |
 * | Keep direct create/load/show, `BannerAd`, or `NativeAd` | Classic classes/components; your code owns the instance |
 * | Show a fullscreen ad imperatively | `ad.show()` rejects when not loaded, already showing, or declined, so `.catch` it; a destroyed ad or invalid `showOptions` throw synchronously (programmer error) |
 * | Let React own one fullscreen ad lifecycle | Options-form fullscreen hooks; `useGAMInterstitialAd` for Ad Manager app events |
 * | Show app open ads from a cold-start loading screen and on warm foreground | `useAppOpenAdManager`; gate consent with `adUnitId: null`, not `autoLoad` |
 * | Let React own one native ad | `useNativeAd` with `NativeAdView` |
 * | Warm inventory, then poll at show time | `AdPoolProvider` + `usePooledAd`, or imperative `AdPools` outside React |
 * | Let native and GAM banner formats compete for one placement | `useMultiFormatAd`, or imperative `MultiFormatAdRequest` |
 * | Diagnose what this binary supports | `getAdCapabilities`; prefer presets over reproducing its matrix |
 * | Register test devices | Emulators/simulators are automatic; `TestDeviceIds.EMULATOR` is a classic-Android-only alias |
 *
 * Pools and multi-format requests are additive. Existing direct APIs remain supported.
 *
 * ## Deliberate v17 boundaries
 *
 * Multi-format requests return one winner; custom native formats and multi-count
 * (`numberOfAds` / `requestCount` above 1) are outside this surface. Scoped mediation adapter
 * packages integrate networks with Google Ad Manager; they are not alternative ad-pool hosts.
 * Compatibility shims remain in v17, with deprecated positional fullscreen-hook overloads
 * scheduled for removal in v18.
 *
 * ## Common v17 migrations
 *
 * | Before | Opt-in v17 path |
 * | --- | --- |
 * | Positional fullscreen hook plus a mount `load()` effect | Options object with `autoLoad`; branch on `status` |
 * | Direct fullscreen instance loaded well before use | Fullscreen preset + pool; poll immediately before showing |
 * | Separate native and banner requests for one flexible slot | One multi-format request; render the winning handle |
 *
 * Migration is optional. Do not add a provider to classic flows that do not need warmed
 * inventory, and do not use a pool when one hook-owned fullscreen ad is enough.
 *
 * ## First diagnostics
 *
 * - `useAdPool` reporting `absent` means the provider/config does not own that `poolId`; it is not
 *   a slow create.
 * - Two `usePooledAd` instances sharing a depth-1 display pool can starve each other. Give each
 *   placement an id or centralize polling.
 * - Never destroy hook-owned inventory. Call `release()` first when ownership must leave a hook.
 * - Options-form fullscreen hooks intentionally remain `idle` when `autoLoad` is false or
 *   `adUnitId` is null.
 * - Automatic fullscreen loading does not warm the next ad after `closed`; call `load()` when
 *   another impression is plausible.
 *
 * ## Mediation adapters
 *
 * This generated reference covers core. Public scoped adapters are published as
 * `@react-native-google-mobile-ads/applovin`, `facebook`, `inmobi`, `mintegral`, `moloco`,
 * `pangle`, `unity`, `vungle`, and `yandex`. Their package READMEs are the adapter references;
 * the private `_template` workspace is not published.
 *
 * @module
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
export { TestDeviceIds } from './TestDeviceIds';
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
  useAppOpenAdManager,
  type UseAppOpenAdManagerOptions,
  type UseAppOpenAdManagerResult,
  type UseAppOpenAdManagerStatus,
} from './hooks/useAppOpenAdManager';
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
export {
  useGAMInterstitialAd,
  type UseGAMInterstitialAdOptions,
  type UseGAMInterstitialAdResult,
} from './hooks/useGAMInterstitialAd';
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
export {
  useNativeAd,
  type UseNativeAdOptions,
  type UseNativeAdResult,
  type UseNativeAdStatus,
} from './hooks/useNativeAd';
export { RevenuePrecisions } from './common/constants';
export * from './types';
