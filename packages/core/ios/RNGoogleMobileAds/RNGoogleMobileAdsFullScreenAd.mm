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
#import "RNGoogleMobileAdsResponseInfo.h"

@implementation RNGoogleMobileAdsFullScreenAd

- (instancetype)init {
  if (self = [super init]) {
    _adMap = [NSMutableDictionary new];
    _delegateMap = [NSMutableDictionary new];
    _generationMap = [NSMutableDictionary new];
  }
  return self;
}

- (void)dealloc {
  [self invalidate];
}

- (void)invalidate {
  [_adMap removeAllObjects];
  [_delegateMap removeAllObjects];
  [_generationMap removeAllObjects];
}

- (NSNumber *)beginLoadGenerationForRequestId:(int)requestId {
  NSNumber *key = @(requestId);
  NSInteger next = [self.generationMap[key] integerValue] + 1;
  NSNumber *generation = @(next);
  self.generationMap[key] = generation;
  [self.adMap removeObjectForKey:key];
  [self.delegateMap removeObjectForKey:key];
  return generation;
}

- (BOOL)isCurrentGeneration:(NSNumber *)generation forRequestId:(int)requestId {
  return [self.generationMap[@(requestId)] isEqualToNumber:generation];
}

- (void)evictRequestId:(int)requestId {
  NSNumber *key = @(requestId);
  [self.adMap removeObjectForKey:key];
  [self.delegateMap removeObjectForKey:key];
}

- (void)destroyWithRequestId:(int)requestId {
  NSNumber *key = @(requestId);
  NSInteger next = [self.generationMap[key] integerValue] + 1;
  self.generationMap[key] = @(next);
  [self.adMap removeObjectForKey:key];
  [self.delegateMap removeObjectForKey:key];
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
  NSNumber *generation = [self beginLoadGenerationForRequestId:requestId];
  RNGoogleMobileAdsFullScreenContentDelegate *delegate =
      [[RNGoogleMobileAdsFullScreenContentDelegate alloc] initWithAdEventName:[self getAdEventName]
                                                                    requestId:requestId
                                                                     adUnitId:adUnitId];

  __weak __typeof(self) weakSelf = self;
  __weak RNGoogleMobileAdsFullScreenContentDelegate *weakDelegate = delegate;
  delegate.onTerminal = ^{
    __strong __typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) {
      return;
    }
    [strongSelf evictRequestId:requestId];
    weakDelegate.onTerminal = nil;
  };

  [self loadAd:adUnitId
              adRequest:adRequest
      completionHandler:^(id<GADFullScreenPresentingAd> ad, NSError *error) {
        __strong __typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) {
          return;
        }

        if (![strongSelf isCurrentGeneration:generation forRequestId:requestId]) {
          // Destroyed or superseded while loading — drop without emitting.
          return;
        }

        if (error) {
          NSMutableDictionary *codeAndMessage =
              [RNGoogleMobileAdsCommon adErrorPayloadFromAdError:error phase:@"load"];
          NSDictionary *responseInfo = [RNGoogleMobileAdsResponseInfo
              dictionaryFromResponseInfo:[RNGoogleMobileAdsResponseInfo
                                             responseInfoFromLoadError:error]
                                 compact:NO];
          if (responseInfo != nil) {
            codeAndMessage[@"responseInfo"] = responseInfo;
          }
          [strongSelf sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_ERROR
                        requestId:requestId
                         adUnitId:adUnitId
                            error:codeAndMessage
                             data:nil];
          return;
        }

        NSString *eventType = GOOGLE_MOBILE_ADS_EVENT_LOADED;
        NSMutableDictionary *data = [NSMutableDictionary dictionary];

        GADResponseInfo *gadResponseInfo = nil;
        if ([ad isKindOfClass:[GADRewardedAd class]]) {
          gadResponseInfo = [(GADRewardedAd *)ad responseInfo];
        } else if ([ad isKindOfClass:[GADRewardedInterstitialAd class]]) {
          gadResponseInfo = [(GADRewardedInterstitialAd *)ad responseInfo];
        } else if ([ad isKindOfClass:[GADInterstitialAd class]]) {
          gadResponseInfo = [(GADInterstitialAd *)ad responseInfo];
        } else if ([ad isKindOfClass:[GADAppOpenAd class]]) {
          gadResponseInfo = [(GADAppOpenAd *)ad responseInfo];
        }

        // Set up paid event handler
        GADPaidEventHandler paidEventHandler = ^(GADAdValue *value) {
          [weakSelf sendAdEvent:@"paid"
                      requestId:requestId
                       adUnitId:adUnitId
                          error:nil
                           data:[RNGoogleMobileAdsResponseInfo
                                    paidEventPayloadFromAdValue:value
                                                   responseInfo:gadResponseInfo]];
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
          data[@"type"] = adReward.type;
          data[@"amount"] = adReward.amount;
        }

        NSDictionary *responseInfo =
            [RNGoogleMobileAdsResponseInfo dictionaryFromResponseInfo:gadResponseInfo compact:NO];
        if (responseInfo != nil) {
          data[@"responseInfo"] = responseInfo;
        }

        if ([ad isKindOfClass:[GAMInterstitialAd class]]) {
          [(GAMInterstitialAd *)ad setAppEventDelegate:delegate];
        }

        ad.fullScreenContentDelegate = delegate;
        strongSelf.adMap[@(requestId)] = ad;
        strongSelf.delegateMap[@(requestId)] = delegate;

        NSDictionary *eventData = data.count > 0 ? data : nil;
        [strongSelf sendAdEvent:eventType
                      requestId:requestId
                       adUnitId:adUnitId
                          error:nil
                           data:eventData];
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
