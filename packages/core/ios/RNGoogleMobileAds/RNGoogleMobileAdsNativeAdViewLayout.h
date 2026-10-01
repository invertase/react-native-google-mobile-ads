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
 * Ceils NativeAdView width/height so GMA's "asset views lie inside the native
 * ad view" validator does not fail on fractional Yoga sizes (e.g. 637.333 on
 * @3x). Origin is unchanged. Safe for the lightweight XCTest harness (no GMA).
 *
 * Regression for invertase/react-native-google-mobile-ads#700.
 *
 * Defined in a .m (C linkage). Keep extern "C" so .mm call sites do not mangle.
 */
#ifdef __cplusplus
extern "C" {
#endif

CGRect RNGoogleMobileAdsCeilNativeAdViewFrame(CGRect frame);

#ifdef __cplusplus
}  // extern "C"
#endif

NS_ASSUME_NONNULL_END
