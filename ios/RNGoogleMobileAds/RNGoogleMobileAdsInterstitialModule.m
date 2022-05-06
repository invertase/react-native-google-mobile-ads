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
#import "RNGoogleMobileAdsInterstitialModule.h"
#import "common/RNSharedUtils.h"

static __strong NSMutableDictionary *interstitialMap;
static __strong NSMutableDictionary *interstitialDelegateMap;

@implementation RNGoogleMobileAdsInterstitialModule
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
    interstitialDelegateMap = [[NSMutableDictionary alloc] init];
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
    [interstitialMap removeObjectForKey:id];
    [interstitialDelegateMap removeObjectForKey:id];
  }
}

#pragma mark -
#pragma mark Google Mobile Ads Methods

RCT_EXPORT_METHOD(interstitialLoad
                  : (nonnull NSNumber *)requestId
                  : (NSString *)adUnitId
                  : (NSDictionary *)adRequestOptions) {
  GAMRequest *request = [RNGoogleMobileAdsCommon buildAdRequest:adRequestOptions];

  void (^completionhandler)(GADInterstitialAd *, NSError *) = ^(GADInterstitialAd *ad,
                                                                NSError *error) {
    if (error) {
      NSDictionary *codeAndMessage = [RNGoogleMobileAdsCommon getCodeAndMessageFromAdError:error];
      [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_INTERSTITIAL
                                 requestId:requestId
                                      type:GOOGLE_MOBILE_ADS_EVENT_ERROR
                                  adUnitId:adUnitId
                                     error:codeAndMessage
                                      data:nil];
      return;
    }
    GADInterstitialAd *interstitial = ad;
    RNGoogleMobileAdsFullScreenContentDelegate *fullScreenContentDelegate =
        [[RNGoogleMobileAdsFullScreenContentDelegate alloc] init];
    fullScreenContentDelegate.sendAdEvent = GOOGLE_MOBILE_ADS_EVENT_INTERSTITIAL;
    fullScreenContentDelegate.requestId = requestId;
    fullScreenContentDelegate.adUnitId = ad.adUnitID;
    interstitial.fullScreenContentDelegate = fullScreenContentDelegate;
    if ([interstitial class] == [GAMInterstitialAd class]) {
      ((GAMInterstitialAd *)interstitial).appEventDelegate = fullScreenContentDelegate;
    }
    interstitialMap[requestId] = interstitial;
    interstitialDelegateMap[requestId] = fullScreenContentDelegate;
    [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_INTERSTITIAL
                               requestId:requestId
                                    type:GOOGLE_MOBILE_ADS_EVENT_LOADED
                                adUnitId:ad.adUnitID
                                   error:nil
                                    data:nil];
  };

  if ([RNGoogleMobileAdsCommon isAdManagerUnit:adUnitId]) {
    [GAMInterstitialAd loadWithAdManagerAdUnitID:adUnitId
                                         request:request
                               completionHandler:completionhandler];
  } else {
    [GADInterstitialAd loadWithAdUnitID:adUnitId
                                request:request
                      completionHandler:completionhandler];
  }
}

RCT_EXPORT_METHOD(interstitialShow
                  : (nonnull NSNumber *)requestId
                  : (NSString *)adUnitId
                  : (NSDictionary *)showOptions
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  GADInterstitialAd *interstitial = interstitialMap[requestId];
  if (interstitial) {
    [interstitial presentFromRootViewController:RNGoogleMobileAdsCommon.currentViewController];
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
