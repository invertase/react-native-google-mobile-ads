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

#import "RNGoogleMobileAdsSwipeableInterstitialAdModule.h"
#import <GoogleMobileAds/GADSwipeableInterstitialAdDelegate_Beta.h>
#import <GoogleMobileAds/GADSwipeableInterstitialAdOptions_Beta.h>
#import <GoogleMobileAds/GADSwipeableInterstitialAd_Beta.h>
#import <GoogleMobileAds/GoogleMobileAds.h>
#import "RNGoogleMobileAdsCommon.h"
#import "RNGoogleMobileAdsResponseInfo.h"

@interface RNGoogleMobileAdsSwipeableInterstitialDelegate
    : NSObject <GADSwipeableInterstitialAdDelegate>
@property(nonatomic) int requestId;
@property(nonatomic, copy) NSString *adUnitId;
@end

@implementation RNGoogleMobileAdsSwipeableInterstitialDelegate

- (void)sendEvent:(NSString *)type data:(NSDictionary *)data {
  [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_SWIPEABLE_INTERSTITIAL
                             requestId:@(self.requestId)
                                  type:type
                              adUnitId:self.adUnitId
                                 error:nil
                                  data:data];
}

- (void)swipeableInterstitialAdDidRecordImpression:
    (GADSwipeableInterstitialAd *)swipeableInterstitialAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_IMPRESSION data:nil];
}

- (void)swipeableInterstitialAdDidRecordClick:
    (GADSwipeableInterstitialAd *)swipeableInterstitialAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_CLICKED data:nil];
}

- (void)swipeableInterstitialAdWillPresentScreen:
    (GADSwipeableInterstitialAd *)swipeableInterstitialAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_WILL_PRESENT_SCREEN data:nil];
}

- (void)swipeableInterstitialAdWillDismissScreen:
    (GADSwipeableInterstitialAd *)swipeableInterstitialAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_WILL_DISMISS_SCREEN data:nil];
}

- (void)swipeableInterstitialAdDidDismissScreen:
    (GADSwipeableInterstitialAd *)swipeableInterstitialAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_DID_DISMISS_SCREEN data:nil];
}

- (void)swipeableInterstitialAdDidStartScreenHoldTimer:
    (GADSwipeableInterstitialAd *)swipeableInterstitialAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_SCREEN_HOLD_TIMER_STARTED data:nil];
}

@end

static NSMutableDictionary<NSNumber *, GADSwipeableInterstitialAd *> *RNGMASwipeableInterstitialAds(
    void) {
  static NSMutableDictionary<NSNumber *, GADSwipeableInterstitialAd *> *map = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    map = [NSMutableDictionary new];
  });
  return map;
}

@implementation RNGoogleMobileAdsSwipeableInterstitialAdModule {
  NSMutableDictionary<NSNumber *, RNGoogleMobileAdsSwipeableInterstitialDelegate *> *_delegateMap;
  NSMutableDictionary<NSNumber *, NSNumber *> *_generationMap;
}

RCT_EXPORT_MODULE();

+ (GADSwipeableInterstitialAd *)swipeableInterstitialAdForRequestId:(int)requestId {
  return RNGMASwipeableInterstitialAds()[@(requestId)];
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (instancetype)init {
  if (self = [super init]) {
    _delegateMap = [NSMutableDictionary new];
    _generationMap = [NSMutableDictionary new];
  }
  return self;
}

- (void)dealloc {
  [self invalidate];
}

- (void)invalidate {
  [RNGMASwipeableInterstitialAds() removeAllObjects];
  [_delegateMap removeAllObjects];
  [_generationMap removeAllObjects];
}

- (NSNumber *)beginLoadGenerationForRequestId:(int)requestId {
  NSNumber *key = @(requestId);
  NSInteger next = [_generationMap[key] integerValue] + 1;
  NSNumber *generation = @(next);
  _generationMap[key] = generation;
  [RNGMASwipeableInterstitialAds() removeObjectForKey:key];
  [_delegateMap removeObjectForKey:key];
  return generation;
}

- (BOOL)isCurrentGeneration:(NSNumber *)generation forRequestId:(int)requestId {
  return [_generationMap[@(requestId)] isEqualToNumber:generation];
}

- (UISwipeGestureRecognizerDirection)swipeDirectionFromString:(NSString *)value {
  if ([value isEqualToString:@"left"]) {
    return UISwipeGestureRecognizerDirectionLeft;
  }
  if ([value isEqualToString:@"up"]) {
    return UISwipeGestureRecognizerDirectionUp;
  }
  if ([value isEqualToString:@"down"]) {
    return UISwipeGestureRecognizerDirectionDown;
  }
  return UISwipeGestureRecognizerDirectionRight;
}

- (GADSwipeableInterstitialAdOptions *)optionsFromRequest:(NSDictionary *)requestOptions {
  GADSwipeableInterstitialAdOptions *options = [[GADSwipeableInterstitialAdOptions alloc] init];
  if (requestOptions[@"maxScreenHoldDurationSeconds"] != nil) {
    options.maxScreenHoldDuration = [requestOptions[@"maxScreenHoldDurationSeconds"] doubleValue];
  }
  if (requestOptions[@"adSize"] != nil) {
    NSDictionary *adSize = requestOptions[@"adSize"];
    options.adSize = CGSizeMake([adSize[@"width"] doubleValue], [adSize[@"height"] doubleValue]);
  }
  if (requestOptions[@"customClickSwipeGesture"] != nil) {
    NSDictionary *gesture = requestOptions[@"customClickSwipeGesture"];
    NSString *direction = gesture[@"direction"];
    BOOL tapsAllowed = gesture[@"tapsAllowed"] == nil ? YES : [gesture[@"tapsAllowed"] boolValue];
    if (direction != nil) {
      [options enableCustomClickSwipeGestureWithDirection:[self swipeDirectionFromString:direction]
                                              tapsAllowed:tapsAllowed];
    }
  }
  return options;
}

RCT_EXPORT_METHOD(swipeableInterstitialLoad
                  : (double)requestId adUnitId
                  : (NSString *)adUnitId requestOptions
                  : (NSDictionary *)requestOptions) {
  int requestIdInt = (int)requestId;
  NSNumber *generation = [self beginLoadGenerationForRequestId:requestIdInt];
  GAMRequest *request = [RNGoogleMobileAdsCommon buildAdRequest:requestOptions];
  GADSwipeableInterstitialAdOptions *options = [self optionsFromRequest:requestOptions];

  __weak __typeof(self) weakSelf = self;
  [GADSwipeableInterstitialAd
       loadWithAdUnitID:adUnitId
                request:request
                options:options
      completionHandler:^(GADSwipeableInterstitialAd *_Nullable ad, NSError *_Nullable error) {
        __strong __typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) {
          return;
        }
        if (![strongSelf isCurrentGeneration:generation forRequestId:requestIdInt]) {
          return;
        }
        if (error) {
          NSMutableDictionary *codeAndMessage =
              [RNGoogleMobileAdsCommon adErrorPayloadFromAdError:error phase:@"load"];
          NSDictionary *responseInfo = [RNGoogleMobileAdsResponseInfo
              dictionaryFromResponseInfo:[RNGoogleMobileAdsResponseInfo
                                             responseInfoFromLoadError:error]
                                 compact:NO];
          if (responseInfo != nil) {
            codeAndMessage[@"responseInfo"] = responseInfo;
          }
          [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_SWIPEABLE_INTERSTITIAL
                                     requestId:@(requestIdInt)
                                          type:GOOGLE_MOBILE_ADS_EVENT_ERROR
                                      adUnitId:adUnitId
                                         error:codeAndMessage
                                          data:nil];
          return;
        }

        RNGoogleMobileAdsSwipeableInterstitialDelegate *delegate =
            [[RNGoogleMobileAdsSwipeableInterstitialDelegate alloc] init];
        delegate.requestId = requestIdInt;
        delegate.adUnitId = adUnitId;
        ad.delegate = delegate;

        GADResponseInfo *gadResponseInfo = ad.responseInfo;
        GADPaidEventHandler paidEventHandler = ^(GADAdValue *value) {
          [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_SWIPEABLE_INTERSTITIAL
                                     requestId:@(requestIdInt)
                                          type:@"paid"
                                      adUnitId:adUnitId
                                         error:nil
                                          data:[RNGoogleMobileAdsResponseInfo
                                                   paidEventPayloadFromAdValue:value
                                                                  responseInfo:gadResponseInfo]];
        };
        ad.paidEventHandler = paidEventHandler;

        NSMutableDictionary *data = [NSMutableDictionary dictionary];
        data[@"minScreenHoldDuration"] = @(ad.minScreenHoldDuration);
        data[@"isCustomClickGestureEnabled"] = @NO;
        NSDictionary *responseInfo =
            [RNGoogleMobileAdsResponseInfo dictionaryFromResponseInfo:gadResponseInfo compact:NO];
        if (responseInfo != nil) {
          data[@"responseInfo"] = responseInfo;
        }

        RNGMASwipeableInterstitialAds()[@(requestIdInt)] = ad;
        strongSelf->_delegateMap[@(requestIdInt)] = delegate;

        [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_SWIPEABLE_INTERSTITIAL
                                   requestId:@(requestIdInt)
                                        type:GOOGLE_MOBILE_ADS_EVENT_LOADED
                                    adUnitId:adUnitId
                                       error:nil
                                        data:data.count > 0 ? data : nil];
      }];
}

RCT_EXPORT_METHOD(swipeableInterstitialRecordCustomClickGesture : (double)requestId) {
  // Custom click gesture recording is Android Next-Gen only.
}

RCT_EXPORT_METHOD(swipeableInterstitialDestroy : (double)requestId) {
  int requestIdInt = (int)requestId;
  NSNumber *key = @(requestIdInt);
  NSInteger next = [_generationMap[key] integerValue] + 1;
  _generationMap[key] = @(next);
  [RNGMASwipeableInterstitialAds() removeObjectForKey:key];
  [_delegateMap removeObjectForKey:key];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeSwipeableInterstitialAdModuleSpecJSI>(params);
}
#endif

@end

#endif