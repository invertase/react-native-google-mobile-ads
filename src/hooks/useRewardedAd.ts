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

import { RewardedAd } from '../ads/RewardedAd';
import type { AdHookReturns } from '../types/AdStates';
import type { RequestOptions } from '../types/RequestOptions';

import {
  useFullScreenAdForm,
  type FullScreenAdHookOptions,
  type UseFullScreenAdResult,
} from './useFullScreenAd';

/** Options object accepted by the v17 call form of `useRewardedAd`. */
export type UseRewardedAdOptions = FullScreenAdHookOptions;

/** Result of the v17 call form, including the reward facts. */
export type UseRewardedAdResult = UseFullScreenAdResult;

const createAd = (adUnitId: string, requestOptions: RequestOptions) =>
  RewardedAd.createForAdRequest(adUnitId, requestOptions);

/**
 * React Hook for Rewarded Ad.
 *
 * @deprecated Pass an options object instead: `useRewardedAd({ adUnitId })`.
 * The positional form is removed in v18. The options form loads on its own,
 * accepts `autoLoad`, and reports a single `status`. See the v17 migration guide.
 *
 * @param adUnitId The Ad Unit ID for the Rewarded Ad. You can find this on your Google Mobile Ads dashboard. You can destroy ad instance by setting this value to null.
 * @param requestOptions Optional RequestOptions used to load the ad.
 */
export function useRewardedAd(
  adUnitId: string | null,
  requestOptions?: RequestOptions,
): AdHookReturns;
/**
 * React Hook for Rewarded Ad.
 *
 * Loads as soon as it can, unless `autoLoad` is `false`.
 *
 * `reward` is populated twice: at load with the item the ad advertises, and
 * again when the user earns it. `earnedReward` is what tells those apart.
 *
 * ```jsx
 * const { status, show, reward, earnedReward } = useRewardedAd({
 *   adUnitId: TestIds.REWARDED,
 * });
 *
 * // Before showing: reward describes what is on offer.
 * // After earning: earnedReward is true and the grant is safe to apply.
 * ```
 */
export function useRewardedAd(options: UseRewardedAdOptions): UseRewardedAdResult;
export function useRewardedAd(
  idOrOptions: string | null | UseRewardedAdOptions,
  requestOptions: RequestOptions = {},
): AdHookReturns | UseRewardedAdResult {
  return useFullScreenAdForm('useRewardedAd', createAd, idOrOptions, requestOptions, true);
}
