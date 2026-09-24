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
#import <GoogleMobileAds/GoogleMobileAds.h>
#endif
#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>

#import "RNGoogleMobileAdsModule.h"
#import "RNGoogleMobileAdsWebViewRegistration.h"
#ifdef RCT_NEW_ARCH_ENABLED
#import <RNGoogleMobileAdsSpec/RNGoogleMobileAdsSpec.h>
#endif
#import "common/RNSharedUtils.h"

@implementation RNGoogleMobileAdsModule
#pragma mark -
#pragma mark Module Setup

RCT_EXPORT_MODULE();

@synthesize viewRegistry_DEPRECATED = _viewRegistry_DEPRECATED;

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (NSDictionary *)getConstants {
#if TARGET_OS_MACCATALYST
  return @{@"sdkVersion" : @"", @"backend" : @"ios"};
#else
  GADVersionNumber version = GADMobileAds.sharedInstance.versionNumber;
  NSString *sdkVersion =
      [NSString stringWithFormat:@"%ld.%ld.%ld", static_cast<long>(version.majorVersion),
                                 static_cast<long>(version.minorVersion),
                                 static_cast<long>(version.patchVersion)];
  return @{@"sdkVersion" : sdkVersion, @"backend" : @"ios"};
#endif
}

#pragma mark -
#pragma mark Google Mobile Ads Methods

RCT_EXPORT_METHOD(initialize : (RCTPromiseResolveBlock)resolve : (RCTPromiseRejectBlock)reject) {
  [self initialize:resolve reject:reject];
}

RCT_EXPORT_METHOD(setRequestConfiguration : (NSDictionary *)requestConfiguration : (
    RCTPromiseResolveBlock)resolve : (RCTPromiseRejectBlock)reject) {
  [self setRequestConfiguration:requestConfiguration resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(openAdInspector : (RCTPromiseResolveBlock)resolve : (RCTPromiseRejectBlock)
                      reject) {
  [self openAdInspector:resolve reject:reject];
}

RCT_EXPORT_METHOD(openDebugMenu : (NSString *)adUnit) {
#if !TARGET_OS_MACCATALYST
  GADDebugOptionsViewController *debugOptionsViewController =
      [GADDebugOptionsViewController debugOptionsViewControllerWithAdUnitID:adUnit];
  [RCTSharedApplication().delegate.window.rootViewController
      presentViewController:debugOptionsViewController
                   animated:YES
                 completion:nil];
#endif
}

RCT_EXPORT_METHOD(setAppVolume : (double)volume) {
#if !TARGET_OS_MACCATALYST
  GADMobileAds.sharedInstance.applicationVolume = volume;
#endif
}

RCT_EXPORT_METHOD(setAppMuted : (BOOL)muted) {
#if !TARGET_OS_MACCATALYST
  GADMobileAds.sharedInstance.applicationMuted = muted;
#endif
}

RCT_EXPORT_METHOD(registerWebView : (double)viewTag : (RCTPromiseResolveBlock)
                      resolve : (RCTPromiseRejectBlock)reject) {
  [self registerWebView:viewTag resolve:resolve reject:reject];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeGoogleMobileAdsModuleSpecJSI>(params);
}
#endif

- (void)initialize:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if !TARGET_OS_MACCATALYST
  [[GADMobileAds sharedInstance]
      startWithCompletionHandler:^(GADInitializationStatus *_Nonnull status) {
        NSDictionary *adapterStatuses = [status adapterStatusesByClassName];
        NSMutableArray *result = [[NSMutableArray alloc] init];
        for (NSString *adapter in adapterStatuses) {
          GADAdapterStatus *adapterStatus = adapterStatuses[adapter];
          NSDictionary *dict = @{
            @"name" : adapter,
            @"state" : @(adapterStatus.state),
            @"description" : adapterStatus.description
          };
          [result addObject:dict];
        }
        resolve(result);
      }];
#endif
}

- (void)setRequestConfiguration:(NSDictionary *)requestConfiguration
                        resolve:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject {
#if !TARGET_OS_MACCATALYST
  if (requestConfiguration[@"maxAdContentRating"]) {
    NSString *rating = requestConfiguration[@"maxAdContentRating"];
    if ([rating isEqualToString:@"G"]) {
      GADMobileAds.sharedInstance.requestConfiguration.maxAdContentRating =
          GADMaxAdContentRatingGeneral;
    } else if ([rating isEqualToString:@"PG"]) {
      GADMobileAds.sharedInstance.requestConfiguration.maxAdContentRating =
          GADMaxAdContentRatingParentalGuidance;
    } else if ([rating isEqualToString:@"T"]) {
      GADMobileAds.sharedInstance.requestConfiguration.maxAdContentRating =
          GADMaxAdContentRatingTeen;
    } else if ([rating isEqualToString:@"MA"]) {
      GADMobileAds.sharedInstance.requestConfiguration.maxAdContentRating =
          GADMaxAdContentRatingMatureAudience;
    }
  }

  if (requestConfiguration[@"ageRestrictedTreatment"]) {
    NSString *ageRestrictedTreatment = requestConfiguration[@"ageRestrictedTreatment"];
    if ([ageRestrictedTreatment isEqualToString:@"child"]) {
      GADMobileAds.sharedInstance.requestConfiguration.ageRestrictedTreatment =
          GADAgeRestrictedTreatmentChild;
    } else if ([ageRestrictedTreatment isEqualToString:@"teen"]) {
      GADMobileAds.sharedInstance.requestConfiguration.ageRestrictedTreatment =
          GADAgeRestrictedTreatmentTeen;
    } else if ([ageRestrictedTreatment isEqualToString:@"unspecified"]) {
      GADMobileAds.sharedInstance.requestConfiguration.ageRestrictedTreatment =
          GADAgeRestrictedTreatmentUnspecified;
    }
  }

  if (requestConfiguration[@"tagForChildDirectedTreatment"]) {
    BOOL tag = [requestConfiguration[@"tagForChildDirectedTreatment"] boolValue];
    GADMobileAds.sharedInstance.requestConfiguration.tagForChildDirectedTreatment =
        [NSNumber numberWithBool:tag];
  }

  if (requestConfiguration[@"tagForUnderAgeOfConsent"]) {
    BOOL tag = [requestConfiguration[@"tagForUnderAgeOfConsent"] boolValue];
    GADMobileAds.sharedInstance.requestConfiguration.tagForUnderAgeOfConsent =
        [NSNumber numberWithBool:tag];
  }

  if (requestConfiguration[@"testDeviceIdentifiers"]) {
    NSMutableArray *devices = [@[] mutableCopy];
    for (NSString *key in requestConfiguration[@"testDeviceIdentifiers"]) {
      [devices addObject:key];
    }
    GADMobileAds.sharedInstance.requestConfiguration.testDeviceIdentifiers = devices;
  }

  resolve([NSNull null]);
#endif
}

- (void)openAdInspector:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if !TARGET_OS_MACCATALYST
  [GADMobileAds.sharedInstance
      presentAdInspectorFromViewController:RCTSharedApplication().delegate.window.rootViewController
                         completionHandler:^(NSError *_Nullable error) {
                           if (error != nil) {
                             [RNSharedUtils
                                 rejectPromiseWithUserInfo:reject
                                                  userInfo:[@{
                                                    @"code" : [NSString
                                                        stringWithFormat:@"CODE_%ld",
                                                                         static_cast<long>(
                                                                             error.code)],
                                                    @"message" : error.description,
                                                  } mutableCopy]];
                           } else {
                             resolve(nil);
                           }
                         }];
#endif
}

- (void)registerWebView:(double)viewTag
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject {
#if TARGET_OS_MACCATALYST
  reject(@"unsupported", @"registerWebView is not supported on Mac Catalyst.", nil);
#else
  NSNumber *reactTag = @((NSInteger)viewTag);
  RCTViewRegistry *viewRegistry = self.viewRegistry_DEPRECATED;
  if (viewRegistry == nil) {
    [RNSharedUtils
        rejectPromiseWithUserInfo:reject
                         userInfo:[@{
                           @"code" : @"webview-registry-missing",
                           @"message" : @"RCTViewRegistry is unavailable; cannot resolve "
                                        @"the WebView tag.",
                         } mutableCopy]];
    return;
  }
  [viewRegistry addUIBlock:^(RCTViewRegistry *registry) {
    UIView *host = [registry viewForReactTag:reactTag];
    WKWebView *webView = [RNGoogleMobileAdsWebViewRegistration findWebViewInView:host];
    if (webView == nil) {
      [RNSharedUtils
          rejectPromiseWithUserInfo:reject
                           userInfo:[@{
                             @"code" : @"webview-not-found",
                             @"message" : [NSString
                                 stringWithFormat:@"No WKWebView found for view tag %@.", reactTag],
                           } mutableCopy]];
      return;
    }
    [GADMobileAds.sharedInstance registerWebView:webView];
    resolve([NSNull null]);
  }];
#endif
}

@end
