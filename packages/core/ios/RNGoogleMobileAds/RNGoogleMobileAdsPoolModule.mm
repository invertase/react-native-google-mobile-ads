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

#import "RNGoogleMobileAdsPoolModule.h"

#import <GoogleMobileAds/GADAppOpenAdPreloader_Beta.h>
#import <GoogleMobileAds/GADInterstitialAdPreloader_Beta.h>
#import <GoogleMobileAds/GADPreloadConfigurationV2_Beta.h>
#import <GoogleMobileAds/GADPreloadDelegate_Beta.h>
#import <GoogleMobileAds/GADRewardedAdPreloader_Beta.h>
#import <GoogleMobileAds/GADRewardedInterstitialAdPreloader_Beta.h>
#import <GoogleMobileAds/GoogleMobileAds.h>
#import <React/RCTBridge.h>
#import <React/RCTUtils.h>

#import "RNGoogleMobileAdsAppOpenModule.h"
#import "RNGoogleMobileAdsCommon.h"
#import "RNGoogleMobileAdsFullScreenAd.h"
#import "RNGoogleMobileAdsInterstitialModule.h"
#import "RNGoogleMobileAdsPoolGeneration.h"
#import "RNGoogleMobileAdsResponseInfo.h"
#import "RNGoogleMobileAdsRewardedInterstitialModule.h"
#import "RNGoogleMobileAdsRewardedModule.h"
#import "RNSharedUtils.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNGoogleMobileAdsSpec/RNGoogleMobileAdsSpec.h>
#endif

@interface RNGoogleMobileAdsPoolDelegate : NSObject <GADPreloadDelegate>
@property(nonatomic, copy) NSString *poolId;
@property(nonatomic, strong) NSNumber *generation;
@property(nonatomic, copy) BOOL (^isCurrent)(void);
@end

@implementation RNGoogleMobileAdsPoolDelegate
- (void)adAvailableForPreloadID:(NSString *)preloadID responseInfo:(GADResponseInfo *)responseInfo {
  if (!self.isCurrent()) {
    return;
  }
  NSMutableDictionary *data = [NSMutableDictionary dictionary];
  data[@"generation"] = self.generation;
  if (responseInfo.responseIdentifier.length > 0) {
    data[@"responseId"] = responseInfo.responseIdentifier;
  }
  [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_POOL
                             requestId:@0
                                  type:@"available"
                              adUnitId:self.poolId
                                 error:nil
                                  data:data.count > 0 ? data : nil];
}

- (void)adsExhaustedForPreloadID:(NSString *)preloadID {
  if (!self.isCurrent()) {
    return;
  }
  [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_POOL
                             requestId:@0
                                  type:@"exhausted"
                              adUnitId:self.poolId
                                 error:nil
                                  data:@{@"generation" : self.generation}];
}

- (void)adFailedToPreloadForPreloadID:(NSString *)preloadID error:(NSError *)error {
  if (!self.isCurrent()) {
    return;
  }
  NSDictionary *payload = [RNGoogleMobileAdsCommon adErrorPayloadFromAdError:error phase:@"load"];
  [RNGoogleMobileAdsCommon sendAdEvent:GOOGLE_MOBILE_ADS_EVENT_POOL
                             requestId:@0
                                  type:@"error"
                              adUnitId:self.poolId
                                 error:payload
                                  data:@{@"generation" : self.generation}];
}
@end

@interface RNGoogleMobileAdsPoolModule () <RCTBridgeModule>
@property(nonatomic, weak) RCTBridge *bridge;
@property(nonatomic, strong)
    NSMutableDictionary<NSString *, RNGoogleMobileAdsPoolDelegate *> *delegates;
@property(nonatomic, strong) RNGoogleMobileAdsPoolGeneration *ownership;
@end

@implementation RNGoogleMobileAdsPoolModule

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
  return std::make_shared<facebook::react::NativeGoogleMobileAdsPoolModuleSpecJSI>(params);
}
#endif

- (instancetype)init {
  if (self = [super init]) {
    _delegates = [NSMutableDictionary new];
    _ownership = [RNGoogleMobileAdsPoolGeneration new];
  }
  return self;
}

- (NSString *)delegateKeyForFormat:(NSString *)format preloadId:(NSString *)preloadId {
  return [NSString stringWithFormat:@"%@::%@", format, preloadId];
}

- (BOOL)isGeneration:(NSNumber *)generation currentForKey:(NSString *)key {
  return [self.ownership allowsOperationForKey:key generation:generation] &&
         [self.delegates[key].generation isEqualToNumber:generation];
}

- (void)stopPreloaderForPreloadId:(NSString *)preloadId format:(NSString *)format {
  if ([format isEqualToString:@"appOpen"]) {
    [[GADAppOpenAdPreloader sharedInstance] stopPreloadingAndRemoveAdsForPreloadID:preloadId];
  } else if ([format isEqualToString:@"interstitial"]) {
    [[GADInterstitialAdPreloader sharedInstance] stopPreloadingAndRemoveAdsForPreloadID:preloadId];
  } else if ([format isEqualToString:@"rewarded"]) {
    [[GADRewardedAdPreloader sharedInstance] stopPreloadingAndRemoveAdsForPreloadID:preloadId];
  } else if ([format isEqualToString:@"rewardedInterstitial"]) {
    [[GADRewardedInterstitialAdPreloader sharedInstance]
        stopPreloadingAndRemoveAdsForPreloadID:preloadId];
  }
}

- (GADPreloadConfigurationV2 *)configurationForAdUnitId:(NSString *)adUnitId
                                             bufferSize:(double)bufferSize
                                         requestOptions:(NSDictionary *)requestOptions {
  GAMRequest *request = [RNGoogleMobileAdsCommon buildAdRequest:requestOptions ?: @{}];
  GADPreloadConfigurationV2 *configuration =
      [[GADPreloadConfigurationV2 alloc] initWithAdUnitID:adUnitId request:request];
  if (bufferSize >= 1) {
    configuration.bufferSize = (NSUInteger)bufferSize;
  }
  return configuration;
}

RCT_EXPORT_METHOD(poolStart
                  : (NSString *)preloadId format
                  : (NSString *)format generation
                  : (double)generation adUnitId
                  : (NSString *)adUnitId bufferSize
                  : (double)bufferSize requestOptions
                  : (NSDictionary *)requestOptions resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject) {
  BOOL supported =
      [format isEqualToString:@"appOpen"] || [format isEqualToString:@"interstitial"] ||
      [format isEqualToString:@"rewarded"] || [format isEqualToString:@"rewardedInterstitial"];
  if (!supported) {
    [RNSharedUtils
        rejectPromiseWithUserInfo:reject
                         userInfo:@{
                           @"code" : @"pool/format-preload-unsupported",
                           @"message" : [NSString stringWithFormat:@"Format '%@' is not supported "
                                                                   @"for iOS preload",
                                                                   format]
                         }];
    return;
  }

  NSString *key = [self delegateKeyForFormat:format preloadId:preloadId];
  NSNumber *generationNumber = @((NSInteger)generation);
  @try {
    if (![self.ownership claimStartForKey:key generation:generationNumber]) {
      resolve(@{
        @"started" : @NO,
        @"effectiveBufferSize" : @((NSInteger)MAX(bufferSize, 1)),
      });
      return;
    }
    [self stopPreloaderForPreloadId:preloadId format:format];

    GADPreloadConfigurationV2 *configuration = [self configurationForAdUnitId:adUnitId
                                                                   bufferSize:bufferSize
                                                               requestOptions:requestOptions];
    RNGoogleMobileAdsPoolDelegate *delegate = [RNGoogleMobileAdsPoolDelegate new];
    delegate.poolId = preloadId;
    delegate.generation = generationNumber;
    __weak RNGoogleMobileAdsPoolModule *weakSelf = self;
    delegate.isCurrent = ^BOOL {
      return [weakSelf isGeneration:generationNumber currentForKey:key];
    };
    self.delegates[key] = delegate;

    BOOL started = NO;
    if ([format isEqualToString:@"appOpen"]) {
      started = [[GADAppOpenAdPreloader sharedInstance] preloadForPreloadID:preloadId
                                                              configuration:configuration
                                                                   delegate:delegate];
    } else if ([format isEqualToString:@"interstitial"]) {
      started = [[GADInterstitialAdPreloader sharedInstance] preloadForPreloadID:preloadId
                                                                   configuration:configuration
                                                                        delegate:delegate];
    } else if ([format isEqualToString:@"rewarded"]) {
      started = [[GADRewardedAdPreloader sharedInstance] preloadForPreloadID:preloadId
                                                               configuration:configuration
                                                                    delegate:delegate];
    } else if ([format isEqualToString:@"rewardedInterstitial"]) {
      started =
          [[GADRewardedInterstitialAdPreloader sharedInstance] preloadForPreloadID:preloadId
                                                                     configuration:configuration
                                                                          delegate:delegate];
    }
    if (!started) {
      [self.ownership releaseDestroyForKey:key generation:generationNumber];
      [self.delegates removeObjectForKey:key];
      [self stopPreloaderForPreloadId:preloadId format:format];
    }

    resolve(@{
      @"started" : @(started),
      @"effectiveBufferSize" : @((NSInteger)MAX(bufferSize, 1)),
    });
  } @catch (NSException *exception) {
    [self.ownership releaseDestroyForKey:key generation:generationNumber];
    [self.delegates removeObjectForKey:key];
    [self stopPreloaderForPreloadId:preloadId format:format];
    [RNSharedUtils rejectPromiseWithUserInfo:reject
                                    userInfo:@{
                                      @"code" : @"internal-error",
                                      @"message" : exception.reason ?: @"poolStart failed"
                                    }];
  }
}

RCT_EXPORT_METHOD(poolGetAvailability
                  : (NSString *)preloadId format
                  : (NSString *)format generation
                  : (double)generation resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject) {
  NSString *key = [self delegateKeyForFormat:format preloadId:preloadId];
  if (![self isGeneration:@((NSInteger)generation) currentForKey:key]) {
    resolve(@{@"available" : @NO, @"observedCount" : @0});
    return;
  }
  NSUInteger count = 0;
  if ([format isEqualToString:@"appOpen"]) {
    count = [[GADAppOpenAdPreloader sharedInstance] numberOfAdsAvailableWithPreloadID:preloadId];
  } else if ([format isEqualToString:@"interstitial"]) {
    count =
        [[GADInterstitialAdPreloader sharedInstance] numberOfAdsAvailableWithPreloadID:preloadId];
  } else if ([format isEqualToString:@"rewarded"]) {
    count = [[GADRewardedAdPreloader sharedInstance] numberOfAdsAvailableWithPreloadID:preloadId];
  } else if ([format isEqualToString:@"rewardedInterstitial"]) {
    count = [[GADRewardedInterstitialAdPreloader sharedInstance]
        numberOfAdsAvailableWithPreloadID:preloadId];
  }
  resolve(@{
    @"available" : @(count > 0),
    @"observedCount" : @(count),
  });
}

RCT_EXPORT_METHOD(poolPeekResponseInfo
                  : (NSString *)preloadId format
                  : (NSString *)format generation
                  : (double)generation resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject) {
  NSString *key = [self delegateKeyForFormat:format preloadId:preloadId];
  if (![self isGeneration:@((NSInteger)generation) currentForKey:key]) {
    resolve([NSNull null]);
    return;
  }
  GADResponseInfo *info = nil;
  if ([format isEqualToString:@"appOpen"]) {
    info = [[GADAppOpenAdPreloader sharedInstance] adResponseInfoWithPreloadID:preloadId];
  } else if ([format isEqualToString:@"interstitial"]) {
    info = [[GADInterstitialAdPreloader sharedInstance] adResponseInfoWithPreloadID:preloadId];
  } else if ([format isEqualToString:@"rewarded"]) {
    info = [[GADRewardedAdPreloader sharedInstance] adResponseInfoWithPreloadID:preloadId];
  } else if ([format isEqualToString:@"rewardedInterstitial"]) {
    info =
        [[GADRewardedInterstitialAdPreloader sharedInstance] adResponseInfoWithPreloadID:preloadId];
  }
  if (info == nil) {
    resolve([NSNull null]);
    return;
  }
  NSDictionary *dict = [RNGoogleMobileAdsResponseInfo dictionaryFromResponseInfo:info compact:NO];
  resolve(dict ?: [NSNull null]);
}

- (RNGoogleMobileAdsFullScreenAd *)fullscreenHelperForFormat:(NSString *)format {
  // Each format module owns a helper instance; reach it through the bridge.
  id module = nil;
  if ([format isEqualToString:@"appOpen"]) {
    module = [self.bridge moduleForClass: [RNGoogleMobileAdsAppOpenModule class]];
  } else if ([format isEqualToString:@"interstitial"]) {
    module = [self.bridge moduleForClass: [RNGoogleMobileAdsInterstitialModule class]];
  } else if ([format isEqualToString:@"rewarded"]) {
    module = [self.bridge moduleForClass: [RNGoogleMobileAdsRewardedModule class]];
  } else if ([format isEqualToString:@"rewardedInterstitial"]) {
    module = [self.bridge moduleForClass: [RNGoogleMobileAdsRewardedInterstitialModule class]];
  }
  if ([module respondsToSelector:@selector(fullscreenAdHelper)]) {
    return [module fullscreenAdHelper];
  }
  return nil;
}

RCT_EXPORT_METHOD(poolPoll
                  : (NSString *)preloadId format
                  : (NSString *)format generation
                  : (double)generation requestId
                  : (double)requestId adUnitId
                  : (NSString *)adUnitId resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject) {
  NSString *key = [self delegateKeyForFormat:format preloadId:preloadId];
  if (![self isGeneration:@((NSInteger)generation) currentForKey:key]) {
    resolve(@{@"filled" : @NO});
    return;
  }
  id<GADFullScreenPresentingAd> ad = nil;
  GADResponseInfo *responseInfo = nil;

  if ([format isEqualToString:@"appOpen"]) {
    GADAppOpenAd *polled = [[GADAppOpenAdPreloader sharedInstance] adWithPreloadID:preloadId];
    ad = polled;
    responseInfo = polled.responseInfo;
  } else if ([format isEqualToString:@"interstitial"]) {
    GADInterstitialAd *polled =
        [[GADInterstitialAdPreloader sharedInstance] adWithPreloadID:preloadId];
    ad = polled;
    responseInfo = polled.responseInfo;
  } else if ([format isEqualToString:@"rewarded"]) {
    GADRewardedAd *polled = [[GADRewardedAdPreloader sharedInstance] adWithPreloadID:preloadId];
    ad = polled;
    responseInfo = polled.responseInfo;
  } else if ([format isEqualToString:@"rewardedInterstitial"]) {
    GADRewardedInterstitialAd *polled =
        [[GADRewardedInterstitialAdPreloader sharedInstance] adWithPreloadID:preloadId];
    ad = polled;
    responseInfo = polled.responseInfo;
  }

  if (ad == nil) {
    resolve(@{@"filled" : @NO});
    return;
  }

  RNGoogleMobileAdsFullScreenAd *helper = [self fullscreenHelperForFormat:format];
  if (helper == nil) {
    [RNSharedUtils rejectPromiseWithUserInfo:reject
                                    userInfo:@{
                                      @"code" : @"internal-error",
                                      @"message" : @"Fullscreen helper unavailable for pool poll"
                                    }];
    return;
  }

  [helper adoptAd:ad requestId:(int)requestId adUnitId:adUnitId];

  NSMutableDictionary *result = [NSMutableDictionary dictionary];
  result[@"filled"] = @YES;
  result[@"requestId"] = @((NSInteger)requestId);
  if (responseInfo.responseIdentifier.length > 0) {
    result[@"responseId"] = responseInfo.responseIdentifier;
  }
  NSDictionary *infoDict = [RNGoogleMobileAdsResponseInfo dictionaryFromResponseInfo:responseInfo
                                                                             compact:NO];
  if (infoDict != nil) {
    result[@"responseInfo"] = infoDict;
  }
  resolve(result);
}

RCT_EXPORT_METHOD(poolDestroy
                  : (NSString *)preloadId format
                  : (NSString *)format generation
                  : (double)generation) {
  NSString *key = [self delegateKeyForFormat:format preloadId:preloadId];
  if (![self isGeneration:@((NSInteger)generation) currentForKey:key]) {
    return;
  }
  if (![self.ownership releaseDestroyForKey:key generation:@((NSInteger)generation)]) {
    return;
  }
  [self.delegates removeObjectForKey:key];
  [self stopPreloaderForPreloadId:preloadId format:format];
}

@end

#endif
