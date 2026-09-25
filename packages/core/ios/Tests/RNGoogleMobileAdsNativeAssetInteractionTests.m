/*
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

#import <XCTest/XCTest.h>

#import "RNGoogleMobileAds/RNGoogleMobileAdsNativeAssetInteraction.h"

/**
 * Regression for invertase/react-native-google-mobile-ads#896:
 * registerAsset disables userInteractionEnabled on NativeAsset views; Fabric
 * recycles those views into the component pool still disabled, poisoning
 * unrelated Pressables that reuse them.
 */
@interface RNGoogleMobileAdsNativeAssetInteractionTests : XCTestCase
@end

@implementation RNGoogleMobileAdsNativeAssetInteractionTests

- (void)testDisableLeavesInteractionOffWithoutRestore {
  UIView *view = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 20, 20)];
  view.userInteractionEnabled = YES;
  NSHashTable<UIView *> *tracked = [NSHashTable weakObjectsHashTable];

  [RNGoogleMobileAdsNativeAssetInteraction disableInteractionOnAssetView:view trackingIn:tracked];

  XCTAssertFalse(view.userInteractionEnabled,
                 @"GMA click ownership requires the asset view interaction flag off");
  XCTAssertTrue([tracked containsObject:view]);
}

- (void)testRestoreReenablesInteractionBeforeFabricRecycle {
  UIView *view = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 20, 20)];
  view.userInteractionEnabled = YES;
  NSHashTable<UIView *> *tracked = [NSHashTable weakObjectsHashTable];

  [RNGoogleMobileAdsNativeAssetInteraction disableInteractionOnAssetView:view trackingIn:tracked];
  [RNGoogleMobileAdsNativeAssetInteraction restoreInteractionOnTrackedAssetViews:tracked];

  XCTAssertTrue(view.userInteractionEnabled,
                @"#896: teardown must restore interaction before the view re-enters the Fabric "
                @"recycle pool, otherwise an unrelated Pressable that claims it stays dead");
  XCTAssertEqual(tracked.count, (NSUInteger)0);
}

- (void)testSubtreeRestoreOnlyTouchesDescendants {
  UIView *root = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 100, 100)];
  UIView *child = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 20, 20)];
  UIView *other = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 20, 20)];
  [root addSubview:child];
  child.userInteractionEnabled = YES;
  other.userInteractionEnabled = YES;
  NSHashTable<UIView *> *tracked = [NSHashTable weakObjectsHashTable];

  [RNGoogleMobileAdsNativeAssetInteraction disableInteractionOnAssetView:child trackingIn:tracked];
  [RNGoogleMobileAdsNativeAssetInteraction disableInteractionOnAssetView:other trackingIn:tracked];
  [RNGoogleMobileAdsNativeAssetInteraction restoreInteractionOnTrackedAssetViews:tracked
                                                                       inSubtree:root];

  XCTAssertTrue(child.userInteractionEnabled);
  XCTAssertFalse(other.userInteractionEnabled,
                 @"views outside the unmounted subtree stay owned by the live ad");
  XCTAssertTrue([tracked containsObject:other]);
  XCTAssertFalse([tracked containsObject:child]);
}

@end
