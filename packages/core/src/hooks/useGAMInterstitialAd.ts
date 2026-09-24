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

import { useRef } from 'react';

import { GAMInterstitialAd } from '../ads/GAMInterstitialAd';
import { GAMAdEventType } from '../GAMAdEventType';
import type { AppEvent } from '../types/AppEvent';
import type { RequestOptions } from '../types/RequestOptions';

import {
  useFullScreenAdForm,
  type FullScreenAdHookOptions,
  type UseFullScreenAdResultWithoutReward,
} from './useFullScreenAd';

/**
 * Options object accepted by `useGAMInterstitialAd`.
 *
 * Options-form only: there is no deprecated positional overload.
 */
export type UseGAMInterstitialAdOptions = FullScreenAdHookOptions & {
  /**
   * Called when the ad receives a Google Ad Manager app event.
   *
   * Not mirrored into hook state. Changing this callback does not recreate the
   * ad instance; the latest function is used when an event arrives.
   */
  onAppEvent?: (event: AppEvent) => void;
};

/** Result of `useGAMInterstitialAd`. GAM interstitials carry no reward. */
export type UseGAMInterstitialAdResult = UseFullScreenAdResultWithoutReward;

/**
 * React Hook for Google Ad Manager Interstitial Ad.
 *
 * Loads as soon as it can, unless `autoLoad` is `false`. Read `status` for the
 * ad's current position in its lifecycle, and the fields beside it for what has
 * already happened to it. Pass `onAppEvent` for Ad Manager app events.
 *
 * #### Example
 *
 * ```jsx
 * const { status, show } = useGAMInterstitialAd({
 *   adUnitId: TestIds.GAM_INTERSTITIAL,
 *   autoLoad: consentReady,
 *   onAppEvent: ({ name, data }) => {
 *     console.log(name, data);
 *   },
 * });
 *
 * return <Button title="Continue" disabled={status !== 'loaded'} onPress={() => show()} />;
 * ```
 */
export function useGAMInterstitialAd(
  options: UseGAMInterstitialAdOptions,
): UseGAMInterstitialAdResult {
  const onAppEventRef = useRef(options.onAppEvent);
  onAppEventRef.current = options.onAppEvent;

  const createAd = (adUnitId: string, requestOptions: RequestOptions) => {
    const ad = GAMInterstitialAd.createForAdRequest(adUnitId, requestOptions);
    ad.addAdEventListener(GAMAdEventType.APP_EVENT, event => {
      onAppEventRef.current?.(event);
    });
    return ad;
  };

  // Options-form only: the shared helper still types a legacy union because the
  // four older hooks keep a positional overload.
  return useFullScreenAdForm(
    'useGAMInterstitialAd',
    createAd,
    options,
    {},
    false,
  ) as UseGAMInterstitialAdResult;
}
