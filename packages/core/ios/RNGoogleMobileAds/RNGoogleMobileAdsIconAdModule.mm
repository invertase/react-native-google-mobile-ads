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

#import "RNGoogleMobileAdsIconAdModule.h"
#import "RNGoogleMobileAdsCommon.h"
#import "common/RNSharedUtils.h"

@implementation RNGoogleMobileAdsIconAdModule

RCT_EXPORT_MODULE();

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

RCT_EXPORT_METHOD(iconAdLoad
                  : (double)requestId adUnitId
                  : (NSString *)adUnitId requestOptions
                  : (NSDictionary *)requestOptions) {
  int requestIdInt = (int)requestId;
  NSMutableDictionary *error = [NSMutableDictionary dictionaryWithDictionary:@{
    @"code" : @"icon-ad-unavailable",
    @"message" : @"Icon ads are not available on iOS in this library release.",
    @"phase" : @"load",
  }];
  [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_ICON_AD
                             requestId:@(requestIdInt)
                                  type:GOOGLE_MOBILE_ADS_EVENT_ERROR
                              adUnitId:adUnitId
                                 error:error
                                  data:nil];
}

RCT_EXPORT_METHOD(iconAdDestroy : (double)requestId) {
  // No-op on iOS.
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeIconAdModuleSpecJSI>(params);
}
#endif

@end

#endif