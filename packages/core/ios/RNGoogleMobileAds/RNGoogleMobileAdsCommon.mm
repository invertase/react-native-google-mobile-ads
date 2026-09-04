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
#import "RNGoogleMobileAdsOwnedMappers.h"
#import "common/RNRCTEventEmitter.h"

NSString *const GOOGLE_MOBILE_ADS_EVENT_APP_OPEN = @"google_mobile_ads_app_open_event";
NSString *const GOOGLE_MOBILE_ADS_EVENT_INTERSTITIAL = @"google_mobile_ads_interstitial_event";
NSString *const GOOGLE_MOBILE_ADS_EVENT_REWARDED = @"google_mobile_ads_rewarded_event";
NSString *const GOOGLE_MOBILE_ADS_EVENT_REWARDED_INTERSTITIAL =
    @"google_mobile_ads_rewarded_interstitial_event";
NSString *const GOOGLE_MOBILE_ADS_EVENT_POOL = @"google_mobile_ads_pool_event";
NSString *const GOOGLE_MOBILE_ADS_EVENT_LOADED = @"loaded";
NSString *const GOOGLE_MOBILE_ADS_EVENT_ERROR = @"error";
NSString *const GOOGLE_MOBILE_ADS_EVENT_OPENED = @"opened";
NSString *const GOOGLE_MOBILE_ADS_EVENT_CLICKED = @"clicked";
NSString *const GOOGLE_MOBILE_ADS_EVENT_CLOSED = @"closed";
NSString *const GOOGLE_MOBILE_ADS_EVENT_IMPRESSION = @"impression";
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

  if (adRequestOptions[@"publisherProvidedSignals"]) {
    NSDictionary *pps = adRequestOptions[@"publisherProvidedSignals"];
    for (NSString *key in pps) {
      extras[key] = pps[key];
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

  if (adRequestOptions[@"neighboringContentUrls"]) {
    request.neighboringContentURLStrings = adRequestOptions[@"neighboringContentUrls"];
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
  return [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:error.code
                                                              message:[error localizedDescription]];
}

+ (NSMutableDictionary *)adErrorPayloadFromAdError:(NSError *)error phase:(NSString *)phase {
  return [RNGoogleMobileAdsOwnedMappers adErrorPayloadFromAdErrorCode:error.code
                                                              message:[error localizedDescription]
                                                                phase:phase];
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

+ (GADAdSize)stringToAdSize:(NSString *)value
              withMaxHeight:(CGFloat)maxHeight
                   andWidth:(CGFloat)adWidth {
  CGFloat customWidth = 0;
  CGFloat customHeight = 0;
  if ([RNGoogleMobileAdsOwnedMappers customAdSizeFromString:value
                                                      width:&customWidth
                                                     height:&customHeight]) {
    return GADAdSizeFromCGSize(CGSizeMake(customWidth, customHeight));
  }

  NSString *token = [RNGoogleMobileAdsOwnedMappers namedBannerSizeTokenFromString:value];
  if ([token isEqualToString:@"BANNER"]) {
    return GADAdSizeBanner;
  } else if ([token isEqualToString:@"FLUID"]) {
    return GADAdSizeFluid;
  } else if ([token isEqualToString:@"WIDE_SKYSCRAPER"]) {
    return GADAdSizeSkyscraper;
  } else if ([token isEqualToString:@"LARGE_BANNER"]) {
    return GADAdSizeLargeBanner;
  } else if ([token isEqualToString:@"MEDIUM_RECTANGLE"]) {
    return GADAdSizeMediumRectangle;
  } else if ([token isEqualToString:@"FULL_BANNER"]) {
    return GADAdSizeFullBanner;
  } else if ([token isEqualToString:@"LEADERBOARD"]) {
    return GADAdSizeLeaderboard;
  } else if ([token isEqualToString:@"ANCHORED_ADAPTIVE_BANNER"] ||
             [token isEqualToString:@"LARGE_ANCHORED_ADAPTIVE_BANNER"] ||
             [token isEqualToString:@"INLINE_ADAPTIVE_BANNER"]) {
    CGRect frame = [[UIScreen mainScreen] bounds];
    if (@available(iOS 11.0, *)) {
      frame =
          UIEdgeInsetsInsetRect(frame, [UIApplication sharedApplication].keyWindow.safeAreaInsets);
    }
    CGFloat viewWidth = adWidth > 0 ? MIN(frame.size.width, adWidth) : frame.size.width;
    if ([token isEqualToString:@"INLINE_ADAPTIVE_BANNER"]) {
      if (maxHeight > 0) {
        return GADInlineAdaptiveBannerAdSizeWithWidthAndMaxHeight(viewWidth, MAX(maxHeight, 32.0));
      }
      return GADCurrentOrientationInlineAdaptiveBannerAdSizeWithWidth(viewWidth);
    }
    if ([token isEqualToString:@"LARGE_ANCHORED_ADAPTIVE_BANNER"]) {
      return GADLargeAnchoredAdaptiveBannerAdSizeWithWidth(viewWidth);
    }
    return GADCurrentOrientationAnchoredAdaptiveBannerAdSizeWithWidth(viewWidth);
  } else {
    return GADAdSizeBanner;
  }
}

+ (BOOL)isAdManagerUnit:(NSString *)unitId {
  return [RNGoogleMobileAdsOwnedMappers isAdManagerUnit:unitId];
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
