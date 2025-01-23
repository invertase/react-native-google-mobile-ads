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

#import "RNGoogleMobileAdsFullScreenAd.h"
#import "RNGoogleMobileAdsCommon.h"

@implementation RNGoogleMobileAdsFullScreenAd

- (instancetype)init {
  if (self = [super init]) {
    _adMap = [NSMutableDictionary new];
    _delegateMap = [NSMutableDictionary new];
  }
  return self;
}

- (void)dealloc {
  [self invalidate];
}

- (void)invalidate {
  [_adMap removeAllObjects];
  [_delegateMap removeAllObjects];
}

- (NSString *)getAdEventName {
  @throw [NSException exceptionWithName:@"MethodNotImplemented"
                                 reason:@"Method `getAdEventName` must be overridden"
                               userInfo:nil];
}

- (void)loadAd:(NSString *)adUnitId
            adRequest:(GAMRequest *)adRequest
    completionHandler:
        (void (^)(id<GADFullScreenPresentingAd> ad, NSError *error))completionHandler {
  @throw [NSException exceptionWithName:@"MethodNotImplemented"
                                 reason:@"Method `loadAd` must be overridden"
                               userInfo:nil];
}

- (void)sendAdEvent:(NSString *)type
          requestId:(int)requestId
           adUnitId:(NSString *)adUnitId
              error:(NSDictionary *)error
               data:(NSDictionary *)data {
  [RNGoogleMobileAdsCommon sendAdEvent:[self getAdEventName]
                             requestId:@(requestId)
                                  type:type
                              adUnitId:adUnitId
                                 error:error
                                  data:data];
}

- (void)loadWithRequestId:(int)requestId
                 adUnitId:(NSString *)adUnitId
         adRequestOptions:(NSDictionary *)adRequestOptions {
  GAMRequest *adRequest = [RNGoogleMobileAdsCommon buildAdRequest:adRequestOptions];
  RNGoogleMobileAdsFullScreenContentDelegate *delegate =
      [[RNGoogleMobileAdsFullScreenContentDelegate alloc] initWithAdEventName:[self getAdEventName]
                                                                    requestId:requestId
                                                                     adUnitId:adUnitId];

  __weak __typeof(self) weakSelf = self;
  [self loadAd:adUnitId
              adRequest:adRequest
      completionHandler:^(id<GADFullScreenPresentingAd> ad, NSError *error) {
        if (error) {
          NSDictionary *codeAndMessage =
              [RNGoogleMobileAdsCommon getCodeAndMessageFromAdError:error];
          [weakSelf sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_ERROR
                      requestId:requestId
                       adUnitId:adUnitId
                          error:codeAndMessage
                           data:nil];
          return;
        }

        NSString *eventType = GOOGLE_MOBILE_ADS_EVENT_LOADED;
        NSDictionary *data = nil;

        // Set up paid event handler
        GADPaidEventHandler paidEventHandler = ^(GADAdValue *value) {
          [weakSelf sendAdEvent:@"paid"
                      requestId:requestId
                       adUnitId:adUnitId
                          error:nil
                           data:@{
                             @"value" : value.value,
                             @"precision" : @(value.precision),
                             @"currency" : value.currencyCode
                           }];
        };

        if ([ad isKindOfClass:[GADRewardedAd class]]) {
          [(GADRewardedAd *)ad setPaidEventHandler:paidEventHandler];
        } else if ([ad isKindOfClass:[GADRewardedInterstitialAd class]]) {
          [(GADRewardedInterstitialAd *)ad setPaidEventHandler:paidEventHandler];
        } else if ([ad isKindOfClass:[GADInterstitialAd class]]) {
          [(GADInterstitialAd *)ad setPaidEventHandler:paidEventHandler];
        } else if ([ad isKindOfClass:[GADAppOpenAd class]]) {
          [(GADAppOpenAd *)ad setPaidEventHandler:paidEventHandler];
        }

        if ([ad isKindOfClass:[GADRewardedAd class]] ||
            [ad isKindOfClass:[GADRewardedInterstitialAd class]]) {
          NSDictionary *serverSideVerificationOptions =
              adRequestOptions[@"serverSideVerificationOptions"];
          if (serverSideVerificationOptions) {
            GADServerSideVerificationOptions *options =
                [[GADServerSideVerificationOptions alloc] init];
            options.userIdentifier = serverSideVerificationOptions[@"userId"];
            options.customRewardString = serverSideVerificationOptions[@"customData"];

            if ([ad isKindOfClass:[GADRewardedAd class]]) {
              [(GADRewardedAd *)ad setServerSideVerificationOptions:options];
            } else if ([ad isKindOfClass:[GADRewardedInterstitialAd class]]) {
              [(GADRewardedInterstitialAd *)ad setServerSideVerificationOptions:options];
            }
          }

          eventType = GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED;
          GADAdReward *adReward =
              [(GADRewardedAd *)ad adReward] ?: [(GADRewardedInterstitialAd *)ad adReward];
          data = @{@"type" : adReward.type, @"amount" : adReward.amount};
        }

        if ([ad isKindOfClass:[GAMInterstitialAd class]]) {
          [(GAMInterstitialAd *)ad setAppEventDelegate:delegate];
        }

        ad.fullScreenContentDelegate = delegate;
        weakSelf.adMap[@(requestId)] = ad;
        weakSelf.delegateMap[@(requestId)] = delegate;

        [weakSelf sendAdEvent:eventType requestId:requestId adUnitId:adUnitId error:nil data:data];
      }];
}

- (void)showWithRequestId:(int)requestId
                 adUnitId:(NSString *)adUnitId
              showOptions:(NSDictionary *)showOptions
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject {
  UIViewController *viewController = [RNGoogleMobileAdsCommon currentViewController];
  if (!viewController) {
    [RNSharedUtils
        rejectPromiseWithUserInfo:reject
                         userInfo:@{
                           @"code" : @"nil-vc",
                           @"message" :
                               @"Ad attempted to show but the current View Controller was nil."
                         }];
    return;
  }

  id<GADFullScreenPresentingAd> ad = self.adMap[@(requestId)];
  if (!ad) {
    [RNSharedUtils rejectPromiseWithUserInfo:reject
                                    userInfo:@{
                                      @"code" : @"not-ready",
                                      @"message" : @"Ad attempted to show but was not ready."
                                    }];
    return;
  }

  if ([ad isKindOfClass:[GADAppOpenAd class]]) {
    [(GADAppOpenAd *)ad presentFromRootViewController:viewController];
  } else if ([ad isKindOfClass:[GADInterstitialAd class]]) {
    [(GADInterstitialAd *)ad presentFromRootViewController:viewController];
  } else if ([ad isKindOfClass:[GADRewardedAd class]]) {
    [(GADRewardedAd *)ad presentFromRootViewController:viewController
                              userDidEarnRewardHandler:^{
                                NSDictionary *rewardData = @{
                                  @"type" : [(GADRewardedAd *)ad adReward].type,
                                  @"amount" : [(GADRewardedAd *)ad adReward].amount
                                };
                                [self sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD
                                        requestId:requestId
                                         adUnitId:adUnitId
                                            error:nil
                                             data:rewardData];
                              }];
  } else if ([ad isKindOfClass:[GADRewardedInterstitialAd class]]) {
    [(GADRewardedInterstitialAd *)ad
        presentFromRootViewController:viewController
             userDidEarnRewardHandler:^{
               NSDictionary *rewardData = @{
                 @"type" : [(GADRewardedInterstitialAd *)ad adReward].type,
                 @"amount" : [(GADRewardedInterstitialAd *)ad adReward].amount
               };
               [self sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD
                       requestId:requestId
                        adUnitId:adUnitId
                           error:nil
                            data:rewardData];
             }];
  }

  resolve(nil);
}

@end

#endif
