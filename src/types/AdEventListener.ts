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

import { AdEventType } from '../AdEventType';
import { GAMAdEventType } from '../GAMAdEventType';
import { RewardedAdEventType } from '../RewardedAdEventType';
import { AppEvent } from './AppEvent';
import { RewardedAdReward } from './RewardedAdReward';

export type AdEventPayload<T extends AdEventType | RewardedAdEventType | GAMAdEventType = never> =
  T extends AdEventType.ERROR
    ? Error
    : T extends RewardedAdEventType
      ? RewardedAdReward
      : T extends GAMAdEventType
        ? AppEvent
        : undefined;

export type AdEventListener<T extends AdEventType | RewardedAdEventType | GAMAdEventType = never> =
  (payload: AdEventPayload<T>) => void;
