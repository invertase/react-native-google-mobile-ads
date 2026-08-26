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

import { AppOpenAd } from '../ads/AppOpenAd';
import type { AdHookReturns } from '../types/AdStates';
import type { RequestOptions } from '../types/RequestOptions';

import {
  useFullScreenAdForm,
  type FullScreenAdHookOptions,
  type UseFullScreenAdResultWithoutReward,
} from './useFullScreenAd';

/** Options object accepted by the v17 call form of `useAppOpenAd`. */
export type UseAppOpenAdOptions = FullScreenAdHookOptions;

/** Result of the v17 call form. App open ads carry no reward. */
export type UseAppOpenAdResult = UseFullScreenAdResultWithoutReward;

const createAd = (adUnitId: string, requestOptions: RequestOptions) =>
  AppOpenAd.createForAdRequest(adUnitId, requestOptions);

/**
 * React Hook for App Open Ad.
 *
 * @deprecated Pass an options object instead: `useAppOpenAd({ adUnitId })`.
 * The positional form is removed in v18. The options form loads on its own,
 * accepts `autoLoad`, and reports a single `status`. See the v17 migration guide.
 *
 * @param adUnitId The Ad Unit ID for the App Open Ad. You can find this on your Google Mobile Ads dashboard. You can destroy ad instance by setting this value to null.
 * @param requestOptions Optional RequestOptions used to load the ad.
 */
export function useAppOpenAd(
  adUnitId: string | null,
  requestOptions?: RequestOptions,
): Omit<AdHookReturns, 'reward' | 'isEarnedReward'>;
/**
 * React Hook for App Open Ad.
 *
 * Loads as soon as it can, unless `autoLoad` is `false`. App open ads are
 * usually conditional on something, so `autoLoad` is the field to reach for:
 *
 * ```jsx
 * const { status, show } = useAppOpenAd({
 *   adUnitId: TestIds.APP_OPEN,
 *   autoLoad: consentReady && !isFirstRun,
 * });
 * ```
 */
export function useAppOpenAd(options: UseAppOpenAdOptions): UseAppOpenAdResult;
export function useAppOpenAd(
  idOrOptions: string | null | UseAppOpenAdOptions,
  requestOptions: RequestOptions = {},
): Omit<AdHookReturns, 'reward' | 'isEarnedReward'> | UseAppOpenAdResult {
  return useFullScreenAdForm('useAppOpenAd', createAd, idOrOptions, requestOptions, false);
}
