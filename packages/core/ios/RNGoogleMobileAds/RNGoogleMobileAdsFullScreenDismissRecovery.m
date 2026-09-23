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

+ (RNGoogleMobileAdsFullScreenDismissRecoveryActions)
    actionsForForegroundResumeWithPresenting:(BOOL)presenting
                             terminalEmitted:(BOOL)terminalEmitted
                             willDismissSeen:(BOOL)willDismissSeen
                  hasPresentedViewController:(BOOL)hasPresented
                 isIgnoringInteractionEvents:(BOOL)isIgnoring {
  if (!presenting || terminalEmitted) {
    return RNGoogleMobileAdsFullScreenDismissRecoveryActionNone;
  }

  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      RNGoogleMobileAdsFullScreenDismissRecoveryActionNone;

  if (isIgnoring) {
    // #859: exclusive-touch / ignore stack left after non-interactive teardown.
    actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionDrainIgnoringEvents;
    actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed;
    if (hasPresented) {
      actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain;
    }
  } else if (willDismissSeen) {
    // willDismiss without didDismiss (auto-dismiss / background path).
    actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed;
    if (hasPresented) {
      actions |= RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain;
    }
  } else if (!hasPresented) {
    // Creative gone from the hierarchy; CLOSED never arrived.
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

@end
