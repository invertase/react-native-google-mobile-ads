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
 * must not tear down a still-showing ad, unlock host interaction locks,
 * or dismiss unknown presentations / other scenes.
 */
@interface RNGoogleMobileAdsFullScreenDismissRecoveryTests : XCTestCase
@end

@implementation RNGoogleMobileAdsFullScreenDismissRecoveryTests

- (void)testStillShowingAdNeedsNoRecovery {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                               presentationContextCaptured:YES
                                                          capturedPresentationStillPresent:YES
                                                               hasPresentedInCapturedScene:YES
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
                                                               presentationContextCaptured:YES
                                                          capturedPresentationStillPresent:NO
                                                               hasPresentedInCapturedScene:NO
                                                               isIgnoringInteractionEvents:YES];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionNone);
}

- (void)testNotPresentingNeedsNoRecovery {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:NO
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                               presentationContextCaptured:NO
                                                          capturedPresentationStillPresent:NO
                                                               hasPresentedInCapturedScene:NO
                                                               isIgnoringInteractionEvents:YES];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionNone);
}

- (void)testHostInteractionLockAloneDoesNotDrain {
  // Host beginIgnoring while our captured ad presentation is still up — do not
  // infer GMA ownership from the global ignore flag alone.
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                               presentationContextCaptured:YES
                                                          capturedPresentationStillPresent:YES
                                                               hasPresentedInCapturedScene:YES
                                                               isIgnoringInteractionEvents:YES];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionNone,
                 @"isIgnoring alone must not drain / synthesize / dismiss");
  XCTAssertFalse([RNGoogleMobileAdsFullScreenDismissRecovery
      adAttributedInteractionLockWithWillDismissSeen:NO
                         presentationContextCaptured:YES
                    capturedPresentationStillPresent:YES]);
}

- (void)testIgnoringAfterCapturedPresentationGoneDrainsAndSynthesizesClosed {
  // Models iOS 26 ghost teardown: exclusive-touch / ignore stack left behind.
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                               presentationContextCaptured:YES
                                                          capturedPresentationStillPresent:NO
                                                               hasPresentedInCapturedScene:NO
                                                               isIgnoringInteractionEvents:YES];
  XCTAssertTrue(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDrainIgnoringEvents);
  XCTAssertTrue(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed);
  XCTAssertFalse(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain);
}

- (void)testWillDismissWithoutDidDismissSynthesizesClosed {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:YES
                                                               presentationContextCaptured:YES
                                                          capturedPresentationStillPresent:NO
                                                               hasPresentedInCapturedScene:NO
                                                               isIgnoringInteractionEvents:NO];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed,
                 @"#859: willDismiss without didDismiss must still deliver CLOSED");
}

- (void)testWillDismissWithCapturedPresentationAlsoDismissesChain {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:YES
                                                               presentationContextCaptured:YES
                                                          capturedPresentationStillPresent:YES
                                                               hasPresentedInCapturedScene:YES
                                                               isIgnoringInteractionEvents:NO];
  XCTAssertTrue(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed);
  XCTAssertTrue(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain);
}

- (void)testCreativeGoneWithoutCallbackSynthesizesClosed {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                               presentationContextCaptured:YES
                                                          capturedPresentationStillPresent:NO
                                                               hasPresentedInCapturedScene:NO
                                                               isIgnoringInteractionEvents:NO];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed,
                 @"#859: creative gone from hierarchy with no CLOSED must synthesize");
}

- (void)testAdGoneThenHostModalDoesNotDismissStillSynthesizesClosed {
  // Ad identity captured at present, then ad disappears and host presents a modal
  // before recovery runs. Identity must stay "gone" (not rebound to the modal):
  // synthesize CLOSED, never dismiss the host modal.
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                               presentationContextCaptured:YES
                                                          capturedPresentationStillPresent:NO
                                                               hasPresentedInCapturedScene:YES
                                                               isIgnoringInteractionEvents:NO];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed,
                 @"host modal after ad teardown must not block CLOSED synthesis");
  XCTAssertFalse(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain,
                 @"must not dismiss a host modal that replaced the ad");
}

- (void)testWillDismissAdGoneHostModalDoesNotDismiss {
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:YES
                                                               presentationContextCaptured:YES
                                                          capturedPresentationStillPresent:NO
                                                               hasPresentedInCapturedScene:YES
                                                               isIgnoringInteractionEvents:NO];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed);
  XCTAssertFalse(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain);
}

- (void)testUnknownPresentedWithoutCaptureDoesNotDismiss {
  // No show-time identity: a presented VC in-scene must not be dismissed.
  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:YES
                                                               presentationContextCaptured:NO
                                                          capturedPresentationStillPresent:NO
                                                               hasPresentedInCapturedScene:YES
                                                               isIgnoringInteractionEvents:NO];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed);
  XCTAssertFalse(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain);
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

- (void)testProductionMaxDrainsBalancesOnlyOneIgnore {
  // Delegate uses maxDrains:1 so host beginIgnoring stacks stay locked.
  __block NSUInteger ignoreDepth = 3;
  NSUInteger drained = [RNGoogleMobileAdsFullScreenDismissRecovery
      drainIgnoringInteractionEventsWhile:^BOOL {
        return ignoreDepth > 0;
      }
      end:^{
        ignoreDepth--;
      }
      maxDrains:1];
  XCTAssertEqual(drained, 1u);
  XCTAssertEqual(ignoreDepth, 2u);
}

- (void)testPresentationIdentityMatchRequiresSamePointer {
  NSObject *captured = [NSObject new];
  NSObject *other = [NSObject new];
  XCTAssertTrue([RNGoogleMobileAdsFullScreenDismissRecovery isCapturedPresentation:captured
                                                                   sameAsPresented:captured]);
  XCTAssertFalse([RNGoogleMobileAdsFullScreenDismissRecovery isCapturedPresentation:captured
                                                                    sameAsPresented:other]);
  XCTAssertFalse([RNGoogleMobileAdsFullScreenDismissRecovery isCapturedPresentation:nil
                                                                    sameAsPresented:captured]);
  XCTAssertFalse([RNGoogleMobileAdsFullScreenDismissRecovery isCapturedPresentation:captured
                                                                    sameAsPresented:nil]);
}

- (void)testPresentedChainContainsCapturedIdentity {
  NSObject *hostModal = [NSObject new];
  NSObject *adVC = [NSObject new];
  // Assign first — XCTAssertTrue stringifies the expression and chokes on `@[`.
  BOOL containsAd = [RNGoogleMobileAdsFullScreenDismissRecovery presentedChain:@[ hostModal, adVC ]
                                                              containsCaptured:adVC];
  BOOL containsMissing = [RNGoogleMobileAdsFullScreenDismissRecovery presentedChain:@[ hostModal ]
                                                                   containsCaptured:adVC];
  BOOL containsEmpty = [RNGoogleMobileAdsFullScreenDismissRecovery presentedChain:@[]
                                                                 containsCaptured:adVC];
  XCTAssertTrue(containsAd);
  XCTAssertFalse(containsMissing);
  XCTAssertFalse(containsEmpty);
}

- (void)testRecoveryWindowPrefersCapturedWindowOverUnorderedScenes {
  NSObject *sceneA = [NSObject new];
  NSObject *sceneB = [NSObject new];
  NSObject *windowA = [NSObject new];
  NSObject *windowB = [NSObject new];
  NSObject *capturedWindow = [NSObject new];

  id resolved = [RNGoogleMobileAdsFullScreenDismissRecovery
      recoveryWindowWithCapturedWindow:capturedWindow
                    capturedSceneToken:sceneA
                      candidateWindows:@[ windowB, windowA ]
                  candidateSceneTokens:@[ sceneB, sceneA ]];
  XCTAssertEqualObjects(resolved, capturedWindow,
                        @"show-time window must win over unordered scene key windows");
}

- (void)testRecoveryWindowUsesCapturedSceneNotForeignKeyWindow {
  NSObject *sceneA = [NSObject new];
  NSObject *sceneB = [NSObject new];
  NSObject *windowA = [NSObject new];
  NSObject *windowB = [NSObject new];

  // Unordered candidates list foreign key window first — must still pick scene A.
  id resolved = [RNGoogleMobileAdsFullScreenDismissRecovery
      recoveryWindowWithCapturedWindow:nil
                    capturedSceneToken:sceneA
                      candidateWindows:@[ windowB, windowA ]
                  candidateSceneTokens:@[ sceneB, sceneA ]];
  XCTAssertEqualObjects(resolved, windowA);
}

- (void)testRecoveryWindowReturnsNilWithoutCaptureRatherThanGuessing {
  NSObject *windowB = [NSObject new];
  id resolved = [RNGoogleMobileAdsFullScreenDismissRecovery
      recoveryWindowWithCapturedWindow:nil
                    capturedSceneToken:nil
                      candidateWindows:@[ windowB ]
                  candidateSceneTokens:@[ [NSObject new] ]];
  XCTAssertNil(resolved, @"must not fall back to an unordered global keyWindow guess");
}

- (void)testPresentedIdentityBindsOnceAtPresentTime {
  NSObject *adVC = [NSObject new];
  id first = [RNGoogleMobileAdsFullScreenDismissRecovery presentedIdentityByBindingExisting:nil
                                                                                  candidate:adVC
                                                                           identityWasBound:NO
                                                                   identityCaptureAttempted:NO];
  XCTAssertEqualObjects(first, adVC);

  NSObject *hostModal = [NSObject new];
  id rebound =
      [RNGoogleMobileAdsFullScreenDismissRecovery presentedIdentityByBindingExisting:adVC
                                                                           candidate:hostModal
                                                                    identityWasBound:YES
                                                            identityCaptureAttempted:YES];
  XCTAssertEqualObjects(rebound, adVC, @"must not replace show-time identity with a later VC");
}

- (void)testPresentedIdentityDoesNotRebindAfterWeakClears {
  // Ad dealloc'd → weak existing is nil, but identityWasBound stays YES. A host
  // modal candidate must not become the captured identity.
  NSObject *hostModal = [NSObject new];
  id rebound =
      [RNGoogleMobileAdsFullScreenDismissRecovery presentedIdentityByBindingExisting:nil
                                                                           candidate:hostModal
                                                                    identityWasBound:YES
                                                            identityCaptureAttempted:YES];
  XCTAssertNil(rebound, @"weak-nil after bind must stay nil — never adopt host modal");
}

- (void)testPresentedIdentityAllowsFirstBindWhenNotYetBound {
  NSObject *lateAttachedAd = [NSObject new];
  id bound =
      [RNGoogleMobileAdsFullScreenDismissRecovery presentedIdentityByBindingExisting:nil
                                                                           candidate:lateAttachedAd
                                                                    identityWasBound:NO
                                                            identityCaptureAttempted:NO];
  XCTAssertEqualObjects(bound, lateAttachedAd,
                        @"first present-time capture may bind when not yet attempted");
}

- (void)testNilFirstCaptureDoesNotAdoptLaterHostModal {
  // Sync capture saw nil — eligibility seals. A later host modal must not bind.
  id first = [RNGoogleMobileAdsFullScreenDismissRecovery presentedIdentityByBindingExisting:nil
                                                                                  candidate:nil
                                                                           identityWasBound:NO
                                                                   identityCaptureAttempted:NO];
  XCTAssertNil(first);

  NSObject *hostModal = [NSObject new];
  id second =
      [RNGoogleMobileAdsFullScreenDismissRecovery presentedIdentityByBindingExisting:nil
                                                                           candidate:hostModal
                                                                    identityWasBound:NO
                                                            identityCaptureAttempted:YES];
  XCTAssertNil(second, @"nil-first capture must not adopt a host modal on deferred attempt");

  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                               presentationContextCaptured:NO
                                                          capturedPresentationStillPresent:NO
                                                               hasPresentedInCapturedScene:YES
                                                               isIgnoringInteractionEvents:NO];
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionNone,
                 @"unbound identity + host modal must not synthesize CLOSED or dismiss");
}

- (void)testHostInteractionLockWithoutBoundIdentityDoesNotDrain {
  // Capture was attempted but never bound — must not attribute a host beginIgnoring
  // lock to the ad (presentationContextCaptured must be the bound-identity flag).
  XCTAssertFalse([RNGoogleMobileAdsFullScreenDismissRecovery
      adAttributedInteractionLockWithWillDismissSeen:NO
                         presentationContextCaptured:NO
                    capturedPresentationStillPresent:NO]);

  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:NO
                                                               presentationContextCaptured:NO
                                                          capturedPresentationStillPresent:NO
                                                               hasPresentedInCapturedScene:NO
                                                               isIgnoringInteractionEvents:YES];
  XCTAssertFalse(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDrainIgnoringEvents,
                 @"host interaction lock without bound identity must not drain");
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed,
                 @"edge path may still synthesize CLOSED when nothing is presented");
}

- (void)testWillDismissWithoutBoundIdentityDoesNotDrainHostLock {
  // willDismissSeen alone must not authorize drain when identity was unbound —
  // a host beginIgnoring must remain locked; still synthesize CLOSED.
  XCTAssertFalse([RNGoogleMobileAdsFullScreenDismissRecovery
      adAttributedInteractionLockWithWillDismissSeen:YES
                         presentationContextCaptured:NO
                    capturedPresentationStillPresent:NO]);

  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery actionsForForegroundResumeWithPresenting:YES
                                                                           terminalEmitted:NO
                                                                           willDismissSeen:YES
                                                               presentationContextCaptured:NO
                                                          capturedPresentationStillPresent:NO
                                                               hasPresentedInCapturedScene:NO
                                                               isIgnoringInteractionEvents:YES];
  XCTAssertFalse(actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDrainIgnoringEvents,
                 @"willDismiss without bound identity must not drain host interaction lock");
  XCTAssertEqual(actions, RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed,
                 @"willDismiss without didDismiss must still synthesize CLOSED");
}

@end
