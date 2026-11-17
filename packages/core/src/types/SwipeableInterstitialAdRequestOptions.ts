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

import type { RequestOptions } from './RequestOptions';

export type SwipeableInterstitialSwipeDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Request options for {@link SwipeableInterstitialAd} (private beta).
 */
export interface SwipeableInterstitialAdRequestOptions extends RequestOptions {
  /**
   * Maximum seconds your app commits to holding the creative before dismissal eligibility.
   */
  maxScreenHoldDurationSeconds?: number;
  /** Optional creative size; defaults to full screen when omitted. */
  adSize?: { width: number; height: number };
  /** Next-Gen Android: request custom click gesture handling. */
  requestCustomClickGesture?: boolean;
  /** Enable swipe-direction custom click gestures. */
  customClickSwipeGesture?: {
    direction: SwipeableInterstitialSwipeDirection;
    tapsAllowed?: boolean;
  };
}
