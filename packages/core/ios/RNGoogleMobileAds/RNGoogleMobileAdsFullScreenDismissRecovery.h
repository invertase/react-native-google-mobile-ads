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
  /**
   * Call endIgnoringInteractionEvents once (GMA may have left a single unmatched
   * beginIgnoring). Do not drain the global ignore stack in a loop — that can unlock
   * unrelated beginIgnoringInteractionEvents from the host app.
   * Only set when ad-attributable lock evidence is present (not isIgnoring alone).
   */
  RNGoogleMobileAdsFullScreenDismissRecoveryActionDrainIgnoringEvents = 1 << 0,
  /** Emit CLOSED once and evict — GMA never called adDidDismissFullScreenContent. */
  RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed = 1 << 1,
  /**
   * Dismiss the leftover presented VC only when it matches the presentation
   * identity captured at show/present time. Skip dismiss when uncertain so host
   * modals are not torn down.
   */
  RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain = 1 << 2,
};

/**
 * Decision helpers for invertase/react-native-google-mobile-ads#859:
 * iOS 26 non-interactive / background-during-ad teardown can leave touches
 * dead and skip adDidDismissFullScreenContent. Safe to compile in the
 * lightweight XCTest harness (Foundation only).
 *
 * Does nothing when the ad is still legitimately presenting (captured
 * presentation still present, not ignoring with ad-attributable lock evidence,
 * willDismiss not seen).
 */
@interface RNGoogleMobileAdsFullScreenDismissRecovery : NSObject

/**
 * @param presentationContextCaptured YES when show-time captured a presenter /
 *        window / scene for this ad.
 * @param capturedPresentationStillPresent YES when the presented VC identity
 *        captured at present time is still in that presenter/window chain.
 * @param hasPresentedInCapturedScene YES when the captured presenter/window
 *        currently has any non-dismissing presented VC (used only when identity
 *        was not captured).
 * @param isIgnoringInteractionEvents Global UIApplication ignore flag — never
 *        sufficient alone to drain.
 */
+ (RNGoogleMobileAdsFullScreenDismissRecoveryActions)
    actionsForForegroundResumeWithPresenting:(BOOL)presenting
                             terminalEmitted:(BOOL)terminalEmitted
                             willDismissSeen:(BOOL)willDismissSeen
                 presentationContextCaptured:(BOOL)presentationContextCaptured
            capturedPresentationStillPresent:(BOOL)capturedPresentationStillPresent
                 hasPresentedInCapturedScene:(BOOL)hasPresentedInCapturedScene
                 isIgnoringInteractionEvents:(BOOL)isIgnoring;

/**
 * Invokes `endIgnoring` while `isIgnoring` remains true, up to `maxDrains`.
 * Returns how many times `endIgnoring` ran.
 *
 * Production recovery should pass `maxDrains:1` so only one unmatched GMA
 * beginIgnoring is balanced. Higher caps remain for unit tests of the helper.
 */
+ (NSUInteger)drainIgnoringInteractionEventsWhile:(BOOL (^)(void))isIgnoring
                                              end:(void (^)(void))endIgnoring
                                        maxDrains:(NSUInteger)maxDrains;

/**
 * Pointer-identity match for a presented VC captured at present time.
 * Returns NO when either side is nil — callers must skip dismiss then.
 */
+ (BOOL)isCapturedPresentation:(nullable id)captured sameAsPresented:(nullable id)presented;

/**
 * YES when `captured` appears in `presentedChain` (ordered presenter→…→top).
 * Foundation-safe stand-in for walking UIKit presentedViewController links.
 */
+ (BOOL)presentedChain:(NSArray *)presentedChain containsCaptured:(nullable id)captured;

/**
 * Multi-scene window selection: prefer the show-time captured window; else the
 * first candidate whose scene token equals the captured scene token. Never
 * returns an unordered global key-window guess when capture is missing.
 */
+ (nullable id)recoveryWindowWithCapturedWindow:(nullable id)capturedWindow
                             capturedSceneToken:(nullable id)capturedSceneToken
                               candidateWindows:(NSArray *)candidateWindows
                           candidateSceneTokens:(NSArray *)candidateSceneTokens;

/**
 * Ad-attributable evidence that this ad owns an unmatched interaction lock.
 * Global `isIgnoring` alone is insufficient — require willDismiss and/or a
 * show-time presentation capture whose identity is no longer present.
 */
+ (BOOL)adAttributedInteractionLockWithWillDismissSeen:(BOOL)willDismissSeen
                           presentationContextCaptured:(BOOL)presentationContextCaptured
                      capturedPresentationStillPresent:(BOOL)capturedPresentationStillPresent;

/**
 * One-shot presented-VC identity bind for show/present time.
 * Once `identityWasBound` is YES, always returns `existing` — never rebinds to a
 * later candidate (e.g. a host modal that appears after the ad disappears).
 * Once `identityCaptureAttempted` is YES without a bind, also returns `existing`
 * (typically nil) — a nil first attempt seals eligibility so a later host modal
 * cannot be adopted.
 * Weak `existing` becoming nil after a successful bind must stay nil.
 */
+ (nullable id)presentedIdentityByBindingExisting:(nullable id)existing
                                        candidate:(nullable id)candidate
                                 identityWasBound:(BOOL)identityWasBound
                         identityCaptureAttempted:(BOOL)identityCaptureAttempted;

@end

NS_ASSUME_NONNULL_END
