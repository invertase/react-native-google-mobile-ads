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

#import "RNGoogleMobileAdsNativeModule.h"
#import "RNGoogleMobileAdsCommon.h"
#import "RNGoogleMobileAdsNativeAdRegistry.h"
#import "RNGoogleMobileAdsResponseInfo.h"
#import "RNSharedUtils.h"

typedef void (^RNGMANativeAdLoadCompletionHandler)(GADNativeAd *_Nullable nativeAd,
                                                   NSError *_Nullable error);

@interface RNGMANativeAdHolder
    : NSObject <GADNativeAdLoaderDelegate, GADNativeAdDelegate, GADVideoControllerDelegate>

@property(strong, nullable) GADNativeAd *nativeAd;

- (instancetype)initWithNativeModule:(RNGoogleMobileAdsNativeModule *)nativeModule
                            adUnitId:(NSString *)adUnitId
                      requestOptions:(NSDictionary *)requestOptions;

- (void)loadWithCompletionHandler:(RNGMANativeAdLoadCompletionHandler)completionHandler;

- (void)dispose;

@end

@implementation RNGoogleMobileAdsNativeModule {
  NSMutableDictionary<NSString *, RNGMANativeAdHolder *> *_adHolders;
}

RCT_EXPORT_MODULE();

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeGoogleMobileAdsNativeModuleSpecJSI>(params);
}
#else
- (NSArray<NSString *> *)supportedEvents {
  return @[ @"RNGMANativeAdEvent" ];
}
#endif

- (instancetype)init {
  if (self = [super init]) {
    _adHolders = [NSMutableDictionary dictionary];
  }
  return self;
}

RCT_EXPORT_METHOD(load
                  : (NSString *)adUnitId requestOptions
                  : (NSDictionary *)requestOptions resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject {
                    RNGMANativeAdHolder *adHolder =
                        [[RNGMANativeAdHolder alloc] initWithNativeModule:self
                                                                 adUnitId:adUnitId
                                                           requestOptions:requestOptions];

                    [adHolder loadWithCompletionHandler:^(GADNativeAd *nativeAd, NSError *error) {
                      if (error != nil) {
                        // Keep legacy `ERROR_LOAD` as `code` (additive-only); put detail in
                        // `reason`.
                        NSMutableDictionary *userInfo =
                            [RNGoogleMobileAdsCommon adErrorPayloadFromAdError:error phase:@"load"];
                        NSString *reason = userInfo[@"reason"] ?: @"unknown";
                        userInfo[@"code"] = @"ERROR_LOAD";
                        userInfo[@"reason"] = reason;
                        userInfo[@"message"] = error.description ?: userInfo[@"message"] ?: @"";
                        NSDictionary *responseInfo = [RNGoogleMobileAdsResponseInfo
                            dictionaryFromResponseInfo:[RNGoogleMobileAdsResponseInfo
                                                           responseInfoFromLoadError:error]
                                               compact:NO];
                        if (responseInfo != nil) {
                          userInfo[@"responseInfo"] = responseInfo;
                        }
                        [RNSharedUtils rejectPromiseWithUserInfo:reject userInfo:userInfo];
                        return;
                      }

                      NSString *responseId = nativeAd.responseInfo.responseIdentifier;
                      if (responseId == nil) {
                        // Build via NSMutableDictionary — multi-entry @{…} inside RCT_EXPORT_METHOD
                        // is a preprocessor footgun (commas become extra macro args).
                        NSMutableDictionary *userInfo = [NSMutableDictionary dictionary];
                        userInfo[@"code"] = @"ERROR_LOAD";
                        userInfo[@"message"] =
                            @"Failed to get a valid response ID from the loaded ad.";
                        userInfo[@"reason"] = @"unknown";
                        userInfo[@"phase"] = @"load";
                        [RNSharedUtils rejectPromiseWithUserInfo:reject userInfo:userInfo];
                        return;
                      }

                      [_adHolders setValue:adHolder forKey:responseId];
                      [RNGoogleMobileAdsNativeAdRegistry setNativeAd:nativeAd
                                                       forResponseId:responseId];

                      NSDictionary *responseInfo = [RNGoogleMobileAdsResponseInfo
                          dictionaryFromResponseInfo:nativeAd.responseInfo
                                             compact:NO];
                      // NSMutableDictionary avoids @{…} commas inside RCT_EXPORT_METHOD.
                      NSMutableDictionary *payload = [NSMutableDictionary dictionary];
                      payload[@"responseId"] = responseId;
                      payload[@"advertiser"] = nativeAd.advertiser ?: [NSNull null];
                      payload[@"body"] = nativeAd.body ?: [NSNull null];
                      payload[@"callToAction"] = nativeAd.callToAction ?: [NSNull null];
                      payload[@"headline"] = nativeAd.headline ?: [NSNull null];
                      payload[@"price"] = nativeAd.price ?: [NSNull null];
                      payload[@"store"] = nativeAd.store ?: [NSNull null];
                      payload[@"starRating"] = nativeAd.starRating ?: [NSNull null];
                      if (nativeAd.icon && nativeAd.icon.imageURL != nil) {
                        NSMutableDictionary *icon = [NSMutableDictionary dictionary];
                        icon[@"scale"] = @(nativeAd.icon.scale);
                        icon[@"url"] = nativeAd.icon.imageURL.absoluteString;
                        payload[@"icon"] = icon;
                      } else {
                        payload[@"icon"] = [NSNull null];
                      }
                      NSMutableDictionary *mediaContent = [NSMutableDictionary dictionary];
                      mediaContent[@"aspectRatio"] = @(nativeAd.mediaContent.aspectRatio);
                      mediaContent[@"hasVideoContent"] = @(nativeAd.mediaContent.hasVideoContent);
                      mediaContent[@"duration"] = @(nativeAd.mediaContent.duration);
                      payload[@"mediaContent"] = mediaContent;
                      payload[@"responseInfo"] = responseInfo ?: [NSNull null];
                      resolve(payload);
                    }];
                  })

RCT_EXPORT_METHOD(destroy
                  : (NSString *)responseId {
                    if (responseId.length > 0) {
                      [[_adHolders objectForKey:responseId] dispose];
                      [_adHolders removeObjectForKey:responseId];
                      [RNGoogleMobileAdsNativeAdRegistry removeNativeAdForResponseId:responseId];
                    }
                  });

- (GADNativeAd *)nativeAdForResponseId:(NSString *)responseId {
  return [RNGoogleMobileAdsNativeAdRegistry nativeAdForResponseId:responseId];
}

- (void)dealloc {
  NSArray *adHolders = [_adHolders allValues];
  for (RNGMANativeAdHolder *adHolder in adHolders) {
    [adHolder dispose];
  }
  for (NSString *responseId in [_adHolders allKeys]) {
    [RNGoogleMobileAdsNativeAdRegistry removeNativeAdForResponseId:responseId];
  }
  [_adHolders removeAllObjects];
}

@end

#pragma mark - RNGMANativeAdHolder

@implementation RNGMANativeAdHolder {
  __weak RNGoogleMobileAdsNativeModule *_nativeModule;
  GADAdLoader *_adLoader;
  GAMRequest *_adRequest;
  RNGMANativeAdLoadCompletionHandler _completionHandler;
}

- (instancetype)initWithNativeModule:(RNGoogleMobileAdsNativeModule *)nativeModule
                            adUnitId:(NSString *)adUnitId
                      requestOptions:(NSDictionary *_Nonnull)requestOptions {
  if (self = [super init]) {
    _nativeModule = nativeModule;

    GADNativeAdImageAdLoaderOptions *imageOptions = [[GADNativeAdImageAdLoaderOptions alloc] init];
    //    imageOptions.disableImageLoading = YES;
    GADNativeAdMediaAdLoaderOptions *mediaOptions = [[GADNativeAdMediaAdLoaderOptions alloc] init];
    if (requestOptions[@"aspectRatio"]) {
      switch ([requestOptions[@"aspectRatio"] intValue]) {
        case 1:
          mediaOptions.mediaAspectRatio = GADMediaAspectRatioAny;
          break;
        case 2:
          mediaOptions.mediaAspectRatio = GADMediaAspectRatioLandscape;
          break;
        case 3:
          mediaOptions.mediaAspectRatio = GADMediaAspectRatioPortrait;
          break;
        case 4:
          mediaOptions.mediaAspectRatio = GADMediaAspectRatioSquare;
          break;
      }
    }
    GADNativeAdViewAdOptions *adViewOptions = [[GADNativeAdViewAdOptions alloc] init];
    if (requestOptions[@"adChoicesPlacement"]) {
      switch ([requestOptions[@"adChoicesPlacement"] intValue]) {
        case 0:
          adViewOptions.preferredAdChoicesPosition = GADAdChoicesPositionTopLeftCorner;
          break;
        case 1:
          adViewOptions.preferredAdChoicesPosition = GADAdChoicesPositionTopRightCorner;
          break;
        case 2:
          adViewOptions.preferredAdChoicesPosition = GADAdChoicesPositionBottomRightCorner;
          break;
        case 3:
          adViewOptions.preferredAdChoicesPosition = GADAdChoicesPositionBottomLeftCorner;
          break;
      }
    }
    GADVideoOptions *videoOptions = [[GADVideoOptions alloc] init];
    if (requestOptions[@"startVideoMuted"]) {
      videoOptions.startMuted = [requestOptions[@"startVideoMuted"] boolValue];
    }

    _adLoader = [[GADAdLoader alloc]
          initWithAdUnitID:adUnitId
        rootViewController:[RNGoogleMobileAdsCommon currentViewController]
                   adTypes:@[ GADAdLoaderAdTypeNative ]
                   options:@[ imageOptions, mediaOptions, adViewOptions, videoOptions ]];
    _adLoader.delegate = self;
    _adRequest = [RNGoogleMobileAdsCommon buildAdRequest:requestOptions];
  }
  return self;
}

- (void)loadWithCompletionHandler:(RNGMANativeAdLoadCompletionHandler)completionHandler {
  _completionHandler = completionHandler;
  [_adLoader loadRequest:_adRequest];
}

- (void)dispose {
  _nativeAd = nil;
  _nativeModule = nil;
  _adLoader = nil;
  _adRequest = nil;
  _completionHandler = nil;
}

#pragma mark - GADNativeAdLoaderDelegate

- (void)adLoader:(nonnull GADAdLoader *)adLoader
    didReceiveNativeAd:(nonnull GADNativeAd *)nativeAd {
  _nativeAd = nativeAd;
  _nativeAd.delegate = self;
  _nativeAd.paidEventHandler = ^(GADAdValue *_Nonnull adValue) {
    NSDictionary *revenueData =
        [RNGoogleMobileAdsResponseInfo paidEventPayloadFromAdValue:adValue
                                                      responseInfo:nativeAd.responseInfo];
    [self emitAdEvent:@"paid" withData:revenueData];
  };
  if (nativeAd.mediaContent.hasVideoContent) {
    nativeAd.mediaContent.videoController.delegate = self;
  }
  _completionHandler(nativeAd, nil);
  _completionHandler = nil;
}

- (void)adLoader:(nonnull GADAdLoader *)adLoader
    didFailToReceiveAdWithError:(nonnull NSError *)error {
  _completionHandler(nil, error);
  _completionHandler = nil;
}

#pragma mark - GADNativeAdDelegate

- (void)nativeAdDidRecordImpression:(GADNativeAd *)nativeAd {
  [self emitAdEvent:@"impression"];
}

- (void)nativeAdDidRecordClick:(GADNativeAd *)nativeAd {
  [self emitAdEvent:@"clicked"];
}

- (void)nativeAdWillPresentScreen:(GADNativeAd *)nativeAd {
  [self emitAdEvent:@"opened"];
}

- (void)nativeAdWillDismissScreen:(GADNativeAd *)nativeAd {
  // Not in use
}

- (void)nativeAdDidDismissScreen:(GADNativeAd *)nativeAd {
  [self emitAdEvent:@"closed"];
}

- (void)nativeAdWillLeaveApplication:(GADNativeAd *)nativeAd {
  // Not in use
}

- (void)videoControllerDidPlayVideo:(nonnull GADVideoController *)videoController {
  [self emitAdEvent:@"video_played"];
}

- (void)videoControllerDidPauseVideo:(nonnull GADVideoController *)videoController {
  [self emitAdEvent:@"video_paused"];
}

- (void)videoControllerDidEndVideoPlayback:(nonnull GADVideoController *)videoController {
  [self emitAdEvent:@"video_ended"];
}

- (void)videoControllerDidMuteVideo:(nonnull GADVideoController *)videoController {
  [self emitAdEvent:@"video_muted"];
}

- (void)videoControllerDidUnmuteVideo:(nonnull GADVideoController *)videoController {
  [self emitAdEvent:@"video_unmuted"];
}

- (void)emitAdEvent:(nonnull NSString *)type withData:(NSDictionary *)data {
  if (_nativeModule == nil || _nativeAd == nil) {
    return;
  }

  NSMutableDictionary *payload = [NSMutableDictionary dictionary];
  if (data != nil) {
    [payload addEntriesFromDictionary:data];
  }

  NSString *responseId = _nativeAd.responseInfo.responseIdentifier;
  payload[@"responseId"] = responseId ?: [NSNull null];
  payload[@"type"] = type;

#ifdef RCT_NEW_ARCH_ENABLED
  [_nativeModule emitOnAdEvent:payload];
#else
  [_nativeModule sendEventWithName:@"RNGMANativeAdEvent" body:payload];
#endif
}

- (void)emitAdEvent:(NSString *)type {
  [self emitAdEvent:type withData:nil];
}

@end

#endif
