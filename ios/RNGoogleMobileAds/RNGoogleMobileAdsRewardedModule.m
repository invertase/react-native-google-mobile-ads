//
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

#import <React/RCTUtils.h>

#import "RNGoogleMobileAdsCommon.h"
#import "RNGoogleMobileAdsFullScreenContentDelegate.h"
#import "RNGoogleMobileAdsRewardedModule.h"
#import "common/RNSharedUtils.h"

static __strong NSMutableDictionary *rewardedMap;
static __strong NSMutableDictionary *rewardedDelegateMap;

@implementation RNGoogleMobileAdsRewardedModule
#pragma mark -
#pragma mark Module Setup

RCT_EXPORT_MODULE();

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

- (id)init {
  self = [super init];
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    rewardedMap = [[NSMutableDictionary alloc] init];
    rewardedDelegateMap = [[NSMutableDictionary alloc] init];
  });
  return self;
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (void)dealloc {
  [self invalidate];
}

- (void)invalidate {
  for (NSNumber *id in [rewardedMap allKeys]) {
    [rewardedMap removeObjectForKey:id];
    [rewardedDelegateMap removeObjectForKey:id];
  }
}

#pragma mark -
#pragma mark Google Mobile Ads Methods

RCT_EXPORT_METHOD(rewardedLoad
                  : (nonnull NSNumber *)requestId
                  : (NSString *)adUnitId
                  : (NSDictionary *)adRequestOptions) {
  [GADRewardedAd loadWithAdUnitID:adUnitId
                          request:[RNGoogleMobileAdsCommon buildAdRequest:adRequestOptions]
                completionHandler:^(GADRewardedAd *ad, NSError *error) {
                  if (error) {
                    NSDictionary *codeAndMessage =
                        [RNGoogleMobileAdsCommon getCodeAndMessageFromAdError:error];
                    [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_REWARDED
                                               requestId:requestId
                                                    type:GOOGLE_MOBILE_ADS_EVENT_ERROR
                                                adUnitId:adUnitId
                                                   error:codeAndMessage
                                                    data:nil];
                    return;
                  }
                  GADRewardedAd *rewardedAd = ad;

                  NSDictionary *serverSideVerificationOptions =
                      [adRequestOptions objectForKey:@"serverSideVerificationOptions"];

                  if (serverSideVerificationOptions != nil) {
                    GADServerSideVerificationOptions *options =
                        [[GADServerSideVerificationOptions alloc] init];

                    NSString *userId = [serverSideVerificationOptions valueForKey:@"userId"];

                    if (userId != nil) {
                      options.userIdentifier = userId;
                    }

                    NSString *customData =
                        [serverSideVerificationOptions valueForKey:@"customData"];

                    if (customData != nil) {
                      options.customRewardString = customData;
                    }

                    [rewardedAd setServerSideVerificationOptions:options];
                  }

                  RNGoogleMobileAdsFullScreenContentDelegate *fullScreenContentDelegate =
                      [[RNGoogleMobileAdsFullScreenContentDelegate alloc] init];
                  fullScreenContentDelegate.sendAdEvent = GOOGLE_MOBILE_ADS_EVENT_REWARDED;
                  fullScreenContentDelegate.requestId = requestId;
                  fullScreenContentDelegate.adUnitId = ad.adUnitID;
                  rewardedAd.fullScreenContentDelegate = fullScreenContentDelegate;
                  rewardedMap[requestId] = rewardedAd;
                  rewardedDelegateMap[requestId] = fullScreenContentDelegate;
                  GADAdReward *reward = rewardedAd.adReward;
                  NSMutableDictionary *data = [NSMutableDictionary dictionary];
                  if (reward.type != nil) {
                    [data setValue:reward.type forKey:@"type"];
                  }
                  if (reward.amount != nil) {
                    [data setValue:reward.amount forKey:@"amount"];
                  }
                  [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_REWARDED
                                             requestId:requestId
                                                  type:GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED
                                              adUnitId:ad.adUnitID
                                                 error:nil
                                                  data:data];
                }];
}

RCT_EXPORT_METHOD(rewardedShow
                  : (nonnull NSNumber *)requestId
                  : (NSString *)adUnitId
                  : (NSDictionary *)showOptions
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  GADRewardedAd *rewardedAd = rewardedMap[requestId];

  if (rewardedAd) {
    [rewardedAd presentFromRootViewController:RNGoogleMobileAdsCommon.currentViewController
                     userDidEarnRewardHandler:^{
                       GADAdReward *reward = rewardedAd.adReward;
                       NSMutableDictionary *data = [NSMutableDictionary dictionary];
                       if (reward.type != nil) {
                         [data setValue:reward.type forKey:@"type"];
                       }
                       if (reward.amount != nil) {
                         [data setValue:reward.amount forKey:@"amount"];
                       }
                       [RNGoogleMobileAdsCommon
                           sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_REWARDED
                             requestId:requestId
                                  type:GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD
                              adUnitId:rewardedAd.adUnitID
                                 error:nil
                                  data:data];
                     }];
  } else {
    [RNSharedUtils
        rejectPromiseWithUserInfo:reject
                         userInfo:[@{
                           @"code" : @"not-ready",
                           @"message" : @"Rewarded ad attempted to show but was not ready.",
                         } mutableCopy]];
  }
}

@end
