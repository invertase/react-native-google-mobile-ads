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

#if !TARGET_OS_MACCATALYST

#import <GoogleMobileAds/GoogleMobileAds.h>
#import <React/RCTBridgeModule.h>

@interface RNGoogleMobileAdsCommon : NSObject

+ (GAMRequest *)buildAdRequest:(NSDictionary *)adRequestOptions;

+ (NSDictionary *)getCodeAndMessageFromAdError:(NSError *)error;

+ (void)sendAdEvent:(NSString *)event
          requestId:(NSNumber *)requestId
               type:(NSString *)type
           adUnitId:(NSString *)adUnitId
              error:(nullable NSDictionary *)error
               data:(nullable NSDictionary *)data;

+ (GADAdSize)stringToAdSize:(NSString *)value;

+ (BOOL)isAdManagerUnit:(NSString *)unitId;

+ (nullable UIViewController *)currentViewController;

@end

@interface RNGADInterstitial : GADInterstitialAd
@property(nonatomic) NSNumber *requestId;
- (void)setRequestId:(NSNumber *)requestId;
@end

@interface RNGADRewarded : GADRewardedAd
@property(nonatomic) NSNumber *requestId;
- (void)setRequestId:(NSNumber *)requestId;
@end

extern NSString *const GOOGLE_MOBILE_ADS_EVENT_APP_OPEN;
extern NSString *const GOOGLE_MOBILE_ADS_EVENT_INTERSTITIAL;
extern NSString *const GOOGLE_MOBILE_ADS_EVENT_REWARDED;
extern NSString *const GOOGLE_MOBILE_ADS_EVENT_REWARDED_INTERSTITIAL;

extern NSString *const GOOGLE_MOBILE_ADS_EVENT_LOADED;
extern NSString *const GOOGLE_MOBILE_ADS_EVENT_ERROR;
extern NSString *const GOOGLE_MOBILE_ADS_EVENT_OPENED;
extern NSString *const GOOGLE_MOBILE_ADS_EVENT_CLICKED;
extern NSString *const GOOGLE_MOBILE_ADS_EVENT_CLOSED;
extern NSString *const GOOGLE_MOBILE_ADS_EVENT_APP_EVENT;

extern NSString *const GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED;
extern NSString *const GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD;

#endif
