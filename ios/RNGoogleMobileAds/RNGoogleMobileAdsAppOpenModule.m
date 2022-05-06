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

#import "RNGoogleMobileAdsAppOpenModule.h"
#import "RNGoogleMobileAdsCommon.h"
#import "common/RNSharedUtils.h"

@implementation RNGoogleMobileAdsAppOpenModule
#pragma mark -
#pragma mark Module Setup

RCT_EXPORT_MODULE();

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

// #pragma mark -
// #pragma mark Google Mobile Ads Methods

RCT_EXPORT_METHOD(appOpenLoad
                  : (nonnull NSNumber *)requestId
                  : (NSString *)adUnitId
                  : (NSDictionary *)adRequestOptions) {
  self.appOpenAd = nil;
  [GADAppOpenAd loadWithAdUnitID:adUnitId
                         request:[RNGoogleMobileAdsCommon buildAdRequest:adRequestOptions]
                     orientation:UIInterfaceOrientationPortrait
               completionHandler:^(GADAppOpenAd *_Nullable appOpenAd, NSError *_Nullable error) {
                 if (error) {
                   NSDictionary *codeAndMessage =
                       [RNGoogleMobileAdsCommon getCodeAndMessageFromAdError:error];
                   [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_APP_OPEN
                                              requestId:requestId
                                                   type:GOOGLE_MOBILE_ADS_EVENT_ERROR
                                               adUnitId:adUnitId
                                                  error:codeAndMessage
                                                   data:nil];
                   return;
                 }
                 self.appOpenAd = appOpenAd;
                 RNGoogleMobileAdsFullScreenContentDelegate *fullScreenContentDelegate =
                     [[RNGoogleMobileAdsFullScreenContentDelegate alloc] init];
                 fullScreenContentDelegate.sendAdEvent = GOOGLE_MOBILE_ADS_EVENT_APP_OPEN;
                 fullScreenContentDelegate.requestId = requestId;
                 fullScreenContentDelegate.adUnitId = adUnitId;
                 self.appOpenAd.fullScreenContentDelegate = fullScreenContentDelegate;
                 self.appOpenDelegate = fullScreenContentDelegate;
                 [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_APP_OPEN
                                            requestId:requestId
                                                 type:GOOGLE_MOBILE_ADS_EVENT_LOADED
                                             adUnitId:adUnitId
                                                error:nil
                                                 data:nil];
               }];
}

RCT_EXPORT_METHOD(appOpenShow
                  : (nonnull NSNumber *)requestId
                  : (NSString *)adUnitId
                  : (NSDictionary *)showOptions
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  if (self.appOpenAd) {
    [self.appOpenAd presentFromRootViewController:RNGoogleMobileAdsCommon.currentViewController];
    resolve([NSNull null]);
  } else {
    [RNSharedUtils
        rejectPromiseWithUserInfo:reject
                         userInfo:[@{
                           @"code" : @"not-ready",
                           @"message" : @"App Open ad attempted to show but was not ready.",
                         } mutableCopy]];
  }
}

@end
