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
#import <GoogleMobileAds/GAMBannerView.h>
#import "RNGoogleMobileAdsCommon.h"
#import "RNGoogleMobileAdsNativeAdRegistry.h"
#import "RNGoogleMobileAdsResponseInfo.h"
#import "RNSharedUtils.h"

typedef void (^RNGMANativeAdLoadCompletionHandler)(GADNativeAd *_Nullable nativeAd,
                                                   NSError *_Nullable error);

typedef void (^RNGMAMultiFormatLoadCompletionHandler)(GADNativeAd *_Nullable nativeAd,
                                                      GAMBannerView *_Nullable bannerView,
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

@interface RNGMAMultiFormatAdHolder : NSObject <GADNativeAdLoaderDelegate,
                                                GAMBannerAdLoaderDelegate,
                                                GADAdLoaderDelegate,
                                                GADNativeAdDelegate,
                                                GADVideoControllerDelegate>

@property(strong, nullable) GADNativeAd *nativeAd;
@property(strong, nullable) GAMBannerView *bannerView;

- (instancetype)initWithNativeModule:(RNGoogleMobileAdsNativeModule *)nativeModule
                            adUnitId:(NSString *)adUnitId
                      requestOptions:(NSDictionary *)requestOptions;

- (void)loadWithCompletionHandler:(RNGMAMultiFormatLoadCompletionHandler)completionHandler;

- (void)dispose;

/** Nil out bannerView without destroying it (ownership transferred to module registry). */
- (void)relinquishBannerView;

@end

@implementation RNGoogleMobileAdsNativeModule {
  NSMutableDictionary<NSString *, id> *_adHolders;
  NSMutableDictionary<NSString *, NSString *> *_handleIdToResponseId;
}

static NSMutableDictionary<NSString *, GAMBannerView *> *_Nullable RNGMASharedBannerHolders(void) {
  static NSMutableDictionary<NSString *, GAMBannerView *> *holders;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    holders = [NSMutableDictionary dictionary];
  });
  return holders;
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
    _handleIdToResponseId = [NSMutableDictionary dictionary];
  }
  return self;
}

+ (nullable GAMBannerView *)bannerViewForHandleId:(NSString *)handleId {
  if (handleId.length == 0) {
    return nil;
  }
  return RNGMASharedBannerHolders()[handleId];
}

- (nullable GAMBannerView *)bannerViewForHandleId:(NSString *)handleId {
  return [RNGoogleMobileAdsNativeModule bannerViewForHandleId:handleId];
}

- (void)setBannerView:(GAMBannerView *)bannerView forHandleId:(NSString *)handleId {
  if (handleId.length == 0 || bannerView == nil) {
    return;
  }
  RNGMASharedBannerHolders()[handleId] = bannerView;
}

- (void)removeBannerViewForHandleId:(NSString *)handleId {
  if (handleId.length == 0) {
    return;
  }
  GAMBannerView *banner = RNGMASharedBannerHolders()[handleId];
  if (banner != nil) {
    [banner removeFromSuperview];
    [RNGMASharedBannerHolders() removeObjectForKey:handleId];
  }
}

static NSMutableDictionary *RNGMANativeAdPayload(GADNativeAd *nativeAd) {
  NSMutableDictionary *payload = [NSMutableDictionary dictionary];
  NSString *responseId = nativeAd.responseInfo.responseIdentifier;
  payload[@"responseId"] = responseId ?: [NSNull null];
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
  NSDictionary *responseInfo =
      [RNGoogleMobileAdsResponseInfo dictionaryFromResponseInfo:nativeAd.responseInfo compact:NO];
  payload[@"responseInfo"] = responseInfo ?: [NSNull null];
  return payload;
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

                      resolve(RNGMANativeAdPayload(nativeAd));
                    }];
                  })

RCT_EXPORT_METHOD(destroy
                  : (NSString *)responseId {
                    if (responseId.length == 0) {
                      return;
                    }
                    id holder = [_adHolders objectForKey:responseId];
                    if ([holder respondsToSelector:@selector(dispose)]) {
                      [holder dispose];
                    }
                    [_adHolders removeObjectForKey:responseId];
                    [RNGoogleMobileAdsNativeAdRegistry removeNativeAdForResponseId:responseId];

                    NSArray<NSString *> *handleIds =
                        [_handleIdToResponseId allKeysForObject:responseId];
                    for (NSString *handleId in handleIds) {
                      [_handleIdToResponseId removeObjectForKey:handleId];
                    }
                  });

RCT_EXPORT_METHOD(
    loadMultiFormat
    : (NSString *)adUnitId requestOptions
    : (NSDictionary *)requestOptions resolve
    : (RCTPromiseResolveBlock)resolve reject
    : (RCTPromiseRejectBlock)reject {
      NSString *handleId = [[NSUUID UUID] UUIDString];

      NSArray *formats = requestOptions[@"formats"];
      BOOL wantsNative = NO;
      BOOL wantsBanner = NO;
      if ([formats isKindOfClass:[NSArray class]]) {
        for (id format in formats) {
          if (![format isKindOfClass:[NSString class]]) {
            continue;
          }
          if ([format isEqualToString:@"native"]) {
            wantsNative = YES;
          } else if ([format isEqualToString:@"banner"]) {
            wantsBanner = YES;
          }
        }
      }

      if (!wantsNative && !wantsBanner) {
        NSMutableDictionary *payload = [NSMutableDictionary dictionary];
        payload[@"format"] = @"none";
        NSMutableDictionary *err = [NSMutableDictionary dictionary];
        err[@"code"] = @"invalid-request";
        err[@"message"] =
            @"Multi-format load requires formats to include 'native' and/or 'banner'.";
        err[@"reason"] = @"invalid-request";
        err[@"phase"] = @"load";
        payload[@"error"] = err;
        resolve(payload);
        return;
      }

      if (wantsBanner) {
        NSArray *bannerSizes = requestOptions[@"bannerSizes"];
        BOOL hasSize = NO;
        if ([bannerSizes isKindOfClass:[NSArray class]]) {
          for (id sizeValue in bannerSizes) {
            if ([sizeValue isKindOfClass:[NSString class]] && [(NSString *)sizeValue length] > 0) {
              hasSize = YES;
              break;
            }
          }
        }
        if (!hasSize) {
          NSMutableDictionary *payload = [NSMutableDictionary dictionary];
          payload[@"format"] = @"none";
          NSMutableDictionary *err = [NSMutableDictionary dictionary];
          err[@"code"] = @"invalid-request";
          err[@"message"] = @"Multi-format banner load requires a non-empty bannerSizes array.";
          err[@"reason"] = @"invalid-request";
          err[@"phase"] = @"load";
          payload[@"error"] = err;
          resolve(payload);
          return;
        }
      }

      RNGMAMultiFormatAdHolder *adHolder =
          [[RNGMAMultiFormatAdHolder alloc] initWithNativeModule:self
                                                        adUnitId:adUnitId
                                                  requestOptions:requestOptions];

      [adHolder loadWithCompletionHandler:^(GADNativeAd *nativeAd, GAMBannerView *bannerView,
                                            NSError *error) {
        // NSMutableDictionary avoids @{…} commas inside RCT_EXPORT_METHOD.
        NSMutableDictionary *payload = [NSMutableDictionary dictionary];
        payload[@"handleId"] = handleId;

        if (error != nil) {
          payload[@"format"] = @"none";
          NSMutableDictionary *err = [RNGoogleMobileAdsCommon adErrorPayloadFromAdError:error
                                                                                  phase:@"load"];
          NSDictionary *responseInfo = [RNGoogleMobileAdsResponseInfo
              dictionaryFromResponseInfo:[RNGoogleMobileAdsResponseInfo
                                             responseInfoFromLoadError:error]
                                 compact:NO];
          if (responseInfo != nil) {
            err[@"responseInfo"] = responseInfo;
            payload[@"responseInfo"] = responseInfo;
          }
          payload[@"error"] = err;
          [adHolder dispose];
          resolve(payload);
          return;
        }

        if (nativeAd != nil) {
          // Prefer SDK response id; fall back to handleId (matches Android).
          NSString *responseId = nativeAd.responseInfo.responseIdentifier ?: handleId;

          [_adHolders setValue:adHolder forKey:responseId];
          [_handleIdToResponseId setValue:responseId forKey:handleId];
          [RNGoogleMobileAdsNativeAdRegistry setNativeAd:nativeAd forResponseId:responseId];

          NSMutableDictionary *nativePayload = RNGMANativeAdPayload(nativeAd);
          nativePayload[@"responseId"] = responseId;
          [payload addEntriesFromDictionary:nativePayload];
          payload[@"format"] = @"native";
          payload[@"handleId"] = handleId;
          resolve(payload);
          return;
        }

        if (bannerView != nil) {
          [self setBannerView:bannerView forHandleId:handleId];
          [adHolder relinquishBannerView];
          [adHolder dispose];

          CGSize size = CGSizeFromGADAdSize(bannerView.adSize);
          payload[@"format"] = @"banner";
          payload[@"width"] = @(size.width);
          payload[@"height"] = @(size.height);
          NSDictionary *responseInfo =
              [RNGoogleMobileAdsResponseInfo dictionaryFromResponseInfo:bannerView.responseInfo
                                                                compact:NO];
          payload[@"responseInfo"] = responseInfo ?: [NSNull null];
          resolve(payload);
          return;
        }

        payload[@"format"] = @"none";
        [adHolder dispose];
        resolve(payload);
      }];
    })

RCT_EXPORT_METHOD(destroyHandle
                  : (NSString *)handleId {
                    if (handleId.length == 0) {
                      return;
                    }

                    if (RNGMASharedBannerHolders()[handleId] != nil) {
                      [self removeBannerViewForHandleId:handleId];
                      return;
                    }

                    NSString *responseId = _handleIdToResponseId[handleId];
                    if (responseId != nil) {
                      [_handleIdToResponseId removeObjectForKey:handleId];
                      id holder = [_adHolders objectForKey:responseId];
                      if ([holder respondsToSelector:@selector(dispose)]) {
                        [holder dispose];
                      }
                      [_adHolders removeObjectForKey:responseId];
                      [RNGoogleMobileAdsNativeAdRegistry removeNativeAdForResponseId:responseId];
                    }
                  });

- (GADNativeAd *)nativeAdForResponseId:(NSString *)responseId {
  return [RNGoogleMobileAdsNativeAdRegistry nativeAdForResponseId:responseId];
}

- (void)dealloc {
  NSArray *adHolders = [_adHolders allValues];
  for (id adHolder in adHolders) {
    if ([adHolder respondsToSelector:@selector(dispose)]) {
      [adHolder dispose];
    }
  }
  for (NSString *responseId in [_adHolders allKeys]) {
    [RNGoogleMobileAdsNativeAdRegistry removeNativeAdForResponseId:responseId];
  }
  [_adHolders removeAllObjects];
  [_handleIdToResponseId removeAllObjects];

  NSArray<NSString *> *bannerKeys = [RNGMASharedBannerHolders() allKeys];
  for (NSString *handleId in bannerKeys) {
    [self removeBannerViewForHandleId:handleId];
  }
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

#pragma mark - RNGMAMultiFormatAdHolder

@implementation RNGMAMultiFormatAdHolder {
  __weak RNGoogleMobileAdsNativeModule *_nativeModule;
  GADAdLoader *_adLoader;
  GAMRequest *_adRequest;
  NSArray<NSValue *> *_bannerSizes;
  RNGMAMultiFormatLoadCompletionHandler _completionHandler;
  BOOL _settled;
}

- (instancetype)initWithNativeModule:(RNGoogleMobileAdsNativeModule *)nativeModule
                            adUnitId:(NSString *)adUnitId
                      requestOptions:(NSDictionary *_Nonnull)requestOptions {
  if (self = [super init]) {
    _nativeModule = nativeModule;
    _settled = NO;

    NSArray *formats = requestOptions[@"formats"];
    if (![formats isKindOfClass:[NSArray class]]) {
      formats = @[];
    }

    BOOL wantsNative = NO;
    BOOL wantsBanner = NO;
    for (id format in formats) {
      if (![format isKindOfClass:[NSString class]]) {
        continue;
      }
      if ([format isEqualToString:@"native"]) {
        wantsNative = YES;
      } else if ([format isEqualToString:@"banner"]) {
        wantsBanner = YES;
      }
    }
    // Default to native when formats omitted (defensive; JS validates).
    if (!wantsNative && !wantsBanner) {
      wantsNative = YES;
    }

    NSMutableArray<GADAdLoaderAdType> *adTypes = [NSMutableArray array];
    NSMutableArray *options = [NSMutableArray array];

    if (wantsNative) {
      [adTypes addObject:GADAdLoaderAdTypeNative];

      GADNativeAdImageAdLoaderOptions *imageOptions =
          [[GADNativeAdImageAdLoaderOptions alloc] init];
      GADNativeAdMediaAdLoaderOptions *mediaOptions =
          [[GADNativeAdMediaAdLoaderOptions alloc] init];
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
      [options addObject:imageOptions];
      [options addObject:mediaOptions];
      [options addObject:adViewOptions];
      [options addObject:videoOptions];
    }

    if (wantsBanner) {
      [adTypes addObject:GADAdLoaderAdTypeGAMBanner];
      NSMutableArray<NSValue *> *sizes = [NSMutableArray array];
      NSArray *bannerSizes = requestOptions[@"bannerSizes"];
      if ([bannerSizes isKindOfClass:[NSArray class]]) {
        for (id sizeValue in bannerSizes) {
          if (![sizeValue isKindOfClass:[NSString class]]) {
            continue;
          }
          GADAdSize adSize = [RNGoogleMobileAdsCommon stringToAdSize:sizeValue
                                                       withMaxHeight:-1
                                                            andWidth:-1];
          if (!GADAdSizeEqualToSize(adSize, GADAdSizeInvalid)) {
            [sizes addObject:NSValueFromGADAdSize(adSize)];
          }
        }
      }
      _bannerSizes = [sizes copy];
      // Do NOT add GADMultipleAdsAdLoaderOptions (count 1 / mediation-compatible).
    } else {
      _bannerSizes = @[];
    }

    _adLoader =
        [[GADAdLoader alloc] initWithAdUnitID:adUnitId
                           rootViewController:[RNGoogleMobileAdsCommon currentViewController]
                                      adTypes:adTypes
                                      options:options];
    _adLoader.delegate = self;
    _adRequest = [RNGoogleMobileAdsCommon buildAdRequest:requestOptions];
  }
  return self;
}

- (void)loadWithCompletionHandler:(RNGMAMultiFormatLoadCompletionHandler)completionHandler {
  _completionHandler = completionHandler;
  [_adLoader loadRequest:_adRequest];
}

- (void)relinquishBannerView {
  _bannerView = nil;
}

- (void)dispose {
  _nativeAd = nil;
  if (_bannerView != nil) {
    [_bannerView removeFromSuperview];
    _bannerView = nil;
  }
  _nativeModule = nil;
  _adLoader = nil;
  _adRequest = nil;
  _bannerSizes = nil;
  _completionHandler = nil;
}

- (void)settleOnceWithNativeAd:(GADNativeAd *_Nullable)nativeAd
                    bannerView:(GAMBannerView *_Nullable)bannerView
                         error:(NSError *_Nullable)error {
  if (_settled) {
    return;
  }
  _settled = YES;
  RNGMAMultiFormatLoadCompletionHandler handler = _completionHandler;
  _completionHandler = nil;
  if (handler != nil) {
    handler(nativeAd, bannerView, error);
  }
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
  // Count-1: settle here if adLoaderDidFinishLoading: is not delivered.
  [self settleOnceWithNativeAd:_nativeAd bannerView:_bannerView error:nil];
}

#pragma mark - GAMBannerAdLoaderDelegate

- (nonnull NSArray<NSValue *> *)validBannerSizesForAdLoader:(nonnull GADAdLoader *)adLoader {
  return _bannerSizes ?: @[];
}

- (void)adLoader:(nonnull GADAdLoader *)adLoader
    didReceiveGAMBannerView:(nonnull GAMBannerView *)bannerView {
  _bannerView = bannerView;
  // Count-1: settle here if adLoaderDidFinishLoading: is not delivered.
  [self settleOnceWithNativeAd:_nativeAd bannerView:_bannerView error:nil];
}

#pragma mark - GADAdLoaderDelegate

- (void)adLoaderDidFinishLoading:(nonnull GADAdLoader *)adLoader {
  [self settleOnceWithNativeAd:_nativeAd bannerView:_bannerView error:nil];
}

- (void)adLoader:(nonnull GADAdLoader *)adLoader
    didFailToReceiveAdWithError:(nonnull NSError *)error {
  [self settleOnceWithNativeAd:nil bannerView:nil error:error];
}

#pragma mark - GADNativeAdDelegate / video (same as single-format holder)

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
}

- (void)nativeAdDidDismissScreen:(GADNativeAd *)nativeAd {
  [self emitAdEvent:@"closed"];
}

- (void)nativeAdWillLeaveApplication:(GADNativeAd *)nativeAd {
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
