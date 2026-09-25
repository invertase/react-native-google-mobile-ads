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
static const NSUInteger kRNGoogleMobileAdsMaxIgnoreDrains = 16;

@implementation RNGoogleMobileAdsFullScreenContentDelegate {
  BOOL _presenting;
  BOOL _willDismissSeen;
  BOOL _terminalEmitted;
  BOOL _observingForeground;
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

#pragma mark - GADFullScreenContentDelegate

- (void)adWillPresentFullScreenContent:(id<GADFullScreenPresentingAd>)ad {
  _presenting = YES;
  _willDismissSeen = NO;
  _terminalEmitted = NO;
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

- (UIViewController *)rngma_windowRootViewController {
  UIApplication *app = [UIApplication sharedApplication];
  UIWindow *window = app.delegate.window;
  if (window == nil) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    window = app.keyWindow;
#pragma clang diagnostic pop
  }
  return window.rootViewController;
}

- (BOOL)rngma_hasActivePresentedViewController {
  UIViewController *root = [self rngma_windowRootViewController];
  if (root == nil) {
    return NO;
  }
  UIViewController *presented = root.presentedViewController;
  return presented != nil && ![presented isBeingDismissed];
}

- (void)rngma_recoverIfNeeded {
  if (_terminalEmitted || !_presenting) {
    return;
  }

  UIApplication *app = [UIApplication sharedApplication];
  BOOL hasPresented = [self rngma_hasActivePresentedViewController];
  BOOL isIgnoring = [app isIgnoringInteractionEvents];

  RNGoogleMobileAdsFullScreenDismissRecoveryActions actions =
      [RNGoogleMobileAdsFullScreenDismissRecovery
          actionsForForegroundResumeWithPresenting:_presenting
                                   terminalEmitted:_terminalEmitted
                                   willDismissSeen:_willDismissSeen
                        hasPresentedViewController:hasPresented
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
    UIViewController *root = [self rngma_windowRootViewController];
    if (root.presentedViewController != nil) {
      [root dismissViewControllerAnimated:NO completion:nil];
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
