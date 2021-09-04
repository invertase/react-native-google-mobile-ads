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

#import "RNGoogleAdsCommon.h"
#import "RNGoogleAdsInterstitialDelegate.h"
#import "RNGoogleAdsInterstitialModule.h"
#import "common/RNSharedUtils.h"

static __strong NSMutableDictionary *interstitialMap;

@implementation RNGoogleAdsInterstitialModule
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
    interstitialMap = [[NSMutableDictionary alloc] init];
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
  for (NSNumber *id in [interstitialMap allKeys]) {
    RNGADInterstitial *ad = interstitialMap[id];
    [ad setRequestId:@-1];
    [interstitialMap removeObjectForKey:id];
  }
}

#pragma mark -
#pragma mark Google Mobile Ads Methods

RCT_EXPORT_METHOD(interstitialLoad
                  : (nonnull NSNumber *)requestId
                  : (NSString *)adUnitId
                  : (NSDictionary *)adRequestOptions) {
  RNGADInterstitial *interstitial = [[RNGADInterstitial alloc] initWithAdUnitID:adUnitId];
  [interstitial setRequestId:requestId];
  [interstitial loadRequest:[RNGoogleAdsCommon buildAdRequest:adRequestOptions]];
  interstitial.delegate = [RNGoogleAdsInterstitialDelegate sharedInstance];
  interstitialMap[requestId] = interstitial;
}

RCT_EXPORT_METHOD(interstitialShow
                  : (nonnull NSNumber *)requestId
                  : (NSDictionary *)showOptions
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  GADInterstitial *interstitial = interstitialMap[requestId];
  if (interstitial.isReady) {
    [interstitial
        presentFromRootViewController:RCTSharedApplication().delegate.window.rootViewController];
    resolve([NSNull null]);
  } else {
    [RNSharedUtils
        rejectPromiseWithUserInfo:reject
                         userInfo:[@{
                           @"code" : @"not-ready",
                           @"message" : @"Interstitial ad attempted to show but was not ready.",
                         } mutableCopy]];
  }
}

@end
