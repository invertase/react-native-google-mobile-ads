//
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

#import <React/RCTUtils.h>

#import <React/RCTConvert.h>
#if !TARGET_OS_MACCATALYST
#include <UserMessagingPlatform/UserMessagingPlatform.h>
#endif
#ifdef RCT_NEW_ARCH_ENABLED
#import "RNGoogleMobileAdsSpec.h"
#endif
#import "RNGoogleMobileAdsConsentModule.h"
#import "common/RNSharedUtils.h"

@implementation RNGoogleMobileAdsConsentModule
#pragma mark -
#pragma mark Module Setup

RCT_EXPORT_MODULE();

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

#pragma mark -
#pragma mark Google Mobile Ads Methods

#if !TARGET_OS_MACCATALYST
- (NSString *)getConsentStatusString:(UMPConsentStatus)consentStatus {
  switch (consentStatus) {
    case UMPConsentStatusRequired:
      return @"REQUIRED";
    case UMPConsentStatusNotRequired:
      return @"NOT_REQUIRED";
    case UMPConsentStatusObtained:
      return @"OBTAINED";
    case UMPConsentStatusUnknown:
    default:
      return @"UNKNOWN";
  }
}
#endif

#if !TARGET_OS_MACCATALYST
- (NSString *)getPrivacyOptionsRequirementStatusString:
    (UMPPrivacyOptionsRequirementStatus)privacyOptionsRequirementStatus {
  switch (privacyOptionsRequirementStatus) {
    case UMPPrivacyOptionsRequirementStatusRequired:
      return @"REQUIRED";
    case UMPPrivacyOptionsRequirementStatusNotRequired:
      return @"NOT_REQUIRED";
    case UMPPrivacyOptionsRequirementStatusUnknown:
    default:
      return @"UNKNOWN";
  }
}
#endif

#if !TARGET_OS_MACCATALYST
- (NSDictionary *)getConsentInformation {
  return @{
    @"status" : [self getConsentStatusString:UMPConsentInformation.sharedInstance.consentStatus],
    @"canRequestAds" : @(UMPConsentInformation.sharedInstance.canRequestAds),
    @"privacyOptionsRequirementStatus" :
        [self getPrivacyOptionsRequirementStatusString:UMPConsentInformation.sharedInstance
                                                           .privacyOptionsRequirementStatus],
    @"isConsentFormAvailable" :
        @(UMPConsentInformation.sharedInstance.formStatus == UMPFormStatusAvailable)
  };
}
#endif

RCT_EXPORT_METHOD(requestInfoUpdate
                  : (NSDictionary *)options
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
#if !TARGET_OS_MACCATALYST
  UMPRequestParameters *parameters = [[UMPRequestParameters alloc] init];
  UMPDebugSettings *debugSettings = [[UMPDebugSettings alloc] init];

  debugSettings.geography =
      (UMPDebugGeography)([options[@"debugGeography"] integerValue] ?: UMPDebugGeographyDisabled);
  debugSettings.testDeviceIdentifiers =
      [options valueForKeyPath:@"testDeviceIdentifiers"] ?: [[NSMutableArray alloc] init];

  parameters.debugSettings = debugSettings;
  parameters.tagForUnderAgeOfConsent = [options[@"tagForUnderAgeOfConsent"] boolValue] ?: FALSE;

  [UMPConsentInformation.sharedInstance
      requestConsentInfoUpdateWithParameters:parameters
                           completionHandler:^(NSError *_Nullable error) {
                             if (error) {
                               [RNSharedUtils
                                   rejectPromiseWithUserInfo:reject
                                                    userInfo:[@{
                                                      @"code" : @"consent-update-failed",
                                                      @"message" : error.localizedDescription,
                                                    } mutableCopy]];
                             } else {
                               resolve([self getConsentInformation]);
                             }
                           }];
#endif
}

RCT_EXPORT_METHOD(showForm : (RCTPromiseResolveBlock)resolve : (RCTPromiseRejectBlock)reject) {
  [self showForm:resolve reject:reject];
}

RCT_EXPORT_METHOD(showPrivacyOptionsForm
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  [self showPrivacyOptionsForm:resolve reject:reject];
}

RCT_EXPORT_METHOD(loadAndShowConsentFormIfRequired
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  [self loadAndShowConsentFormIfRequired:resolve reject:reject];
}

RCT_EXPORT_METHOD(reset) {
#if !TARGET_OS_MACCATALYST
  [UMPConsentInformation.sharedInstance reset];
#endif
}

RCT_EXPORT_METHOD(getConsentInfo
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  [self getConsentInfo:resolve reject:reject];
}

RCT_EXPORT_METHOD(getTCString : (RCTPromiseResolveBlock)resolve : (RCTPromiseRejectBlock)reject) {
  [self getTCString:resolve reject:reject];
}

RCT_EXPORT_METHOD(getGdprApplies
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  [self getGdprApplies:resolve reject:reject];
}

RCT_EXPORT_METHOD(getPurposeConsents
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  [self getPurposeConsents:resolve reject:reject];
}

RCT_EXPORT_METHOD(getPurposeLegitimateInterests
                  : (RCTPromiseResolveBlock)resolve
                  : (RCTPromiseRejectBlock)reject) {
  [self getPurposeLegitimateInterests:resolve reject:reject];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeConsentModuleSpecJSI>(params);
}
#endif

#ifdef RCT_NEW_ARCH_ENABLED
- (void)requestInfoUpdate:(JS::NativeConsentModule::AdsConsentInfoOptions &)options
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject {
#if !TARGET_OS_MACCATALYST
  UMPRequestParameters *parameters = [[UMPRequestParameters alloc] init];
  UMPDebugSettings *debugSettings = [[UMPDebugSettings alloc] init];

  debugSettings.geography =
      static_cast<UMPDebugGeography>(options.debugGeography().value_or(UMPDebugGeographyDisabled));
  debugSettings.testDeviceIdentifiers = options.testDeviceIdentifiers().has_value()
      ? ^{
          NSMutableArray *array = [[NSMutableArray alloc] init];
          FB::LazyVector<NSString *, id> identifiers = options.testDeviceIdentifiers().value();
          for (int i = 0; i < identifiers.size(); i++) {
              [array addObject:identifiers[i]];  // Direct access by index
          }
          return array;
      }()
      : [[NSMutableArray alloc] init];

  parameters.debugSettings = debugSettings;
  parameters.tagForUnderAgeOfConsent = options.tagForUnderAgeOfConsent().value_or(FALSE);

  [UMPConsentInformation.sharedInstance
      requestConsentInfoUpdateWithParameters:parameters
                           completionHandler:^(NSError *_Nullable error) {
                             if (error) {
                               [RNSharedUtils
                                   rejectPromiseWithUserInfo:reject
                                                    userInfo:[@{
                                                      @"code" : @"consent-update-failed",
                                                      @"message" : error.localizedDescription,
                                                    } mutableCopy]];
                             } else {
                               resolve([self getConsentInformation]);
                             }
                           }];
#endif
}
#endif

- (void)showForm:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if !TARGET_OS_MACCATALYST
  [UMPConsentForm loadWithCompletionHandler:^(UMPConsentForm *form, NSError *loadError) {
    if (loadError) {
      [RNSharedUtils rejectPromiseWithUserInfo:reject
                                      userInfo:[@{
                                        @"code" : @"consent-form-error",
                                        @"message" : loadError.localizedDescription,
                                      } mutableCopy]];
    } else {
      [form presentFromViewController:[UIApplication sharedApplication]
                                          .delegate.window.rootViewController
                    completionHandler:^(NSError *_Nullable dismissError) {
                      if (dismissError) {
                        [RNSharedUtils
                            rejectPromiseWithUserInfo:reject
                                             userInfo:[@{
                                               @"code" : @"consent-form-error",
                                               @"message" : dismissError.localizedDescription,
                                             } mutableCopy]];
                      } else {
                        resolve([self getConsentInformation]);
                      }
                    }];
    }
  }];
#endif
}

- (void)showPrivacyOptionsForm:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject {
#if !TARGET_OS_MACCATALYST
  [UMPConsentForm
      presentPrivacyOptionsFormFromViewController:[UIApplication sharedApplication]
                                                      .delegate.window.rootViewController
                                completionHandler:^(NSError *_Nullable formError) {
                                  if (formError) {
                                    [RNSharedUtils
                                        rejectPromiseWithUserInfo:reject
                                                         userInfo:[@{
                                                           @"code" : @"privacy-options-form-error",
                                                           @"message" :
                                                               formError.localizedDescription,
                                                         } mutableCopy]];
                                  } else {
                                    resolve([self getConsentInformation]);
                                  }
                                }];
#endif
}

- (void)loadAndShowConsentFormIfRequired:(RCTPromiseResolveBlock)resolve
                                  reject:(RCTPromiseRejectBlock)reject {
#if !TARGET_OS_MACCATALYST
  [UMPConsentForm
      loadAndPresentIfRequiredFromViewController:[UIApplication sharedApplication]
                                                     .delegate.window.rootViewController
                               completionHandler:^(NSError *_Nullable formError) {
                                 if (formError) {
                                   [RNSharedUtils
                                       rejectPromiseWithUserInfo:reject
                                                        userInfo:[@{
                                                          @"code" : @"consent-form-error",
                                                          @"message" :
                                                              formError.localizedDescription,
                                                        } mutableCopy]];
                                 } else {
                                   resolve([self getConsentInformation]);
                                 }
                               }];
#endif
}

- (void)getConsentInfo:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if !TARGET_OS_MACCATALYST
  resolve([self getConsentInformation]);
#endif
}

- (void)getTCString:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  @try {
    // https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md#in-app-details
    NSString *tcString = [[NSUserDefaults standardUserDefaults] objectForKey:@"IABTCF_TCString"];
    resolve(tcString);
  } @catch (NSError *error) {
    [RNSharedUtils rejectPromiseWithUserInfo:reject
                                    userInfo:[@{
                                      @"code" : @"consent-string-error",
                                      @"message" : error.localizedDescription,
                                    } mutableCopy]];
  }
}

- (void)getGdprApplies:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  @try {
    BOOL gdprApplies = [[NSUserDefaults standardUserDefaults] boolForKey:@"IABTCF_gdprApplies"];
    resolve(@(gdprApplies));
  } @catch (NSError *error) {
    [RNSharedUtils rejectPromiseWithUserInfo:reject
                                    userInfo:[@{
                                      @"code" : @"consent-string-error",
                                      @"message" : error.localizedDescription,
                                    } mutableCopy]];
  }
}

- (void)getPurposeConsents:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  @try {
    NSString *purposeConsents =
        [[NSUserDefaults standardUserDefaults] stringForKey:@"IABTCF_PurposeConsents"];
    resolve(purposeConsents);
  } @catch (NSError *error) {
    [RNSharedUtils rejectPromiseWithUserInfo:reject
                                    userInfo:[@{
                                      @"code" : @"consent-string-error",
                                      @"message" : error.localizedDescription,
                                    } mutableCopy]];
  }
}

- (void)getPurposeLegitimateInterests:(RCTPromiseResolveBlock)resolve
                               reject:(RCTPromiseRejectBlock)reject {
  @try {
    NSString *purposeLegitimateInterests =
        [[NSUserDefaults standardUserDefaults] stringForKey:@"IABTCF_PurposeLegitimateInterests"];
    resolve(purposeLegitimateInterests);
  } @catch (NSError *error) {
    [RNSharedUtils rejectPromiseWithUserInfo:reject
                                    userInfo:[@{
                                      @"code" : @"consent-string-error",
                                      @"message" : error.localizedDescription,
                                    } mutableCopy]];
  }
}

@end
