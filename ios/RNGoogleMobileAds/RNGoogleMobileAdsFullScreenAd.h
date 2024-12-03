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

#import <Foundation/Foundation.h>
#import <GoogleMobileAds/GoogleMobileAds.h>
#import "RNGoogleMobileAdsFullScreenContentDelegate.h"
#import "RNSharedUtils.h"

@interface RNGoogleMobileAdsFullScreenAd : NSObject

@property(nonatomic, strong) NSMutableDictionary<NSNumber *, id<GADFullScreenPresentingAd>> *adMap;
@property(nonatomic, strong)
    NSMutableDictionary<NSNumber *, RNGoogleMobileAdsFullScreenContentDelegate *> *delegateMap;

- (instancetype)init;
- (void)invalidate;
- (NSString *)getAdEventName;
- (void)loadAd:(NSString *)adUnitId
            adRequest:(GAMRequest *)adRequest
    completionHandler:(void (^)(id<GADFullScreenPresentingAd> ad, NSError *error))completionHandler;
- (void)sendAdEvent:(NSString *)type
          requestId:(int)requestId
           adUnitId:(NSString *)adUnitId
              error:(NSDictionary *)error
               data:(NSDictionary *)data;
- (void)loadWithRequestId:(int)requestId
                 adUnitId:(NSString *)adUnitId
         adRequestOptions:(NSDictionary *)adRequestOptions;
- (void)showWithRequestId:(int)requestId
                 adUnitId:(NSString *)adUnitId
              showOptions:(NSDictionary *)showOptions
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject;

@end

#endif