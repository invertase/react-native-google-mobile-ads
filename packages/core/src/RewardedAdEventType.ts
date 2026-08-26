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

export enum RewardedAdEventType {
  /**
   * An event fired when a rewarded ad has loaded.
   *
   * This type differs from `AdEventType.LOADED` as when a rewarded ad is loaded,
   * an additional data payload is provided to the event handler containing the ad reward
   * (assuming the user earns the reward).
   *
   * The reward contains a `type` and `amount`.
   *
   * #### Example
   *
   * ```js
   * import { RewardedAdEventType } from 'react-native-google-mobile-ads';
   *
   * rewardedAd.addEventListener(RewardedAdEventType.LOADED, (reward) => {
   *   console.log(`Rewarded Ad loaded with ${data.amount} ${data.type} as reward`);
   *   // E.g. "Rewarded Ad loaded with 50 coins as reward"
   *   rewardedAd.show();
   * });
   * ```
   */
  LOADED = 'rewarded_loaded',

  /**
   * An event fired when the user earned the reward for the video. If the user does not earn a reward,
   * the `AdEventType.CLOSED` event will be fired with no rewarded event.
   *
   * The reward contains a `type` and `amount`.
   *
   * #### Example
   *
   * ```js
   * import { RewardedAdEventType } from 'react-native-google-mobile-ads';
   *
   * rewardedAd.addEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
   *   console.log(`User earned ${data.amount} ${data.type}`);
   *   // E.g. "User earned 50 coins"
   * });
   * ```
   */
  EARNED_REWARD = 'rewarded_earned_reward',
}
