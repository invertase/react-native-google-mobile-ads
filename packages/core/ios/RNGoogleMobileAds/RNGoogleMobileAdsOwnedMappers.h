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
 * `{ code, message }` dictionary. Integers mirror GADErrorCode.
 */
+ (NSDictionary<NSString *, NSString *> *)codeAndMessageFromAdErrorCode:(NSInteger)code
                                                                message:
                                                                    (nullable NSString *)message;

/**
 * Parses a custom "WxH" size token. Returns YES and writes width/height when matched.
 */
+ (BOOL)customAdSizeFromString:(NSString *)value width:(CGFloat *)width height:(CGFloat *)height;

/**
 * Returns an uppercase named banner size token (BANNER, FLUID, …) or nil when
 * the value is not a known named size (including adaptive tokens handled elsewhere).
 */
+ (nullable NSString *)namedBannerSizeTokenFromString:(NSString *)value;

@end

NS_ASSUME_NONNULL_END
