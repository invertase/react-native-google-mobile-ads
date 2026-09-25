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
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Tracks NativeAsset views whose userInteractionEnabled was cleared for GMA
 * click ownership, and restores it before Fabric recycles those views.
 *
 * Safe to compile in the lightweight XCTest harness (UIKit only; no GMA).
 */
@interface RNGoogleMobileAdsNativeAssetInteraction : NSObject

/**
 * Disables interaction on an asset view and records it in a weak hash table so
 * teardown can re-enable it. `tracked` must be a weak-objects NSHashTable.
 */
+ (void)disableInteractionOnAssetView:(UIView *)view trackingIn:(NSHashTable<UIView *> *)tracked;

/**
 * Re-enables userInteractionEnabled on every still-alive tracked view and
 * empties the table. Call before child unmount / dealloc so recycled Fabric
 * component views are not left untappable.
 */
+ (void)restoreInteractionOnTrackedAssetViews:(NSHashTable<UIView *> *)tracked;

/**
 * Restores tracked views that are `root` or descendants of `root`, and removes
 * only those entries from `tracked`.
 */
+ (void)restoreInteractionOnTrackedAssetViews:(NSHashTable<UIView *> *)tracked
                                    inSubtree:(UIView *)root;

@end

NS_ASSUME_NONNULL_END
