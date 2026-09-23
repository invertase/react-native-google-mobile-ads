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

typedef NS_OPTIONS(NSUInteger, RNGoogleMobileAdsFullScreenDismissRecoveryActions) {
  RNGoogleMobileAdsFullScreenDismissRecoveryActionNone = 0,
  /** Call endIgnoringInteractionEvents until the ignore stack is clear. */
  RNGoogleMobileAdsFullScreenDismissRecoveryActionDrainIgnoringEvents = 1 << 0,
  /** Emit CLOSED once and evict — GMA never called adDidDismissFullScreenContent. */
  RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed = 1 << 1,
  /** Dismiss a leftover presented VC chain (ghost ad UI eating touches). */
  RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain = 1 << 2,
};

/**
 * Decision helpers for invertase/react-native-google-mobile-ads#859:
 * iOS 26 non-interactive / background-during-ad teardown can leave touches
 * dead and skip adDidDismissFullScreenContent. Safe to compile in the
 * lightweight XCTest harness (Foundation only).
 *
 * Does nothing when the ad is still legitimately presenting (has presented
 * VC, not ignoring events, willDismiss not seen).
 */
@interface RNGoogleMobileAdsFullScreenDismissRecovery : NSObject

+ (RNGoogleMobileAdsFullScreenDismissRecoveryActions)
    actionsForForegroundResumeWithPresenting:(BOOL)presenting
                             terminalEmitted:(BOOL)terminalEmitted
                             willDismissSeen:(BOOL)willDismissSeen
                  hasPresentedViewController:(BOOL)hasPresented
                 isIgnoringInteractionEvents:(BOOL)isIgnoring;

/**
 * Invokes `endIgnoring` while `isIgnoring` remains true, up to `maxDrains`.
 * Returns how many times `endIgnoring` ran.
 */
+ (NSUInteger)drainIgnoringInteractionEventsWhile:(BOOL (^)(void))isIgnoring
                                              end:(void (^)(void))endIgnoring
                                        maxDrains:(NSUInteger)maxDrains;

@end

NS_ASSUME_NONNULL_END
