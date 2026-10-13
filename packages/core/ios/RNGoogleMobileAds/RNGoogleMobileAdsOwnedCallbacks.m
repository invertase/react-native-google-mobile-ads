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
 */

#import "RNGoogleMobileAdsOwnedCallbacks.h"

#import "RNGoogleMobileAdsBannerEventMapping.h"
#import "RNGoogleMobileAdsFullScreenEventDelivery.h"

@implementation RNGoogleMobileAdsOwnedCallbackSurface
@end

@implementation RNGoogleMobileAdsOwnedCallbacks

+ (NSString *)fullscreenPaidEventType {
  return @"paid";
}

+ (NSString *)fullscreenClickedEventType {
  return @"clicked";
}

+ (NSString *)fullscreenEarnedRewardEventType {
  return @"rewarded_earned_reward";
}

+ (NSString *)bannerPaidNativeEventType {
  return @"onPaid";
}

+ (NSString *)bannerClickedNativeEventType {
  return [RNGoogleMobileAdsBannerEventMapping
      nativeEventTypeForCallback:RNGoogleMobileAdsBannerDelegateCallbackDidRecordClick];
}

+ (void)attachPaidHandlerToSurface:(RNGoogleMobileAdsOwnedCallbackSurface *)surface
                              emit:(void (^)(NSString *type, id value))emit {
  surface.paidEventHandler = ^(id value) {
    if (emit) {
      emit([RNGoogleMobileAdsOwnedCallbacks fullscreenPaidEventType], value);
    }
  };
}

+ (void)attachClickHandlerToSurface:(RNGoogleMobileAdsOwnedCallbackSurface *)surface
                          eventType:(NSString *)eventType
                               emit:(void (^)(NSString *type))emit {
  NSString *resolvedType = [eventType copy];
  surface.clickHandler = ^{
    if (emit) {
      emit(resolvedType);
    }
  };
}

+ (void)attachRewardHandlerToSurface:(RNGoogleMobileAdsOwnedCallbackSurface *)surface
                          rewardType:(NSString *)rewardType
                              amount:(NSNumber *)amount
                                emit:(void (^)(NSString *type, NSDictionary *data))emit {
  NSDictionary *rewardData =
      [RNGoogleMobileAdsFullScreenEventDelivery rewardEventDataWithType:rewardType amount:amount];
  surface.userDidEarnRewardHandler = ^{
    [RNGoogleMobileAdsFullScreenEventDelivery dispatchAsyncOnMainQueue:^{
      if (emit) {
        emit([RNGoogleMobileAdsOwnedCallbacks fullscreenEarnedRewardEventType], rewardData);
      }
    }];
  };
}

+ (NSNumber *)manualImpressionsEnabledNumberFromBool:(BOOL)enabled {
  return @(enabled);
}

+ (BOOL)shouldApplyEnableManualImpressions:(BOOL)manualImpressionsEnabled
                           isAdManagerUnit:(BOOL)isAdManagerUnit {
  return isAdManagerUnit && manualImpressionsEnabled;
}

+ (BOOL)shouldRecordManualImpressionForBannerClass:(Class)bannerClass
                              adManagerBannerClass:(Class)adManagerBannerClass {
  if (bannerClass == Nil || adManagerBannerClass == Nil) {
    return NO;
  }
  return [bannerClass isSubclassOfClass:adManagerBannerClass];
}

+ (RNGoogleMobileAdsBannerCommandAction)actionForCommandName:(NSString *)commandName {
  if ([commandName isEqualToString:@"recordManualImpression"]) {
    return RNGoogleMobileAdsBannerCommandActionRecordManualImpression;
  }
  if ([commandName isEqualToString:@"load"]) {
    return RNGoogleMobileAdsBannerCommandActionLoad;
  }
  return RNGoogleMobileAdsBannerCommandActionUnknown;
}

@end
