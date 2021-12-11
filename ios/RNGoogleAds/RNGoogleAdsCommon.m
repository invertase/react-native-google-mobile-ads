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

#import "RNGoogleAdsCommon.h"
#import "common/RNRCTEventEmitter.h"

NSString *const GOOGLE_ADS_EVENT_INTERSTITIAL = @"google_ads_interstitial_event";
NSString *const GOOGLE_ADS_EVENT_REWARDED = @"google_ads_rewarded_event";
NSString *const GOOGLE_ADS_EVENT_LOADED = @"loaded";
NSString *const GOOGLE_ADS_EVENT_ERROR = @"error";
NSString *const GOOGLE_ADS_EVENT_OPENED = @"opened";
NSString *const GOOGLE_ADS_EVENT_CLICKED = @"clicked";
NSString *const GOOGLE_ADS_EVENT_LEFT_APPLICATION = @"left_application";
NSString *const GOOGLE_ADS_EVENT_CLOSED = @"closed";
NSString *const GOOGLE_ADS_EVENT_REWARDED_LOADED = @"rewarded_loaded";
NSString *const GOOGLE_ADS_EVENT_REWARDED_EARNED_REWARD = @"rewarded_earned_reward";

@implementation RNGADInterstitial : GADInterstitialAd
- (void)setRequestId:(NSNumber *)requestId {
  _requestId = requestId;
}
@end

@implementation RNGADRewarded : GADRewardedAd
- (void)setRequestId:(NSNumber *)requestId {
  _requestId = requestId;
}
@end

@implementation RNGoogleAdsCommon

+ (GADRequest *)buildAdRequest:(NSDictionary *)adRequestOptions {
  GADRequest *request = [GADRequest request];
  NSMutableDictionary *extras = [@{} mutableCopy];

  if (adRequestOptions[@"requestNonPersonalizedAdsOnly"] &&
      [adRequestOptions[@"requestNonPersonalizedAdsOnly"] boolValue]) {
    extras[@"npa"] = @"1";
  }

  if (adRequestOptions[@"networkExtras"]) {
    for (NSString *key in adRequestOptions[@"networkExtras"]) {
      NSString *value = adRequestOptions[@"networkExtras"][key];
      extras[key] = value;
    }
  }

  GADExtras *networkExtras = [[GADExtras alloc] init];
  networkExtras.additionalParameters = extras;
  [request registerAdNetworkExtras:networkExtras];

  if (adRequestOptions[@"keywords"]) {
    request.keywords = adRequestOptions[@"keywords"];
  }

  if (adRequestOptions[@"location"]) {
    NSArray<NSNumber *> *latLong = adRequestOptions[@"location"];
    [request setLocationWithLatitude:[latLong[0] doubleValue]
                           longitude:[latLong[1] doubleValue]
                            accuracy:[adRequestOptions[@"locationAccuracy"] doubleValue]];
  }

  if (adRequestOptions[@"contentUrl"]) {
    request.contentURL = adRequestOptions[@"contentUrl"];
  }

  if (adRequestOptions[@"requestAgent"]) {
    request.requestAgent = adRequestOptions[@"requestAgent"];
  }

  return request;
}

+ (NSDictionary *)getCodeAndMessageFromAdError:(NSError *)error {
  NSString *code = @"unknown";
  NSString *message = @"An unknown error occurred.";

  if (error.code == GADErrorInvalidRequest) {
    code = @"invalid-request";
    message = @"The ad request was invalid; for instance, the ad unit ID was incorrect.";
  } else if (error.code == GADErrorNoFill) {
    code = @"no-fill";
    message = @"The ad request was successful, but no ad was returned due to lack of ad inventory.";
  } else if (error.code == GADErrorNetworkError) {
    code = @"network-error";
    message = @"The ad request was unsuccessful due to network connectivity.";
  } else if (error.code == GADErrorInternalError) {
    code = @"internal-error";
    message = @"Something happened internally; for instance, an invalid response was received from "
              @"the ad server.";
  }

  return @{
    @"code" : code,
    @"message" : message,
  };
}

+ (void)sendAdEvent:(NSString *)event
          requestId:(NSNumber *)requestId
               type:(NSString *)type
           adUnitId:(NSString *)adUnitId
              error:(nullable NSDictionary *)error
               data:(nullable NSDictionary *)data {
  NSMutableDictionary *body = [@{
    @"type" : type,
  } mutableCopy];

  if (error != nil) {
    body[@"error"] = error;
  }

  if (data != nil) {
    body[@"data"] = data;
  }

  NSMutableDictionary *payload = [@{
    @"eventName" : type,
    @"requestId" : requestId,
    @"adUnitId" : adUnitId,
    @"body" : body,
  } mutableCopy];

  [[RNRCTEventEmitter shared] sendEventWithName:event body:payload];
}

+ (GADAdSize)stringToAdSize:(NSString *)value {
  NSError *error = nil;
  NSRegularExpression *regex =
      [NSRegularExpression regularExpressionWithPattern:@"([0-9]+)x([0-9]+)"
                                                options:0
                                                  error:&error];
  NSArray *matches = [regex matchesInString:value options:0 range:NSMakeRange(0, [value length])];

  for (NSTextCheckingResult *match in matches) {
    NSString *matchText = [value substringWithRange:[match range]];
    if (matchText) {
      NSArray *values = [matchText componentsSeparatedByString:@"x"];
      CGFloat width = (CGFloat)[values[0] intValue];
      CGFloat height = (CGFloat)[values[1] intValue];
      return GADAdSizeFromCGSize(CGSizeMake(width, height));
    }
  }

  value = [value uppercaseString];

  if ([value isEqualToString:@"BANNER"]) {
    return GADAdSizeBanner;
  } else if ([value isEqualToString:@"FLUID"]) {
    return GADAdSizeFluid;
  } else if ([value isEqualToString:@"WIDE_SKYSCRAPER"]) {
    return GADAdSizeSkyscraper;
  } else if ([value isEqualToString:@"LARGE_BANNER"]) {
    return GADAdSizeLargeBanner;
  } else if ([value isEqualToString:@"MEDIUM_RECTANGLE"]) {
    return GADAdSizeMediumRectangle;
  } else if ([value isEqualToString:@"FULL_BANNER"]) {
    return GADAdSizeFullBanner;
  } else if ([value isEqualToString:@"LEADERBOARD"]) {
    return GADAdSizeLeaderboard;
  } else if ([value isEqualToString:@"ADAPTIVE_BANNER"]) {
    CGFloat viewWidth = [[UIScreen mainScreen] bounds].size.width;
    return GADCurrentOrientationAnchoredAdaptiveBannerAdSizeWithWidth(viewWidth);
  } else {
    return GADAdSizeBanner;
  }
}

@end
