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

#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Pure owned mappers/helpers (no Google auction/fill behavior).
 * Safe to compile in the lightweight XCTest harness without linking GMA.
 */
@interface RNGoogleMobileAdsOwnedMappers : NSObject

+ (BOOL)isAdManagerUnit:(nullable NSString *)unitId;

/**
 * Maps a Google Mobile Ads NSError.code (GADErrorCode) to the JS-facing
 * `{ code, message, reason }` dictionary. Integers mirror GADErrorCode.
 * `reason` is the additive v17 vocabulary (`code` stays legacy).
 */
+ (NSDictionary<NSString *, NSString *> *)codeAndMessageFromAdErrorCode:(NSInteger)code
                                                                message:
                                                                    (nullable NSString *)message;

/**
 * Same as codeAndMessageFromAdErrorCode plus additive `phase` (`load` | `show`).
 */
+ (NSMutableDictionary *)adErrorPayloadFromAdErrorCode:(NSInteger)code
                                               message:(nullable NSString *)message
                                                 phase:(NSString *)phase;

/**
 * Parses a custom "WxH" size token. Returns YES and writes width/height when matched.
 */
+ (BOOL)customAdSizeFromString:(NSString *)value width:(CGFloat *)width height:(CGFloat *)height;

/**
 * Returns an uppercase named banner size token (BANNER, FLUID, …) or nil when
 * the value is not a known named size (including adaptive tokens handled elsewhere).
 */
+ (nullable NSString *)namedBannerSizeTokenFromString:(NSString *)value;

/**
 * Empty / whitespace-only strings become nil (JS `null`).
 */
+ (nullable NSString *)emptyToNull:(nullable NSString *)value;

/**
 * Allowlist-only ResponseInfo extras. Keys are the JS camelCase names.
 */
+ (NSDictionary<NSString *, NSString *> *)allowlistedResponseInfoExtras:
    (nullable NSDictionary *)extras;

/**
 * Converts iOS GAD latency (seconds) to milliseconds for the JS contract.
 */
+ (NSNumber *)latencyMillisFromSeconds:(NSTimeInterval)latency;

/**
 * Compact paid snapshot: copies full ResponseInfo dict without `adapterResponses`.
 */
+ (NSDictionary *)compactPaidResponseInfoFromFull:(NSDictionary *)full;

@end

NS_ASSUME_NONNULL_END
