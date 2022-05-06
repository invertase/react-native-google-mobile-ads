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
#import "RNGoogleMobileAdsRewardedInterstitialModule.h"
#import "common/RNSharedUtils.h"

static __strong NSMutableDictionary *rewardedInterstitialMap;
static __strong NSMutableDictionary *rewardedInterstitialDelegateMap;

@implementation RNGoogleMobileAdsRewardedInterstitialModule
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
    rewardedInterstitialMap = [[NSMutableDictionary alloc] init];
    rewardedInterstitialDelegateMap = [[NSMutableDictionary alloc] init];
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
  for (NSNumber *id in [rewardedInterstitialMap allKeys]) {
    [rewardedInterstitialMap removeObjectForKey:id];
    [rewardedInterstitialDelegateMap removeObjectForKey:id];
  }
}

#pragma mark -
#pragma mark Google Mobile Ads Methods

RCT_EXPORT_METHOD(rewardedInterstitialLoad
                  : (nonnull NSNumber *)requestId
                  : (NSString *)adUnitId
                  : (NSDictionary *)adRequestOptions) {
  [GADRewardedInterstitialAd
       loadWithAdUnitID:adUnitId
                request:[RNGoogleMobileAdsCommon buildAdRequest:adRequestOptions]
      completionHandler:^(GADRewardedInterstitialAd *ad, NSError *error) {
        if (error) {
          NSDictionary *codeAndMessage =
              [RNGoogleMobileAdsCommon getCodeAndMessageFromAdError:error];
          [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_REWARDED_INTERSTITIAL
                                     requestId:requestId
                                          type:GOOGLE_MOBILE_ADS_EVENT_ERROR
                                      adUnitId:adUnitId
                                         error:codeAndMessage
                                          data:nil];
          return;
        }
        GADRewardedInterstitialAd *rewardedInterstitialAd = ad;

        NSDictionary *serverSideVerificationOptions =
            [adRequestOptions objectForKey:@"serverSideVerificationOptions"];

        if (serverSideVerificationOptions != nil) {
          GADServerSideVerificationOptions *options =
              [[GADServerSideVerificationOptions alloc] init];

          NSString *userId = [serverSideVerificationOptions valueForKey:@"userId"];

          if (userId != nil) {
            options.userIdentifier = userId;
          }

          NSString *customData = [serverSideVerificationOptions valueForKey:@"customData"];

          if (customData != nil) {
            options.customRewardString = customData;
          }

          [rewardedInterstitialAd setServerSideVerificationOptions:options];
        }

        RNGoogleMobileAdsFullScreenContentDelegate *fullScreenContentDelegate =
            [[RNGoogleMobileAdsFullScreenContentDelegate alloc] init];
        fullScreenContentDelegate.sendAdEvent = GOOGLE_MOBILE_ADS_EVENT_REWARDED_INTERSTITIAL;
        fullScreenContentDelegate.requestId = requestId;
        fullScreenContentDelegate.adUnitId = ad.adUnitID;
        rewardedInterstitialAd.fullScreenContentDelegate = fullScreenContentDelegate;
        rewardedInterstitialMap[requestId] = rewardedInterstitialAd;
        rewardedInterstitialDelegateMap[requestId] = fullScreenContentDelegate;
        GADAdReward *reward = rewardedInterstitialAd.adReward;
        NSMutableDictionary *data = [NSMutableDictionary dictionary];
        if (reward.type != nil) {
          [data setValue:reward.type forKey:@"type"];
        }
        if (reward.amount != nil) {
          [data setValue:reward.amount forKey:@"amount"];
        }
        [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_REWARDED_INTERSTITIAL
                                   requestId:requestId
                                        type:GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED
                                    adUnitId:ad.adUnitID
                                       error:nil
                                        data:data];
      }];
}

RCT_EXPORT_METHOD(rewardedInterstitialShow
                  : (nonnull NSNumber *)requestId
                  : (NSString *)adUnitId
                  : (NSDictionary *)showOptions
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  GADRewardedInterstitialAd *rewardedInterstitialAd = rewardedInterstitialMap[requestId];

  if (rewardedInterstitialAd) {
    [rewardedInterstitialAd
        presentFromRootViewController:RNGoogleMobileAdsCommon.currentViewController
             userDidEarnRewardHandler:^{
               GADAdReward *reward = rewardedInterstitialAd.adReward;
               NSMutableDictionary *data = [NSMutableDictionary dictionary];
               if (reward.type != nil) {
                 [data setValue:reward.type forKey:@"type"];
               }
               if (reward.amount != nil) {
                 [data setValue:reward.amount forKey:@"amount"];
               }
               [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_REWARDED_INTERSTITIAL
                                          requestId:requestId
                                               type:GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD
                                           adUnitId:rewardedInterstitialAd.adUnitID
                                              error:nil
                                               data:data];
             }];
  } else {
    [RNSharedUtils
        rejectPromiseWithUserInfo:reject
                         userInfo:[@{
                           @"code" : @"not-ready",
                           @"message" :
                               @"Rewarded Interstitial ad attempted to show but was not ready.",
                         } mutableCopy]];
  }
}

@end
