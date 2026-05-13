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

#import <GoogleMobileAds/GADAdLoader.h>
#import <GoogleMobileAds/GADNativeAd.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNGoogleMobileAdsSpec/RNGoogleMobileAdsSpec.h>

@interface RNGoogleMobileAdsNativeModule
    : NativeGoogleMobileAdsNativeModuleSpecBase <NativeGoogleMobileAdsNativeModuleSpec>
#else
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RNGoogleMobileAdsNativeModule : RCTEventEmitter <RCTBridgeModule>
#endif

- (GADNativeAd *)nativeAdForResponseId:(NSString *)responseId;

// Bridgeless-mode escape hatch: under React Native bridgeless mode
// [RCTBridge currentBridge] returns nil, so views that fetch this module via
// `moduleForClass:` get a nil reference. The Fabric views fall back to this
// singleton, which captures the module instance on init.
+ (instancetype)sharedInstance;

@end
