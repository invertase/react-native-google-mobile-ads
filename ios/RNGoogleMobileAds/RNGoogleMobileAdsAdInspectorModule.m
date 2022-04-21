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

#import "RNGoogleMobileAdsAdInspectorModule.h"
#import "RNGoogleMobileAdsCommon.h"
#import "common/RNSharedUtils.h"

@implementation RNGoogleMobileAdsAdInspectorModule
#pragma mark -
#pragma mark Module Setup

RCT_EXPORT_MODULE();

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

#pragma mark -
#pragma mark Google Mobile Ads Methods

RCT_EXPORT_METHOD(openAdInspector
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  [GADMobileAds.sharedInstance presentAdInspectorFromViewController:RCTSharedApplication().delegate.window.rootViewController
                                                  completionHandler:^(NSError *_Nullable error){
    if (error != nil) {
      [RNSharedUtils
       rejectPromiseWithUserInfo:reject
       userInfo:[@{
        @"code" : [NSString stringWithFormat:@"CODE_%d", error.code],
        @"message" : error.description,
       } mutableCopy]];
    }
    resolve(nil);
  }];
}

@end
