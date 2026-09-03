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

import { RewardedInterstitialAd } from '../ads/RewardedInterstitialAd';
import type { AdHookReturns } from '../types/AdStates';
import type { RequestOptions } from '../types/RequestOptions';

import {
  useFullScreenAdForm,
  type FullScreenAdHookOptions,
  type UseFullScreenAdResult,
} from './useFullScreenAd';

/** Options object accepted by the v17 call form of `useRewardedInterstitialAd`. */
export type UseRewardedInterstitialAdOptions = FullScreenAdHookOptions;

/** Result of the v17 call form, including the reward facts. */
export type UseRewardedInterstitialAdResult = UseFullScreenAdResult;

const createAd = (adUnitId: string, requestOptions: RequestOptions) =>
  RewardedInterstitialAd.createForAdRequest(adUnitId, requestOptions);

/**
 * React Hook for Rewarded Interstitial Ad.
 *
 * @deprecated Pass an options object instead:
 * `useRewardedInterstitialAd({ adUnitId })`. The positional form is removed in
 * v18. The options form loads on its own, accepts `autoLoad`, and reports a
 * single `status`. See the v17 migration guide.
 *
 * @param adUnitId The Ad Unit ID for the Rewarded Interstitial Ad. You can find this on your Google Mobile Ads dashboard. You can destroy ad instance by setting this value to null.
 * @param requestOptions Optional RequestOptions used to load the ad.
 */
export function useRewardedInterstitialAd(
  adUnitId: string | null,
  requestOptions?: RequestOptions,
): AdHookReturns;
/**
 * React Hook for Rewarded Interstitial Ad.
 *
 * Loads as soon as it can, unless `autoLoad` is `false`. Same reward semantics
 * as `useRewardedAd`: `reward` describes the offer at load and the grant once
 * `earnedReward` is true.
 *
 * Android classic has no preload slot for this format, so pool-based warming is
 * unavailable there. This hook is the load-on-demand path and works on both
 * platforms.
 */
export function useRewardedInterstitialAd(
  options: UseRewardedInterstitialAdOptions,
): UseRewardedInterstitialAdResult;
export function useRewardedInterstitialAd(
  idOrOptions: string | null | UseRewardedInterstitialAdOptions,
  requestOptions: RequestOptions = {},
): AdHookReturns | UseRewardedInterstitialAdResult {
  return useFullScreenAdForm(
    'useRewardedInterstitialAd',
    createAd,
    idOrOptions,
    requestOptions,
    true,
  );
}
