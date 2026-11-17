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

#import "RNGoogleMobileAdsPictureInPictureModule.h"
#import <GoogleMobileAds/GoogleMobileAds.h>
#if __has_include(<GoogleMobileAds/GoogleMobileAds_Private.h>)
#import <GoogleMobileAds/GoogleMobileAds_Private.h>
#endif
#import "RNGoogleMobileAdsCommon.h"
#import "RNGoogleMobileAdsResponseInfo.h"
#import "common/RNSharedUtils.h"

@interface RNGoogleMobileAdsPictureInPictureDelegate
    : NSObject <GADPictureInPictureAdDelegate>
@property(nonatomic) int requestId;
@property(nonatomic, copy) NSString *adUnitId;
@end

@implementation RNGoogleMobileAdsPictureInPictureDelegate

- (void)sendEvent:(NSString *)type data:(NSDictionary *)data {
  [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_PICTURE_IN_PICTURE
                             requestId:@(self.requestId)
                                  type:type
                              adUnitId:self.adUnitId
                                 error:nil
                                  data:data];
}

- (void)pictureInPictureAdDidShow:(GADPictureInPictureAd *)pictureInPictureAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_SHOWN data:nil];
}

- (void)pictureInPictureAdDidHide:(GADPictureInPictureAd *)pictureInPictureAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_HIDDEN data:nil];
}

- (void)pictureInPictureAdDidFailToShow:(GADPictureInPictureAd *)pictureInPictureAd
                              withError:(NSError *)error {
  NSMutableDictionary *payload = [RNGoogleMobileAdsCommon adErrorPayloadFromAdError:error phase:@"show"];
  [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_PICTURE_IN_PICTURE
                             requestId:@(self.requestId)
                                  type:GOOGLE_MOBILE_ADS_EVENT_ERROR
                              adUnitId:self.adUnitId
                                 error:payload
                                  data:nil];
}

- (void)pictureInPictureAdDidRecordImpression:(GADPictureInPictureAd *)pictureInPictureAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_IMPRESSION data:nil];
}

- (void)pictureInPictureAdDidRecordClick:(GADPictureInPictureAd *)pictureInPictureAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_CLICKED data:nil];
}

- (void)pictureInPictureAdWillPresentScreen:(GADPictureInPictureAd *)pictureInPictureAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_WILL_PRESENT_SCREEN data:nil];
}

- (void)pictureInPictureAdWillDismissScreen:(GADPictureInPictureAd *)pictureInPictureAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_WILL_DISMISS_SCREEN data:nil];
}

- (void)pictureInPictureAdDidDismissScreen:(GADPictureInPictureAd *)pictureInPictureAd {
  [self sendEvent:GOOGLE_MOBILE_ADS_EVENT_DID_DISMISS_SCREEN data:nil];
}

@end

@implementation RNGoogleMobileAdsPictureInPictureModule {
  NSMutableDictionary<NSNumber *, GADPictureInPictureAd *> *_adMap;
  NSMutableDictionary<NSNumber *, RNGoogleMobileAdsPictureInPictureDelegate *> *_delegateMap;
  NSMutableDictionary<NSNumber *, NSNumber *> *_generationMap;
}

RCT_EXPORT_MODULE();

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (instancetype)init {
  if (self = [super init]) {
    _adMap = [NSMutableDictionary new];
    _delegateMap = [NSMutableDictionary new];
    _generationMap = [NSMutableDictionary new];
  }
  return self;
}

- (void)dealloc {
  [self invalidate];
}

- (void)invalidate {
  [_adMap removeAllObjects];
  [_delegateMap removeAllObjects];
  [_generationMap removeAllObjects];
}

- (NSNumber *)beginLoadGenerationForRequestId:(int)requestId {
  NSNumber *key = @(requestId);
  NSInteger next = [_generationMap[key] integerValue] + 1;
  NSNumber *generation = @(next);
  _generationMap[key] = generation;
  [_adMap removeObjectForKey:key];
  [_delegateMap removeObjectForKey:key];
  return generation;
}

- (BOOL)isCurrentGeneration:(NSNumber *)generation forRequestId:(int)requestId {
  return [_generationMap[@(requestId)] isEqualToNumber:generation];
}

- (GADPictureInPictureAdPosition)positionFromString:(NSString *)value {
  if ([value isEqualToString:@"topLeft"]) {
    return GADPictureInPictureAdPositionTopLeft;
  }
  if ([value isEqualToString:@"topRight"]) {
    return GADPictureInPictureAdPositionTopRight;
  }
  if ([value isEqualToString:@"bottomLeft"]) {
    return GADPictureInPictureAdPositionBottomLeft;
  }
  if ([value isEqualToString:@"bottomRight"]) {
    return GADPictureInPictureAdPositionBottomRight;
  }
  return GADPictureInPictureAdPositionDefault;
}

- (GADPictureInPictureAdPresentationScope)presentationScopeFromString:(NSString *)value {
  if ([value isEqualToString:@"application"]) {
    return GADPictureInPictureAdPresentationScopeApplication;
  }
  return GADPictureInPictureAdPresentationScopeScreen;
}

RCT_EXPORT_METHOD(pictureInPictureLoad
                  : (double)requestId adUnitId
                  : (NSString *)adUnitId requestOptions
                  : (NSDictionary *)requestOptions) {
  int requestIdInt = (int)requestId;
  NSNumber *generation = [self beginLoadGenerationForRequestId:requestIdInt];
  GAMRequest *request = [RNGoogleMobileAdsCommon buildAdRequest:requestOptions];

  __weak __typeof(self) weakSelf = self;
  [GADPictureInPictureAd
      loadWithAdUnitID:adUnitId
               request:request
     completionHandler:^(GADPictureInPictureAd *_Nullable ad, NSError *_Nullable error) {
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
             dictionaryFromResponseInfo:[RNGoogleMobileAdsResponseInfo responseInfoFromLoadError:error]
                                compact:NO];
         if (responseInfo != nil) {
           codeAndMessage[@"responseInfo"] = responseInfo;
         }
         [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_PICTURE_IN_PICTURE
                                    requestId:@(requestIdInt)
                                         type:GOOGLE_MOBILE_ADS_EVENT_ERROR
                                     adUnitId:adUnitId
                                        error:codeAndMessage
                                         data:nil];
         return;
       }

       RNGoogleMobileAdsPictureInPictureDelegate *delegate =
           [[RNGoogleMobileAdsPictureInPictureDelegate alloc] init];
       delegate.requestId = requestIdInt;
       delegate.adUnitId = adUnitId;
       ad.delegate = delegate;

       GADResponseInfo *gadResponseInfo = ad.responseInfo;
       GADPaidEventHandler paidEventHandler = ^(GADAdValue *value) {
         [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_PICTURE_IN_PICTURE
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
       NSDictionary *responseInfo =
           [RNGoogleMobileAdsResponseInfo dictionaryFromResponseInfo:gadResponseInfo compact:NO];
       if (responseInfo != nil) {
         data[@"responseInfo"] = responseInfo;
       }

       strongSelf.adMap[@(requestIdInt)] = ad;
       strongSelf.delegateMap[@(requestIdInt)] = delegate;

       [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_PICTURE_IN_PICTURE
                                  requestId:@(requestIdInt)
                                       type:GOOGLE_MOBILE_ADS_EVENT_LOADED
                                   adUnitId:adUnitId
                                      error:nil
                                       data:data.count > 0 ? data : nil];
     }];
}

RCT_EXPORT_METHOD(pictureInPictureShow
                  : (double)requestId adUnitId
                  : (NSString *)adUnitId showOptions
                  : (NSDictionary *)showOptions resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject) {
  int requestIdInt = (int)requestId;
  GADPictureInPictureAd *ad = _adMap[@(requestIdInt)];
  if (!ad) {
    [RNSharedUtils rejectPromiseWithUserInfo:reject
                                    userInfo:@{
                                      @"code" : @"not-ready",
                                      @"message" : @"Ad attempted to show but was not ready."
                                    }];
    return;
  }

  GADPictureInPictureAdOptions *options = [[GADPictureInPictureAdOptions alloc] init];
  if (showOptions[@"position"] != nil) {
    options.position = [self positionFromString:showOptions[@"position"]];
  }
  if (showOptions[@"presentationScope"] != nil) {
    options.presentationScope = [self presentationScopeFromString:showOptions[@"presentationScope"]];
  }

  @try {
    [ad showWithOptions:options];
    resolve(nil);
  } @catch (NSException *exception) {
    [RNSharedUtils rejectPromiseWithUserInfo:reject
                                    userInfo:@{
                                      @"code" : @"show-failed",
                                      @"message" : exception.reason ?: @"show-failed"
                                    }];
  }
}

RCT_EXPORT_METHOD(pictureInPictureHide : (double)requestId) {
  GADPictureInPictureAd *ad = _adMap[@((int)requestId)];
  [ad hide];
}

RCT_EXPORT_METHOD(pictureInPictureDestroy : (double)requestId) {
  int requestIdInt = (int)requestId;
  NSNumber *key = @(requestIdInt);
  NSInteger next = [_generationMap[key] integerValue] + 1;
  _generationMap[key] = @(next);
  GADPictureInPictureAd *ad = _adMap[key];
  [ad hide];
  [_adMap removeObjectForKey:key];
  [_delegateMap removeObjectForKey:key];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativePictureInPictureModuleSpecJSI>(params);
}
#endif

@end

#endif