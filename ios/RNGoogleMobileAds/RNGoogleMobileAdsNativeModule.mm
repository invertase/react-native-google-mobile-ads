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

@implementation RNGoogleMobileAdsNativeModule {
  int _requestCount;
  NSMutableDictionary<NSNumber *, id> *_loaders;
  NSMutableDictionary<NSNumber *, id> *_delegates;
  NSMutableDictionary<NSString *, GADNativeAd *> *_loadedAds;
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
    _requestCount = 0;
    _loaders = [NSMutableDictionary dictionary];
    _delegates = [NSMutableDictionary dictionary];
    _loadedAds = [NSMutableDictionary dictionary];
  }
  return self;
}

- (void)load:(NSString *)adUnitId
requestOptions:(NSDictionary *)requestOptions
     resolve:(RCTPromiseResolveBlock)resolve
      reject:(RCTPromiseRejectBlock)reject {
  GADNativeAdImageAdLoaderOptions *imageOptions = [[GADNativeAdImageAdLoaderOptions alloc] init];
  imageOptions.disableImageLoading = YES;
  GADAdLoader *adLoader = [[GADAdLoader alloc]
                           initWithAdUnitID:adUnitId
                           rootViewController:[RNGoogleMobileAdsCommon currentViewController]
                           adTypes:@[GADAdLoaderAdTypeNative]
                           options:@[imageOptions]];
  NSNumber *requestId = @(_requestCount);
  RNGoogleMobileAdsNativeLoadDelegate *delegate = [[RNGoogleMobileAdsNativeLoadDelegate alloc] initWithCompletionHandler:^(GADNativeAd *nativeAd, NSError *error) {
    [_loaders removeObjectForKey:requestId];
    [_delegates removeObjectForKey:requestId];
    
    if (error != nil) {
      reject(@"ERROR_LOAD", error.description, error);
      return;
    }
    
    NSString *responseId = nativeAd.responseInfo.responseIdentifier;
    [_loadedAds setValue:nativeAd forKey:responseId];
    
    resolve(@{
      @"responseId": responseId,
      @"advertiser": nativeAd.advertiser ?: [NSNull null],
      @"body": nativeAd.body ?: [NSNull null],
      @"callToAction": nativeAd.callToAction ?: [NSNull null],
      @"headline": nativeAd.headline ?: [NSNull null],
      @"price": nativeAd.price ?: [NSNull null],
      @"store": nativeAd.store ?: [NSNull null],
      @"starRating": nativeAd.starRating ?: [NSNull null],
      @"icon": nativeAd.icon != nil ? @{
        @"scale": @(nativeAd.icon.scale),
        @"url": nativeAd.icon.imageURL.absoluteString
      } : [NSNull null]
    });
  }];
  [_loaders setObject:adLoader forKey:requestId];
  [_delegates setObject:delegate forKey:requestId];
  adLoader.delegate = delegate;
  [adLoader loadRequest:[RNGoogleMobileAdsCommon buildAdRequest:requestOptions]];
}

- (GADNativeAd *)nativeAdForResponseId:(NSString *)responseId {
  return [_loadedAds valueForKey:responseId];
}

@end

@implementation RNGoogleMobileAdsNativeLoadDelegate {
  RNGoogleMobileAdsNativeLoadCompletionHandler _completionHandler;
}

- (instancetype)initWithCompletionHandler:(RNGoogleMobileAdsNativeLoadCompletionHandler)completionHandler
{
  if (self = [super init]) {
    _completionHandler = completionHandler;
  }
  return self;
}

- (void)adLoader:(nonnull GADAdLoader *)adLoader didReceiveNativeAd:(nonnull GADNativeAd *)nativeAd {
  _completionHandler(nativeAd, nil);
}

- (void)adLoader:(nonnull GADAdLoader *)adLoader
didFailToReceiveAdWithError:(nonnull NSError *)error {
  _completionHandler(nil, error);
}

@end

#endif
