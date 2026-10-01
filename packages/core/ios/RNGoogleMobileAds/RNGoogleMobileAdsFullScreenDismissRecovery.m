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

#import "RNGoogleMobileAdsFullScreenDismissRecovery.h"

@implementation RNGoogleMobileAdsFullScreenDismissRecovery

+ (BOOL)adAttributedInteractionLockWithWillDismissSeen:(BOOL)willDismissSeen
                           presentationContextCaptured:(BOOL)presentationContextCaptured
                      capturedPresentationStillPresent:(BOOL)capturedPresentationStillPresent {
  if (willDismissSeen) {
    return YES;
  }
  // Our show-time presentation disappeared while we still think we are presenting —
  // GMA ghost teardown leaving an unmatched beginIgnoring is attributable to this ad.
  return presentationContextCaptured && !capturedPresentationStillPresent;
}

+ (RNGoogleMobileAdsFullScreenDismissRecoveryActions)
    actionsForForegroundResumeWithPresenting:(BOOL)presenting
                             terminalEmitted:(BOOL)terminalEmitted
                             willDismissSeen:(BOOL)willDismissSeen
                 presentationContextCaptured:(BOOL)presentationContextCaptured
            capturedPresentationStillPresent:(BOOL)capturedPresentationStillPresent
                 hasPresentedInCapturedScene:(BOOL)hasPresentedInCapturedScene
                 isIgnoringInteractionEvents:(BOOL)isIgnoring {
  if (!presenting || terminalEmitted) {
    return RNGoogleMobileAdsFullScreenDismissRecoveryActionNone;
  }

  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      RNGoogleMobileAdsFullScreenDismissRecoveryActionNone;

  BOOL adAttributedLock =
      [self adAttributedInteractionLockWithWillDismissSeen:willDismissSeen
                               presentationContextCaptured:presentationContextCaptured
                          capturedPresentationStillPresent:capturedPresentationStillPresent];

  if (isIgnoring && adAttributedLock) {
    // #859: exclusive-touch / ignore stack left after non-interactive teardown.
    actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionDrainIgnoringEvents;
    actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed;
    if (capturedPresentationStillPresent) {
      actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain;
    }
  } else if (willDismissSeen) {
    // willDismiss without didDismiss (auto-dismiss / background path).
    actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed;
    if (capturedPresentationStillPresent) {
      actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain;
    }
  } else if (presentationContextCaptured && !capturedPresentationStillPresent) {
    // Creative gone from the captured presenter/window; CLOSED never arrived.
    actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed;
  } else if (!presentationContextCaptured && !hasPresentedInCapturedScene) {
    // No show-time capture (edge path): only synthesize when nothing is presented.
    actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed;
  }

  return actions;
}

+ (NSUInteger)drainIgnoringInteractionEventsWhile:(BOOL (^)(void))isIgnoring
                                              end:(void (^)(void))endIgnoring
                                        maxDrains:(NSUInteger)maxDrains {
  if (isIgnoring == nil || endIgnoring == nil || maxDrains == 0) {
    return 0;
  }
  NSUInteger drained = 0;
  while (isIgnoring() && drained < maxDrains) {
    endIgnoring();
    drained++;
  }
  return drained;
}

+ (BOOL)isCapturedPresentation:(id)captured sameAsPresented:(id)presented {
  return captured != nil && presented != nil && captured == presented;
}

+ (BOOL)presentedChain:(NSArray *)presentedChain containsCaptured:(id)captured {
  if (captured == nil || presentedChain.count == 0) {
    return NO;
  }
  for (id candidate in presentedChain) {
    if (candidate == captured) {
      return YES;
    }
  }
  return NO;
}

+ (id)recoveryWindowWithCapturedWindow:(id)capturedWindow
                    capturedSceneToken:(id)capturedSceneToken
                      candidateWindows:(NSArray *)candidateWindows
                  candidateSceneTokens:(NSArray *)candidateSceneTokens {
  if (capturedWindow != nil) {
    return capturedWindow;
  }
  if (capturedSceneToken == nil || candidateWindows.count == 0) {
    return nil;
  }
  NSUInteger count = MIN(candidateWindows.count, candidateSceneTokens.count);
  for (NSUInteger i = 0; i < count; i++) {
    id sceneToken = candidateSceneTokens[i];
    if (sceneToken == capturedSceneToken) {
      return candidateWindows[i];
    }
  }
  return nil;
}

@end
