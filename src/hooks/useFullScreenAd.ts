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

import { useCallback, useEffect, useReducer } from 'react';

import { AdEventType } from '../AdEventType';
import { AppOpenAd } from '../ads/AppOpenAd';
import { InterstitialAd } from '../ads/InterstitialAd';
import { RewardedAd } from '../ads/RewardedAd';
import { RewardedInterstitialAd } from '../ads/RewardedInterstitialAd';
import { RewardedAdEventType } from '../RewardedAdEventType';
import { AdStates, AdHookReturns } from '../types/AdStates';
import { AdShowOptions } from '../types/AdShowOptions';
import { RewardedAdReward } from '../types/RewardedAdReward';
import type { PaidEvent } from '../types';

const initialState: AdStates = {
  isLoaded: false,
  isOpened: false,
  isClicked: false,
  isClosed: false,
  error: undefined,
  reward: undefined,
  isEarnedReward: false,
};

export function useFullScreenAd(
  ad: AppOpenAd | InterstitialAd | RewardedAd | RewardedInterstitialAd | null,
): AdHookReturns {
  const [state, dispatch] = useReducer(
    (prevState, newState) => ({ ...prevState, ...newState }) as AdStates,
    initialState,
  );
  const isShowing = state.isOpened && !state.isClosed;

  const load = useCallback(() => {
    if (ad) {
      dispatch(initialState);
      ad.load();
    }
  }, [ad]);

  const show = useCallback(
    (showOptions?: AdShowOptions) => {
      if (ad) {
        // ad.show returns a promise but we don't await
        // errors handled by library-consumer-provided functions
        void ad.show(showOptions);
      }
    },
    [ad],
  );

  useEffect(() => {
    dispatch(initialState);
    if (!ad) {
      return;
    }
    const unsubscribe = (ad as RewardedAd).addAdEventsListener(({ type, payload }) => {
      switch (type) {
        case AdEventType.LOADED:
          dispatch({ isLoaded: true });
          break;
        case AdEventType.OPENED:
          dispatch({ isOpened: true });
          break;
        case AdEventType.PAID:
          dispatch({ revenue: payload as unknown as PaidEvent });
          break;
        case AdEventType.CLOSED:
          dispatch({ isClosed: true, isLoaded: false });
          break;
        case AdEventType.CLICKED:
          dispatch({ isClicked: true });
          break;
        case AdEventType.ERROR:
          dispatch({ error: payload as Error });
          break;
        case RewardedAdEventType.LOADED:
          dispatch({ isLoaded: true, reward: payload as RewardedAdReward });
          break;
        case RewardedAdEventType.EARNED_REWARD:
          dispatch({ isEarnedReward: true, reward: payload as RewardedAdReward });
          break;
      }
    });
    return () => {
      unsubscribe();
    };
  }, [ad]);

  return {
    ...state,
    isShowing,
    load,
    show,
  };
}
