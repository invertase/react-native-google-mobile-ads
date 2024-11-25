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

#import "RNGoogleMobileAdsRewardedModule.h"
#import <GoogleMobileAds/GoogleMobileAds.h>
#ifdef RCT_NEW_ARCH_ENABLED
#import "RNGoogleMobileAdsSpec.h"
#endif
#import "RNGoogleMobileAdsCommon.h"
#import "RNGoogleMobileAdsFullScreenAd.h"

@interface RNGoogleMobileAdsRewardedAd : RNGoogleMobileAdsFullScreenAd

@end

@implementation RNGoogleMobileAdsRewardedAd

- (NSString *)getAdEventName {
  return GOOGLE_MOBILE_ADS_EVENT_REWARDED;
}

- (void)loadAd:(NSString *)adUnitId
            adRequest:(GAMRequest *)adRequest
    completionHandler:
        (void (^)(GADRewardedAd *_Nullable ad, NSError *_Nullable error))completionHandler {
  [GADRewardedAd loadWithAdUnitID:adUnitId request:adRequest completionHandler:completionHandler];
}

@end

@implementation RNGoogleMobileAdsRewardedModule {
  RNGoogleMobileAdsRewardedAd *_ad;
}

RCT_EXPORT_MODULE();

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(rewardedLoad
                  : (double)requestId adUnitId
                  : (NSString *)adUnitId requestOptions
                  : (NSDictionary *)requestOptions) {
  [_ad loadWithRequestId:requestId adUnitId:adUnitId adRequestOptions:requestOptions];
}

RCT_EXPORT_METHOD(rewardedShow
                  : (double)requestId adUnitId
                  : (NSString *)adUnitId showOptions
                  : (NSDictionary *)showOptions resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject) {
  [_ad showWithRequestId:requestId
                adUnitId:adUnitId
             showOptions:showOptions
                 resolve:resolve
                  reject:reject];
}

RCT_EXPORT_METHOD(invalidate) { [_ad invalidate]; }

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeRewardedModuleSpecJSI>(params);
}
#endif

- (instancetype)init {
  self = [super init];
  if (self) {
    _ad = [[RNGoogleMobileAdsRewardedAd alloc] init];
  }
  return self;
}

- (void)dealloc {
  [self invalidate];
}

@end
