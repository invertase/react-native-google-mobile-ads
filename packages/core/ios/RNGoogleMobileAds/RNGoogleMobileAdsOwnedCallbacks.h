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
 */

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Spy-friendly owned paid / click / reward / GAM manual-impression seams.
 *
 * Safe to compile in the lightweight XCTest harness (Foundation only; no GMA).
 * Production banner/fullscreen code routes through these helpers so subclass
 * spies and deterministic handler invocation stay in unit scope ([GMA-AD-6]).
 */

typedef NS_ENUM(NSInteger, RNGoogleMobileAdsBannerCommandAction) {
  RNGoogleMobileAdsBannerCommandActionUnknown = 0,
  RNGoogleMobileAdsBannerCommandActionRecordManualImpression,
  RNGoogleMobileAdsBannerCommandActionLoad,
};

/** Copy-property surface modeling GAD paid / click / reward attach sites. */
@interface RNGoogleMobileAdsOwnedCallbackSurface : NSObject
@property(nonatomic, copy, nullable) void (^paidEventHandler)(id value);
@property(nonatomic, copy, nullable) void (^clickHandler)(void);
@property(nonatomic, copy, nullable) void (^userDidEarnRewardHandler)(void);
@end

@interface RNGoogleMobileAdsOwnedCallbacks : NSObject

#pragma mark - Event types (match production bridge strings)

+ (NSString *)fullscreenPaidEventType;
+ (NSString *)fullscreenClickedEventType;
+ (NSString *)fullscreenEarnedRewardEventType;
+ (NSString *)bannerPaidNativeEventType;
+ (NSString *)bannerClickedNativeEventType;

#pragma mark - Handler attach (production-shaped blocks)

/**
 * Attaches a paid handler that emits `fullscreenPaidEventType` with `value`.
 * Mirrors FullScreenAd / BannerComponent paidEventHandler wiring.
 */
+ (void)attachPaidHandlerToSurface:(RNGoogleMobileAdsOwnedCallbackSurface *)surface
                              emit:(void (^)(NSString *type, id value))emit;

/**
 * Attaches a click handler that emits `eventType` (fullscreen `clicked` or
 * banner `onAdClicked` via BannerEventMapping).
 */
+ (void)attachClickHandlerToSurface:(RNGoogleMobileAdsOwnedCallbackSurface *)surface
                          eventType:(NSString *)eventType
                               emit:(void (^)(NSString *type))emit;

/**
 * Attaches a reward handler that builds the nil-safe reward payload and emits
 * `fullscreenEarnedRewardEventType` on the main queue (sync when already on
 * main), matching FullScreenAd userDidEarnRewardHandler.
 */
+ (void)attachRewardHandlerToSurface:(RNGoogleMobileAdsOwnedCallbackSurface *)surface
                          rewardType:(nullable NSString *)rewardType
                              amount:(nullable NSNumber *)amount
                                emit:(void (^)(NSString *type, NSDictionary *data))emit;

#pragma mark - Classic manualImpressionsEnabled BOOL → NSNumber

/** Classic RCT BOOL prop storage. Never take `BOOL *` — that coerces the address. */
+ (NSNumber *)manualImpressionsEnabledNumberFromBool:(BOOL)enabled;

#pragma mark - GAM manual-impression configuration + routing

/** GAM-only: whether `enableManualImpressions` should be applied at banner init. */
+ (BOOL)shouldApplyEnableManualImpressions:(BOOL)manualImpressionsEnabled
                           isAdManagerUnit:(BOOL)isAdManagerUnit;

/**
 * Spy-friendly GAM gate for `recordManualImpression`.
 * Uses `isSubclassOfClass:` so test spies / subclasses of GAMBannerView pass.
 * Exact-class equality (`[banner class] == [GAMBannerView class]`) is unsafe.
 */
+ (BOOL)shouldRecordManualImpressionForBannerClass:(Class)bannerClass
                              adManagerBannerClass:(Class)adManagerBannerClass;

+ (RNGoogleMobileAdsBannerCommandAction)actionForCommandName:(nullable NSString *)commandName;

@end

NS_ASSUME_NONNULL_END
