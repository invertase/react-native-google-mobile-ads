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

typedef void (^RNGMANativeAdLoadCompletionHandler)(GADNativeAd *_Nullable nativeAd,
                                                   NSError *_Nullable error);

@interface RNGMANativeAdHolder : NSObject <GADNativeAdLoaderDelegate, GADNativeAdDelegate>

@property GADNativeAd *nativeAd;

- (instancetype)initWithAdUnitId:(NSString *)adUnitId requestOptions:(NSDictionary *)requestOptions;

- (void)loadWithCompletionHandler:(RNGMANativeAdLoadCompletionHandler)completionHandler;

@end

@implementation RNGoogleMobileAdsNativeModule {
  NSMutableSet<id> *_requestedAds;
  NSMutableDictionary<NSString *, RNGMANativeAdHolder *> *_loadedAds;
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
    _requestedAds = [NSMutableSet set];
    _loadedAds = [NSMutableDictionary dictionary];
  }
  return self;
}

- (void)load:(NSString *)adUnitId
    requestOptions:(NSDictionary *)requestOptions
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
  RNGMANativeAdHolder *adHolder = [[RNGMANativeAdHolder alloc] initWithAdUnitId:adUnitId
                                                                 requestOptions:requestOptions];
  [_requestedAds addObject:adHolder];

  [adHolder loadWithCompletionHandler:^(GADNativeAd *nativeAd, NSError *error) {
    [_requestedAds removeObject:adHolder];

    if (error != nil) {
      reject(@"ERROR_LOAD", error.description, error);
      return;
    }

    NSString *responseId = nativeAd.responseInfo.responseIdentifier;
    [_loadedAds setValue:adHolder forKey:responseId];

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
      }
    });
  }];
}

- (GADNativeAd *)nativeAdForResponseId:(NSString *)responseId {
  return [_loadedAds valueForKey:responseId].nativeAd;
}

@end

@implementation RNGMANativeAdHolder {
  GADAdLoader *_adLoader;
  GAMRequest *_adRequest;
  RNGMANativeAdLoadCompletionHandler _completionHandler;
}

- (instancetype)initWithAdUnitId:(NSString *)adUnitId
                  requestOptions:(NSDictionary *)requestOptions {
  if (self = [super init]) {
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
    
    _adLoader =
        [[GADAdLoader alloc] initWithAdUnitID:adUnitId
                           rootViewController:[RNGoogleMobileAdsCommon currentViewController]
                                      adTypes:@[ GADAdLoaderAdTypeNative ]
                                      options:@[ imageOptions, mediaOptions ]];
    _adLoader.delegate = self;
    _adRequest = [RNGoogleMobileAdsCommon buildAdRequest:requestOptions];
  }
  return self;
}

- (void)loadWithCompletionHandler:(RNGMANativeAdLoadCompletionHandler)completionHandler {
  _completionHandler = completionHandler;
  [_adLoader loadRequest:_adRequest];
}

- (void)adLoader:(nonnull GADAdLoader *)adLoader
    didReceiveNativeAd:(nonnull GADNativeAd *)nativeAd {
  _nativeAd = nativeAd;
  _completionHandler(nativeAd, nil);
}

- (void)adLoader:(nonnull GADAdLoader *)adLoader
    didFailToReceiveAdWithError:(nonnull NSError *)error {
  _completionHandler(nil, error);
}

@end

#endif
