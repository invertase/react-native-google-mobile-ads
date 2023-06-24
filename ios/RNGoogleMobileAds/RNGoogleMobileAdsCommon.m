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

#import "RNGoogleMobileAdsCommon.h"
#import "common/RNRCTEventEmitter.h"

NSString *const GOOGLE_MOBILE_ADS_EVENT_APP_OPEN = @"google_mobile_ads_app_open_event";
NSString *const GOOGLE_MOBILE_ADS_EVENT_INTERSTITIAL = @"google_mobile_ads_interstitial_event";
NSString *const GOOGLE_MOBILE_ADS_EVENT_REWARDED = @"google_mobile_ads_rewarded_event";
NSString *const GOOGLE_MOBILE_ADS_EVENT_REWARDED_INTERSTITIAL =
    @"google_mobile_ads_rewarded_interstitial_event";
NSString *const GOOGLE_MOBILE_ADS_EVENT_LOADED = @"loaded";
NSString *const GOOGLE_MOBILE_ADS_EVENT_ERROR = @"error";
NSString *const GOOGLE_MOBILE_ADS_EVENT_OPENED = @"opened";
NSString *const GOOGLE_MOBILE_ADS_EVENT_CLICKED = @"clicked";
NSString *const GOOGLE_MOBILE_ADS_EVENT_CLOSED = @"closed";
NSString *const GOOGLE_MOBILE_ADS_EVENT_APP_EVENT = @"app_event";
NSString *const GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED = @"rewarded_loaded";
NSString *const GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD = @"rewarded_earned_reward";

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

@implementation RNGoogleMobileAdsCommon

+ (GAMRequest *)buildAdRequest:(NSDictionary *)adRequestOptions {
  GAMRequest *request = [GAMRequest request];
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

  if (adRequestOptions[@"contentUrl"]) {
    request.contentURL = adRequestOptions[@"contentUrl"];
  }

  if (adRequestOptions[@"requestAgent"]) {
    request.requestAgent = adRequestOptions[@"requestAgent"];
  }

  if (adRequestOptions[@"customTargeting"]) {
    request.customTargeting = adRequestOptions[@"customTargeting"];
  }

  if (adRequestOptions[@"publisherProvidedId"]) {
    request.publisherProvidedID = adRequestOptions[@"publisherProvidedId"];
  }

  return request;
}

+ (NSDictionary *)getCodeAndMessageFromAdError:(NSError *)error {
  NSString *code = @"unknown";
  NSString *message = [error localizedDescription];

  if (error.code == GADErrorInvalidRequest) {
    code = @"invalid-request";
  } else if (error.code == GADErrorNoFill) {
    code = @"no-fill";
  } else if (error.code == GADErrorNetworkError) {
    code = @"network-error";
  } else if (error.code == GADErrorServerError) {
    code = @"server-error";
  } else if (error.code == GADErrorOSVersionTooLow) {
    code = @"os-version-too-low";
  } else if (error.code == GADErrorTimeout) {
    code = @"timeout";
  } else if (error.code == GADErrorMediationDataError) {
    code = @"mediation-data-error";
  } else if (error.code == GADErrorMediationAdapterError) {
    code = @"mediation-adapter-error";
  } else if (error.code == GADErrorMediationInvalidAdSize) {
    code = @"mediation-invalid-ad-size";
  } else if (error.code == GADErrorInternalError) {
    code = @"internal-error";
  } else if (error.code == GADErrorInvalidArgument) {
    code = @"invalid-argument";
  } else if (error.code == GADErrorReceivedInvalidResponse) {
    code = @"received-invalid-response";
  } else if (error.code == GADErrorMediationNoFill) {
    code = @"mediation-no-fill";
  } else if (error.code == GADErrorAdAlreadyUsed) {
    code = @"ad-already-used";
  } else if (error.code == GADErrorApplicationIdentifierMissing) {
    code = @"application-identifier-missing";
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
  } else if ([value isEqualToString:@"ADAPTIVE_BANNER"] ||
             [value isEqualToString:@"ANCHORED_ADAPTIVE_BANNER"] ||
             [value isEqualToString:@"INLINE_ADAPTIVE_BANNER"]) {
    CGRect frame = [[UIScreen mainScreen] bounds];
    if (@available(iOS 11.0, *)) {
      frame =
          UIEdgeInsetsInsetRect(frame, [UIApplication sharedApplication].keyWindow.safeAreaInsets);
    }
    CGFloat viewWidth = frame.size.width;
    if ([value isEqualToString:@"INLINE_ADAPTIVE_BANNER"]) {
      return GADCurrentOrientationInlineAdaptiveBannerAdSizeWithWidth(viewWidth);
    }
    return GADCurrentOrientationAnchoredAdaptiveBannerAdSizeWithWidth(viewWidth);
  } else {
    return GADAdSizeBanner;
  }
}

+ (BOOL)isAdManagerUnit:(NSString *)unitId {
  if (unitId == nil) {
    return NO;
  }
  return [unitId hasPrefix:@"/"];
}

+ (UIViewController *)currentViewController {
  UIViewController *controller = [[[UIApplication sharedApplication] keyWindow] rootViewController];
  UIViewController *presentedController = controller.presentedViewController;

  while (presentedController && ![presentedController isBeingDismissed]) {
    controller = presentedController;
    presentedController = controller.presentedViewController;
  }
  return controller;
}

@end

#endif
