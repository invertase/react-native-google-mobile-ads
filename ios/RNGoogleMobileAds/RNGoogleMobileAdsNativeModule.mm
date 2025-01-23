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
#import "common/RNRCTEventEmitter.h"

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

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeGoogleMobileAdsNativeModuleSpecJSI>(params);
}
#endif

- (instancetype)init {
  if (self = [super init]) {
    _adHolders = [NSMutableDictionary dictionary];
  }
  return self;
}

RCT_EXPORT_METHOD(
    load
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
          reject(@"ERROR_LOAD", error.description, error);
          return;
        }

        NSString *responseId = nativeAd.responseInfo.responseIdentifier;
        [_adHolders setValue:adHolder forKey:responseId];

        resolve(@{
          @"responseId" : responseId,
          @"advertiser" : nativeAd.advertiser ?: [NSNull null],
          @"body" : nativeAd.body ?: [NSNull null],
          @"callToAction" : nativeAd.callToAction ?: [NSNull null],
          @"headline" : nativeAd.headline ?: [NSNull null],
          @"price" : nativeAd.price ?: [NSNull null],
          @"store" : nativeAd.store ?: [NSNull null],
          @"starRating" : nativeAd.starRating ?: [NSNull null],
          @"icon" : nativeAd.icon != nil
              ? @{@"scale" : @(nativeAd.icon.scale), @"url" : nativeAd.icon.imageURL.absoluteString}
              : [NSNull null],
          @"mediaContent" : @{
            @"aspectRatio" : @(nativeAd.mediaContent.aspectRatio),
            @"hasVideoContent" : @(nativeAd.mediaContent.hasVideoContent),
            @"duration" : @(nativeAd.mediaContent.duration)
          }
        });
      }];
    })

RCT_EXPORT_METHOD(destroy
                  : (NSString *)responseId {
                    [[_adHolders valueForKey:responseId] dispose];
                    [_adHolders removeObjectForKey:responseId];
                  });

- (GADNativeAd *)nativeAdForResponseId:(NSString *)responseId {
  return [_adHolders valueForKey:responseId].nativeAd;
}

- (void)dealloc {
  NSArray *adHolders = [_adHolders allValues];
  for (RNGMANativeAdHolder *adHolder in adHolders) {
    [adHolder dispose];
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
                      requestOptions:(NSDictionary *)requestOptions {
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
    if (requestOptions[@"aspectRatio"]) {
      switch ([requestOptions[@"aspectRatio"] intValue]) {
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

- (void)emitAdEvent:(NSString *)type {
  if (_nativeModule == nil || _nativeAd == nil) {
    return;
  }
  NSDictionary *payload =
      @{@"responseId" : _nativeAd.responseInfo.responseIdentifier, @"type" : type};
  [[RNRCTEventEmitter shared] sendEventWithName:@"RNGMANativeAdEvent" body:payload];
}

@end

#endif
