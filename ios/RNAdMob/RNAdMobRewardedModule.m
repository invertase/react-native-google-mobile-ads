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

#import "RNAdMobCommon.h"
#import "RNAdMobRewardedDelegate.h"
#import "RNAdMobRewardedModule.h"
#import "common/RNSharedUtils.h"

static __strong NSMutableDictionary *rewardedMap;

@implementation RNAdMobRewardedModule
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
    RNGADRewarded *ad = rewardedMap[id];
    [ad setRequestId:@-1];
    [rewardedMap removeObjectForKey:id];
  }
}

#pragma mark -
#pragma mark Firebase AdMob Methods

RCT_EXPORT_METHOD(rewardedLoad
                  : (nonnull NSNumber *)requestId
                  : (NSString *)adUnitId
                  : (NSDictionary *)adRequestOptions) {
  RNGADRewarded *rewarded = [[RNGADRewarded alloc] initWithAdUnitID:adUnitId];

  NSDictionary *serverSideVerificationOptions =
      [adRequestOptions objectForKey:@"serverSideVerificationOptions"];

  if (serverSideVerificationOptions != nil) {
    GADServerSideVerificationOptions *options = [[GADServerSideVerificationOptions alloc] init];

    NSString *userId = [serverSideVerificationOptions valueForKey:@"userId"];

    if (userId != nil) {
      options.userIdentifier = userId;
    }

    NSString *customData = [serverSideVerificationOptions valueForKey:@"customData"];

    if (customData != nil) {
      options.customRewardString = customData;
    }

    [rewarded setServerSideVerificationOptions:options];
  }

  [rewarded setRequestId:requestId];
  GADRequest *request = [RNAdMobCommon buildAdRequest:adRequestOptions];
  rewardedMap[requestId] = rewarded;
  [rewarded loadRequest:request
      completionHandler:^(GADRequestError *error) {
        if (error != nil) {
          NSDictionary *codeAndMessage = [RNAdMobCommon getCodeAndMessageFromAdError:error];
          [RNAdMobRewardedDelegate sendRewardedEvent:ADMOB_EVENT_ERROR
                                           requestId:requestId
                                            adUnitId:adUnitId
                                               error:codeAndMessage
                                                data:nil];
        } else {
          GADAdReward *reward = rewarded.reward;
          NSDictionary *data = @{
            @"type" : reward.type,
            @"amount" : reward.amount,
          };
          [RNAdMobRewardedDelegate sendRewardedEvent:ADMOB_EVENT_REWARDED_LOADED
                                           requestId:requestId
                                            adUnitId:adUnitId
                                               error:nil
                                                data:data];
        }
      }];
}

RCT_EXPORT_METHOD(rewardedShow
                  : (nonnull NSNumber *)requestId
                  : (NSString *)adUnitId
                  : (NSDictionary *)showOptions
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  GADRewardedAd *rewarded = rewardedMap[requestId];
  if (rewarded.isReady) {
    [rewarded
        presentFromRootViewController:RCTSharedApplication().delegate.window.rootViewController
                             delegate:[RNAdMobRewardedDelegate sharedInstance]];
    resolve([NSNull null]);
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
