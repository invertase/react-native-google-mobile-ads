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

#import "RNGoogleMobileAds/RNGoogleMobileAdsBannerPaidHandlerLifecycle.h"

/**
 * Regression for invertase/react-native-google-mobile-ads#540:
 * Fabric banner paidEventHandler must not strongly retain the React owner.
 * GADBannerView copies the handler; owner → banner → block → owner leaks
 * WebView-backed banners and heats real devices under list density.
 */
@interface RNGoogleMobileAdsBannerPaidHandlerLifecycleTests : XCTestCase
@end

@implementation RNGoogleMobileAdsBannerPaidHandlerLifecycleTests

- (void)testStrongOwnerPaidHandlerLeaksOwnerAfterExternalRelease {
  __block id owner = [[NSObject alloc] init];
  __weak id weakOwner = owner;
  RNGoogleMobileAdsPaidEventSurface *surface = [[RNGoogleMobileAdsPaidEventSurface alloc] init];

  [RNGoogleMobileAdsBannerPaidHandlerLifecycle
      attachStrongOwnerPaidHandlerToSurface:surface
                                      owner:owner
                                       emit:^(id capturedOwner, id value) {
                                         (void)capturedOwner;
                                         (void)value;
                                       }];

  owner = nil;

  XCTAssertNotNil(surface.paidEventHandler);
  XCTAssertNotNil(weakOwner,
                  @"#540 failure mode: copy-retained paidEventHandler that strongly "
                  @"captures the banner owner keeps the owner alive after external release");
}

- (void)testWeakOwnerPaidHandlerAllowsOwnerDealloc {
  __block id owner = [[NSObject alloc] init];
  __weak id weakOwner = owner;
  RNGoogleMobileAdsPaidEventSurface *surface = [[RNGoogleMobileAdsPaidEventSurface alloc] init];

  [RNGoogleMobileAdsBannerPaidHandlerLifecycle
      attachWeakOwnerPaidHandlerToSurface:surface
                                    owner:owner
                                     emit:^(id capturedOwner, id value) {
                                       (void)capturedOwner;
                                       (void)value;
                                     }];

  owner = nil;

  XCTAssertNotNil(surface.paidEventHandler);
  XCTAssertNil(weakOwner, @"#540: weak-owner paidEventHandler must allow the React banner owner to "
                          @"deallocate while the ad surface still holds the copied block");
}

- (void)testWeakOwnerPaidHandlerEmitsWhileOwnerAlive {
  __block id owner = [[NSObject alloc] init];
  RNGoogleMobileAdsPaidEventSurface *surface = [[RNGoogleMobileAdsPaidEventSurface alloc] init];
  __block id emittedOwner = nil;
  __block id emittedValue = nil;

  [RNGoogleMobileAdsBannerPaidHandlerLifecycle
      attachWeakOwnerPaidHandlerToSurface:surface
                                    owner:owner
                                     emit:^(id capturedOwner, id value) {
                                       emittedOwner = capturedOwner;
                                       emittedValue = value;
                                     }];

  surface.paidEventHandler(@"payload");

  XCTAssertEqual(emittedOwner, owner);
  XCTAssertEqualObjects(emittedValue, @"payload");
}

@end
