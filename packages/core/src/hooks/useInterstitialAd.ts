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

import { InterstitialAd } from '../ads/InterstitialAd';
import type { AdHookReturns } from '../types/AdStates';
import type { RequestOptions } from '../types/RequestOptions';

import {
  useFullScreenAdForm,
  type FullScreenAdHookOptions,
  type UseFullScreenAdResultWithoutReward,
} from './useFullScreenAd';

/** Options object accepted by the v17 call form of `useInterstitialAd`. */
export type UseInterstitialAdOptions = FullScreenAdHookOptions;

/** Result of the v17 call form. Interstitials carry no reward. */
export type UseInterstitialAdResult = UseFullScreenAdResultWithoutReward;

const createAd = (adUnitId: string, requestOptions: RequestOptions) =>
  InterstitialAd.createForAdRequest(adUnitId, requestOptions);

/**
 * React Hook for Interstitial Ad.
 *
 * @deprecated Pass an options object instead: `useInterstitialAd({ adUnitId })`.
 * The positional form is removed in v18. The options form loads on its own,
 * accepts `autoLoad`, and reports a single `status`. See the v17 migration guide.
 *
 * @param adUnitId The Ad Unit ID for the Interstitial Ad. You can find this on your Google Mobile Ads dashboard. You can destroy ad instance by setting this value to null.
 * @param requestOptions Optional RequestOptions used to load the ad.
 */
export function useInterstitialAd(
  adUnitId: string | null,
  requestOptions?: RequestOptions,
): Omit<AdHookReturns, 'reward' | 'isEarnedReward'>;
/**
 * React Hook for Interstitial Ad.
 *
 * Loads as soon as it can, unless `autoLoad` is `false`. Read `status` for the
 * ad's current position in its lifecycle, and the fields beside it for what has
 * already happened to it.
 *
 * #### Example
 *
 * ```jsx
 * const { status, show } = useInterstitialAd({
 *   adUnitId: TestIds.INTERSTITIAL,
 *   autoLoad: consentReady,
 * });
 *
 * return <Button title="Continue" disabled={status !== 'loaded'} onPress={() => show()} />;
 * ```
 */
export function useInterstitialAd(options: UseInterstitialAdOptions): UseInterstitialAdResult;
export function useInterstitialAd(
  idOrOptions: string | null | UseInterstitialAdOptions,
  requestOptions: RequestOptions = {},
): Omit<AdHookReturns, 'reward' | 'isEarnedReward'> | UseInterstitialAdResult {
  return useFullScreenAdForm('useInterstitialAd', createAd, idOrOptions, requestOptions, false);
}
