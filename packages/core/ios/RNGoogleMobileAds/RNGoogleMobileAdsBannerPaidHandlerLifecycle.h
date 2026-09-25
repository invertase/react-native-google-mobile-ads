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
 * Models GADBannerView.paidEventHandler (`nonatomic, copy`) retain semantics
 * for the lightweight XCTest harness (Foundation only; no GMA).
 *
 * Local GMA header: `GADBannerView.paidEventHandler` is a copy property and
 * `GADPaidEventHandler` is `void (^)(GADAdValue *)`. A block that strongly
 * captures the React banner owner creates:
 *   owner → banner → paidEventHandler → owner
 * so the Fabric view + WKWebView-backed creative never deallocate after
 * unmount (#540 heat / scroll death with many list banners). Paper
 * `RNGoogleMobileAdsBannerComponent` already used `__weak` self; Fabric
 * `RNGoogleMobileAdsBannerView.mm` did not.
 */
@interface RNGoogleMobileAdsPaidEventSurface : NSObject
@property(nonatomic, copy, nullable) void (^paidEventHandler)(id value);
@end

@interface RNGoogleMobileAdsBannerPaidHandlerLifecycle : NSObject

/** Pre-fix Fabric pattern: block strongly captures `owner`. */
+ (void)attachStrongOwnerPaidHandlerToSurface:(RNGoogleMobileAdsPaidEventSurface *)surface
                                        owner:(id)owner
                                         emit:(void (^)(id owner, id value))emit;

/**
 * Correct pattern: block weakly captures `owner` (paper BannerComponent /
 * post-#540 Fabric BannerView).
 */
+ (void)attachWeakOwnerPaidHandlerToSurface:(RNGoogleMobileAdsPaidEventSurface *)surface
                                      owner:(id)owner
                                       emit:(void (^)(id owner, id value))emit;

@end

NS_ASSUME_NONNULL_END
