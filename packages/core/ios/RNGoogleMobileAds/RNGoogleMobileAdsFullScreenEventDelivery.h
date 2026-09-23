/**
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
 */

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Fullscreen terminal / rewarded-event delivery helpers.
 *
 * Safe to compile in the lightweight XCTest harness (Foundation only; no GMA).
 *
 * GADFullScreenPresentingAd.fullScreenContentDelegate is weak. Evicting the
 * holder's strong delegate ref before emitting CLOSED/ERROR can drop the
 * event when emission is deferred off the SDK callback stack. Rewarded
 * userDidEarnRewardHandler must deliver a nil-safe JSON payload on the main
 * queue (sync when already on main) before bridging to JS, matching
 * terminal CLOSED/ERROR queueing so earn-then-dismiss keeps reward first.
 */
@interface RNGoogleMobileAdsFullScreenEventDelivery : NSObject

/**
 * Runs `emit` then `evict`. Callers must emit CLOSED/ERROR before releasing
 * the weakly-held full-screen content delegate.
 */
+ (void)deliverTerminalEventWithEmit:(void (^_Nullable)(void))emit
                               evict:(void (^_Nullable)(void))evict;

/**
 * Builds the JS `RewardedAdReward` payload. Never inserts nil into an
 * NSDictionary literal (which would throw and swallow the reward callback).
 * `amount` is coerced to a plain NSNumber double for bridge safety.
 */
+ (NSDictionary<NSString *, id> *)rewardEventDataWithType:(nullable NSString *)type
                                                   amount:(nullable NSNumber *)amount;

/**
 * Ensures `block` runs on the main queue. When already on main, runs
 * synchronously so earn+dismiss on the same turn keep
 * EARNED_REWARD before CLOSED (matching sync terminal delivery). When
 * off main, hops asynchronously onto the main queue.
 */
+ (void)dispatchAsyncOnMainQueue:(void (^)(void))block;

@end

NS_ASSUME_NONNULL_END
