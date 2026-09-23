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
 */

#import <XCTest/XCTest.h>

#import "RNGoogleMobileAds/RNGoogleMobileAdsFullScreenDismissRecovery.h"

/**
 * Regression for invertase/react-native-google-mobile-ads#859:
 * After rewarded auto-dismiss or background-during-ad, GMA may skip
 * adDidDismissFullScreenContent and leave the app ignoring touches.
 * Foreground recovery must drain the ignore stack and synthesize CLOSED
 * when the creative is gone or dismiss started without finishing — and
 * must not tear down a still-showing ad.
 */
@interface RNGoogleMobileAdsFullScreenDismissRecoveryTests : XCTestCase
@end

@implementation RNGoogleMobileAdsFullScreenDismissRecoveryTests

- (void)testStillShowingAdNeedsNoRecovery {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                                hasPresentedViewController:YES
                                                               isIgnoringInteractionEvents:NO];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionNone,
                 @"#859: background→foreground while the ad is still up must not "
                 @"synthesize CLOSED or dismiss the presented chain");
}

- (void)testTerminalAlreadyEmittedNeedsNoRecovery {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:YES
                                                                           willDismissSeen:YES
                                                                hasPresentedViewController:NO
                                                               isIgnoringInteractionEvents:YES];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionNone);
}

- (void)testNotPresentingNeedsNoRecovery {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:NO
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                                hasPresentedViewController:NO
                                                               isIgnoringInteractionEvents:YES];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionNone);
}

- (void)testIgnoringEventsWhilePresentingDrainsAndSynthesizesClosed {
  // Models iOS 26 ghost teardown: exclusive-touch / ignore stack left behind.
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                                hasPresentedViewController:YES
                                                               isIgnoringInteractionEvents:YES];
  XCTAssertTrue(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDrainIgnoringEvents);
  XCTAssertTrue(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed);
  XCTAssertTrue(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain);
}

- (void)testWillDismissWithoutDidDismissSynthesizesClosed {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:YES
                                                                hasPresentedViewController:NO
                                                               isIgnoringInteractionEvents:NO];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed,
                 @"#859: willDismiss without didDismiss must still deliver CLOSED");
}

- (void)testWillDismissWithGhostPresentedAlsoDismissesChain {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:YES
                                                                hasPresentedViewController:YES
                                                               isIgnoringInteractionEvents:NO];
  XCTAssertTrue(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed);
  XCTAssertTrue(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain);
}

- (void)testCreativeGoneWithoutCallbackSynthesizesClosed {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                                hasPresentedViewController:NO
                                                               isIgnoringInteractionEvents:NO];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed,
                 @"#859: creative gone from hierarchy with no CLOSED must synthesize");
}

- (void)testDrainIgnoringEventsClearsNestedIgnoreStack {
  __block NSUInteger ignoreDepth = 2;
  __block NSUInteger endCalls = 0;

  NSUInteger drained = [RNGoogleMobileAdsFullScreenDismissRecovery
      drainIgnoringInteractionEventsWhile:^BOOL {
        return ignoreDepth > 0;
      }
      end:^{
        endCalls++;
        if (ignoreDepth > 0) {
          ignoreDepth--;
        }
      }
      maxDrains:8];

  XCTAssertEqual(drained, 2u);
  XCTAssertEqual(endCalls, 2u);
  XCTAssertEqual(ignoreDepth, 0u);
}

- (void)testDrainRespectsMaxDrains {
  __block NSUInteger ignoreDepth = 10;
  NSUInteger drained = [RNGoogleMobileAdsFullScreenDismissRecovery
      drainIgnoringInteractionEventsWhile:^BOOL {
        return ignoreDepth > 0;
      }
      end:^{
        ignoreDepth--;
      }
      maxDrains:3];
  XCTAssertEqual(drained, 3u);
  XCTAssertEqual(ignoreDepth, 7u);
}

@end
