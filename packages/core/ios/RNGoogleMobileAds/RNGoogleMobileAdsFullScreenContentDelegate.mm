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
 *
 */

#if !TARGET_OS_MACCATALYST

#import "RNGoogleMobileAdsFullScreenContentDelegate.h"
#import "RNGoogleMobileAdsCommon.h"
#import "RNGoogleMobileAdsFullScreenDismissRecovery.h"
#import "RNGoogleMobileAdsFullScreenEventDelivery.h"

static const NSTimeInterval kRNGoogleMobileAdsMissedDidDismissFallbackSeconds = 1.0;
/** Balance at most one unmatched beginIgnoring left by GMA — never drain the global stack. */
static const NSUInteger kRNGoogleMobileAdsMaxIgnoreDrains = 1;

@implementation RNGoogleMobileAdsFullScreenContentDelegate {
  BOOL _presenting;
  BOOL _willDismissSeen;
  BOOL _terminalEmitted;
  BOOL _observingForeground;
  /** YES after a non-nil presented VC was bound at show/present — sticky if weak nils. */
  BOOL _presentedIdentityBound;
  /** YES after the present-time capture attempt ran (even if presented was still nil). */
  BOOL _presentedIdentityCaptureAttempted;
  /** YES once recovery starts — further present-time capture must not bind afterwards. */
  BOOL _presentedIdentityCaptureClosed;
  __weak UIViewController *_presenterViewController;
  __weak UIWindow *_presentationWindow;
  __weak UIWindowScene *_presentationScene;
  __weak UIViewController *_capturedPresentedViewController;
}

- (instancetype)initWithAdEventName:(NSString *)adEventName
                          requestId:(int)requestId
                           adUnitId:(NSString *)adUnitId {
  if (self = [super init]) {
    _adEventName = adEventName;
    _requestId = requestId;
    _adUnitId = adUnitId;
  }
  return self;
}

- (void)dealloc {
  [self rngma_stopObservingForeground];
}

- (void)capturePresentationContextFromViewController:(UIViewController *)viewController {
  _presenterViewController = viewController;
  UIWindow *window = viewController.view.window;
  _presentationWindow = window;
  if (@available(iOS 13.0, *)) {
    _presentationScene = window.windowScene;
  }
  _presentedIdentityBound = NO;
  _presentedIdentityCaptureAttempted = NO;
  _presentedIdentityCaptureClosed = NO;
  _capturedPresentedViewController = nil;
}

#pragma mark - GADFullScreenContentDelegate

- (void)adWillPresentFullScreenContent:(id<GADFullScreenPresentingAd>)ad {
  _presenting = YES;
  _willDismissSeen = NO;
  _terminalEmitted = NO;
  // Single synchronous capture attempt — deferred rebind could adopt a host modal
  // after ad teardown when the first attempt saw nil.
  [self rngma_capturePresentedIdentityAtPresentTime];
  [self rngma_startObservingForeground];
  [self sendAdEventWithType:GOOGLE_MOBILE_ADS_EVENT_OPENED error:nil data:nil];
}

- (void)ad:(id<GADFullScreenPresentingAd>)ad
    didFailToPresentFullScreenContentWithError:(NSError *)error {
  NSDictionary *errorInfo = [RNGoogleMobileAdsCommon adErrorPayloadFromAdError:error phase:@"show"];
  [self rngma_deliverTerminalOnceWithType:GOOGLE_MOBILE_ADS_EVENT_ERROR error:errorInfo];
}

- (void)adWillDismissFullScreenContent:(id<GADFullScreenPresentingAd>)ad {
  _willDismissSeen = YES;
  __weak __typeof(self) weakSelf = self;
  dispatch_after(
      dispatch_time(DISPATCH_TIME_NOW,
                    (int64_t)(kRNGoogleMobileAdsMissedDidDismissFallbackSeconds * NSEC_PER_SEC)),
      dispatch_get_main_queue(), ^{
        __strong __typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) {
          return;
        }
        // Auto-dismiss without backgrounding: didDismiss may never arrive (#859).
        [strongSelf rngma_recoverIfNeeded];
      });
}

- (void)adDidDismissFullScreenContent:(id<GADFullScreenPresentingAd>)ad {
  [self rngma_deliverTerminalOnceWithType:GOOGLE_MOBILE_ADS_EVENT_CLOSED error:nil];
}

- (void)adDidRecordClick:(id<GADFullScreenPresentingAd>)ad {
  [self sendAdEventWithType:GOOGLE_MOBILE_ADS_EVENT_CLICKED error:nil data:nil];
}

- (void)adDidRecordImpression:(id<GADFullScreenPresentingAd>)ad {
  [self sendAdEventWithType:GOOGLE_MOBILE_ADS_EVENT_IMPRESSION error:nil data:nil];
}

- (void)interstitialAd:(GADInterstitialAd *)interstitialAd
    didReceiveAppEvent:(NSString *)name
              withInfo:(nullable NSString *)info {
  NSDictionary *data = @{@"name" : name, @"data" : info ?: @""};
  [self sendAdEventWithType:GOOGLE_MOBILE_ADS_EVENT_APP_EVENT error:nil data:data];
}

#pragma mark - Private

- (void)rngma_refreshPresentationWindowFromPresenter {
  UIViewController *presenter = _presenterViewController;
  if (presenter == nil) {
    return;
  }
  UIWindow *window = presenter.view.window;
  if (window != nil) {
    _presentationWindow = window;
    if (@available(iOS 13.0, *)) {
      _presentationScene = window.windowScene;
    }
  }
}

/**
 * Bind presented-VC identity only at show/present time. Never called from recovery —
 * rebinding after the ad disappears would adopt a host modal as the ad identity.
 * Eligibility is immutable after the first attempt (including a nil result).
 */
- (void)rngma_capturePresentedIdentityAtPresentTime {
  if (_presentedIdentityCaptureClosed || _terminalEmitted || _willDismissSeen) {
    return;
  }
  [self rngma_refreshPresentationWindowFromPresenter];
  BOOL alreadyAttempted = _presentedIdentityCaptureAttempted;
  UIViewController *presenter = _presenterViewController;
  if (presenter == nil) {
    // Still seal the attempt so a later host modal cannot bind.
    _presentedIdentityCaptureAttempted = YES;
    return;
  }
  UIViewController *candidate = presenter.presentedViewController;
  UIViewController *existing = _capturedPresentedViewController;
  id bound = [RNGoogleMobileAdsFullScreenDismissRecovery
      presentedIdentityByBindingExisting:existing
                               candidate:candidate
                        identityWasBound:_presentedIdentityBound
                identityCaptureAttempted:alreadyAttempted];
  _presentedIdentityCaptureAttempted = YES;
  if (bound != existing) {
    _capturedPresentedViewController = bound;
  }
  if (bound != nil) {
    _presentedIdentityBound = YES;
  }
}

- (void)rngma_startObservingForeground {
  if (_observingForeground) {
    return;
  }
  _observingForeground = YES;
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(rngma_applicationDidBecomeActive:)
                                               name:UIApplicationDidBecomeActiveNotification
                                             object:nil];
}

- (void)rngma_stopObservingForeground {
  if (!_observingForeground) {
    return;
  }
  _observingForeground = NO;
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:UIApplicationDidBecomeActiveNotification
                                                object:nil];
}

- (void)rngma_applicationDidBecomeActive:(NSNotification *)notification {
  (void)notification;
  // Hop to the next main turn so UIKit can finish any system dismiss first.
  __weak __typeof(self) weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    __strong __typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) {
      return;
    }
    [strongSelf rngma_recoverIfNeeded];
  });
}

- (UIWindow *)rngma_presentationWindow {
  UIWindow *window = _presentationWindow;
  if (window != nil) {
    return window;
  }

  UIViewController *presenter = _presenterViewController;
  if (presenter != nil && presenter.view.window != nil) {
    return presenter.view.window;
  }

  if (@available(iOS 13.0, *)) {
    UIWindowScene *scene = _presentationScene;
    if (scene != nil) {
      UIWindow *sceneKey = nil;
      UIWindow *sceneFallback = nil;
      for (UIWindow *candidate in scene.windows) {
        if (candidate.isKeyWindow) {
          sceneKey = candidate;
          break;
        }
        if (sceneFallback == nil && candidate.rootViewController != nil) {
          sceneFallback = candidate;
        }
      }
      return sceneKey ?: sceneFallback;
    }
  }

  // Never guess across unordered connectedScenes — multi-scene unsafe.
  return nil;
}

- (UIViewController *)rngma_presentationRootViewController {
  UIViewController *presenter = _presenterViewController;
  if (presenter != nil) {
    return presenter;
  }
  return [self rngma_presentationWindow].rootViewController;
}

- (NSArray<UIViewController *> *)rngma_presentedChainFromPresenter:(UIViewController *)presenter {
  NSMutableArray<UIViewController *> *chain = [NSMutableArray array];
  UIViewController *current = presenter.presentedViewController;
  while (current != nil) {
    [chain addObject:current];
    if ([current isBeingDismissed]) {
      break;
    }
    current = current.presentedViewController;
  }
  return chain;
}

- (BOOL)rngma_capturedPresentationStillPresent {
  UIViewController *captured = _capturedPresentedViewController;
  UIViewController *presenter = [self rngma_presentationRootViewController];
  if (captured == nil || presenter == nil) {
    return NO;
  }
  NSArray<UIViewController *> *chain = [self rngma_presentedChainFromPresenter:presenter];
  if (![RNGoogleMobileAdsFullScreenDismissRecovery presentedChain:chain
                                                 containsCaptured:captured]) {
    return NO;
  }
  return ![captured isBeingDismissed];
}

- (BOOL)rngma_hasPresentedInCapturedScene {
  UIViewController *presenter = [self rngma_presentationRootViewController];
  if (presenter == nil) {
    return NO;
  }
  UIViewController *presented = presenter.presentedViewController;
  return presented != nil && ![presented isBeingDismissed];
}

- (void)rngma_clearPresentationContext {
  _presentedIdentityBound = NO;
  _presentedIdentityCaptureAttempted = NO;
  _presentedIdentityCaptureClosed = NO;
  _presenterViewController = nil;
  _presentationWindow = nil;
  _presentationScene = nil;
  _capturedPresentedViewController = nil;
}

- (void)rngma_recoverIfNeeded {
  if (_terminalEmitted || !_presenting) {
    return;
  }

  // Close the present-time capture window before deciding — never rebind identity here.
  _presentedIdentityCaptureClosed = YES;
  [self rngma_refreshPresentationWindowFromPresenter];

  UIApplication *app = [UIApplication sharedApplication];
  BOOL capturedStillPresent = [self rngma_capturedPresentationStillPresent];
  BOOL hasPresentedInScene = [self rngma_hasPresentedInCapturedScene];
  BOOL isIgnoring = [app isIgnoringInteractionEvents];

  // Interaction-lock attribution and identity-based CLOSED require a real bind —
  // a nil capture attempt must not count as ad-owned identity evidence.
  BOOL identityContextCaptured = _presentedIdentityBound;

  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery
          actionsForForegroundResumeWithPresenting:_presenting
                                   terminalEmitted:_terminalEmitted
                                   willDismissSeen:_willDismissSeen
                       presentationContextCaptured:identityContextCaptured
                  capturedPresentationStillPresent:capturedStillPresent
                       hasPresentedInCapturedScene:hasPresentedInScene
                       isIgnoringInteractionEvents:isIgnoring];

  if (actions == RNGoogleMobileAdsFullScreenDismissRecoveryActionNone) {
    return;
  }

  if (actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDrainIgnoringEvents) {
    [RNGoogleMobileAdsFullScreenDismissRecovery
        drainIgnoringInteractionEventsWhile:^BOOL {
          return [[UIApplication sharedApplication] isIgnoringInteractionEvents];
        }
        end:^{
          [[UIApplication sharedApplication] endIgnoringInteractionEvents];
        }
        maxDrains:kRNGoogleMobileAdsMaxIgnoreDrains];
  }

  if (actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionDismissPresentedChain) {
    UIViewController *presenter = [self rngma_presentationRootViewController];
    UIViewController *captured = _capturedPresentedViewController;
    UIViewController *presented = presenter.presentedViewController;
    // Only dismiss when the presented chain still holds our show-time identity.
    if (presenter != nil &&
        [RNGoogleMobileAdsFullScreenDismissRecovery isCapturedPresentation:captured
                                                           sameAsPresented:presented]) {
      [presenter dismissViewControllerAnimated:NO completion:nil];
    } else if (presenter != nil && captured != nil) {
      NSArray<UIViewController *> *chain = [self rngma_presentedChainFromPresenter:presenter];
      if ([RNGoogleMobileAdsFullScreenDismissRecovery presentedChain:chain
                                                    containsCaptured:captured]) {
        [presenter dismissViewControllerAnimated:NO completion:nil];
      }
    }
  }

  if (actions & RNGoogleMobileAdsFullScreenDismissRecoveryActionSynthesizeClosed) {
    [self rngma_deliverTerminalOnceWithType:GOOGLE_MOBILE_ADS_EVENT_CLOSED error:nil];
  }
}

- (void)rngma_deliverTerminalOnceWithType:(NSString *)type error:(nullable NSDictionary *)error {
  if (_terminalEmitted) {
    return;
  }
  _terminalEmitted = YES;
  _presenting = NO;
  [self rngma_clearPresentationContext];
  [self rngma_stopObservingForeground];

  __weak __typeof(self) weakSelf = self;
  [RNGoogleMobileAdsFullScreenEventDelivery
      deliverTerminalEventWithEmit:^{
        __strong __typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) {
          return;
        }
        [strongSelf sendAdEventWithType:type error:error data:nil];
      }
      evict:^{
        __strong __typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf.onTerminal) {
          strongSelf.onTerminal();
        }
      }];
}

- (void)sendAdEventWithType:(NSString *)type
                      error:(nullable NSDictionary *)error
                       data:(nullable NSDictionary *)data {
  [RNGoogleMobileAdsCommon sendAdEvent:self.adEventName
                             requestId:@(self.requestId)
                                  type:type
                              adUnitId:self.adUnitId
                                 error:error
                                  data:data];
}

@end

#endif
