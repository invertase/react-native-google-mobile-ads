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

#import "RNGoogleMobileAds/RNGoogleMobileAdsOwnedCallbacks.h"

/**
 * iOS owned paid / click / reward handler wiring and GAM manual-impression
 * configuration + command routing. No Google auction/fill asserts ([GMA-AD-6]).
 */
@interface RNGoogleMobileAdsOwnedCallbacksTests : XCTestCase
@end

/** Stand-in for GAMBannerView in spy-friendly class-hierarchy checks. */
@interface RNGMAOwnedCallbacksAdManagerBanner : NSObject
@end
@implementation RNGMAOwnedCallbacksAdManagerBanner
@end

/** Spy subclass — exact-class equality would reject this; isSubclassOfClass must not. */
@interface RNGMAOwnedCallbacksSpyAdManagerBanner : RNGMAOwnedCallbacksAdManagerBanner
@end
@implementation RNGMAOwnedCallbacksSpyAdManagerBanner
@end

@interface RNGMAOwnedCallbacksPlainBanner : NSObject
@end
@implementation RNGMAOwnedCallbacksPlainBanner
@end

@implementation RNGoogleMobileAdsOwnedCallbacksTests

#pragma mark - Paid / click / reward handlers

- (void)testPaidHandlerEmitsFullscreenPaidEventType {
  RNGoogleMobileAdsOwnedCallbackSurface *surface =
      [[RNGoogleMobileAdsOwnedCallbackSurface alloc] init];
  __block NSString *emittedType = nil;
  __block id emittedValue = nil;

  [RNGoogleMobileAdsOwnedCallbacks attachPaidHandlerToSurface:surface
                                                         emit:^(NSString *type, id value) {
                                                           emittedType = type;
                                                           emittedValue = value;
                                                         }];

  XCTAssertNotNil(surface.paidEventHandler);
  surface.paidEventHandler(@{@"currency" : @"USD", @"valueMicros" : @"1500000"});

  XCTAssertEqualObjects(emittedType, [RNGoogleMobileAdsOwnedCallbacks fullscreenPaidEventType]);
  XCTAssertEqualObjects(emittedType, @"paid");
  XCTAssertEqualObjects(emittedValue[@"currency"], @"USD");
  XCTAssertEqualObjects(emittedValue[@"valueMicros"], @"1500000");
}

- (void)testBannerPaidNativeEventTypeIsOnPaid {
  XCTAssertEqualObjects([RNGoogleMobileAdsOwnedCallbacks bannerPaidNativeEventType], @"onPaid");
}

- (void)testClickHandlerEmitsFullscreenClickedEventType {
  RNGoogleMobileAdsOwnedCallbackSurface *surface =
      [[RNGoogleMobileAdsOwnedCallbackSurface alloc] init];
  __block NSString *emittedType = nil;

  [RNGoogleMobileAdsOwnedCallbacks
      attachClickHandlerToSurface:surface
                        eventType:[RNGoogleMobileAdsOwnedCallbacks fullscreenClickedEventType]
                             emit:^(NSString *type) {
                               emittedType = type;
                             }];

  XCTAssertNotNil(surface.clickHandler);
  surface.clickHandler();

  XCTAssertEqualObjects(emittedType, @"clicked");
}

- (void)testClickHandlerEmitsBannerOnAdClickedViaMapping {
  RNGoogleMobileAdsOwnedCallbackSurface *surface =
      [[RNGoogleMobileAdsOwnedCallbackSurface alloc] init];
  __block NSString *emittedType = nil;

  [RNGoogleMobileAdsOwnedCallbacks
      attachClickHandlerToSurface:surface
                        eventType:[RNGoogleMobileAdsOwnedCallbacks bannerClickedNativeEventType]
                             emit:^(NSString *type) {
                               emittedType = type;
                             }];

  surface.clickHandler();

  XCTAssertEqualObjects(emittedType, @"onAdClicked");
}

- (void)testRewardHandlerEmitsEarnedRewardPayloadOnMain {
  RNGoogleMobileAdsOwnedCallbackSurface *surface =
      [[RNGoogleMobileAdsOwnedCallbackSurface alloc] init];
  __block NSString *emittedType = nil;
  __block NSDictionary *emittedData = nil;

  [RNGoogleMobileAdsOwnedCallbacks
      attachRewardHandlerToSurface:surface
                        rewardType:@"coins"
                            amount:@10
                              emit:^(NSString *type, NSDictionary *data) {
                                emittedType = type;
                                emittedData = data;
                              }];

  XCTAssertNotNil(surface.userDidEarnRewardHandler);
  surface.userDidEarnRewardHandler();

  XCTAssertEqualObjects(emittedType, @"rewarded_earned_reward");
  XCTAssertEqualObjects(emittedData[@"type"], @"coins");
  XCTAssertEqualObjects(emittedData[@"amount"], @10);
}

- (void)testRewardHandlerNilSafePayload {
  RNGoogleMobileAdsOwnedCallbackSurface *surface =
      [[RNGoogleMobileAdsOwnedCallbackSurface alloc] init];
  __block NSDictionary *emittedData = nil;

  [RNGoogleMobileAdsOwnedCallbacks
      attachRewardHandlerToSurface:surface
                        rewardType:nil
                            amount:nil
                              emit:^(NSString *type, NSDictionary *data) {
                                (void)type;
                                emittedData = data;
                              }];

  surface.userDidEarnRewardHandler();

  XCTAssertEqualObjects(emittedData[@"type"], @"");
  XCTAssertEqualObjects(emittedData[@"amount"], @0);
}

#pragma mark - Classic manualImpressionsEnabled BOOL storage

- (void)testManualImpressionsEnabledNumberFromBool {
  XCTAssertEqualObjects(
      [RNGoogleMobileAdsOwnedCallbacks manualImpressionsEnabledNumberFromBool:YES], @YES);
  XCTAssertEqualObjects([RNGoogleMobileAdsOwnedCallbacks manualImpressionsEnabledNumberFromBool:NO],
                        @NO);
}

- (void)testManualImpressionsEnabledFalseIsNotTruthyPointerCoercion {
  // Documents the BOOL* footgun: treating a BOOL* parameter as BOOL would
  // convert a non-NULL stack address to YES even when the pointed BOOL is NO.
  BOOL disabled = NO;
  BOOL *unsafePointer = &disabled;
  NSNumber *fromBool =
      [RNGoogleMobileAdsOwnedCallbacks manualImpressionsEnabledNumberFromBool:disabled];
  NSNumber *fromPointerAsBool = [NSNumber numberWithBool:(BOOL)(uintptr_t)unsafePointer];

  XCTAssertEqualObjects(fromBool, @NO);
  XCTAssertEqualObjects(
      fromPointerAsBool, @YES,
      @"BOOL* → numberWithBool coerces the address; classic setter must take BOOL");
}

#pragma mark - Manual-impression configuration + spy-friendly routing

- (void)testShouldApplyEnableManualImpressionsOnlyForAdManagerWhenEnabled {
  XCTAssertTrue([RNGoogleMobileAdsOwnedCallbacks shouldApplyEnableManualImpressions:YES
                                                                    isAdManagerUnit:YES]);
  XCTAssertFalse([RNGoogleMobileAdsOwnedCallbacks shouldApplyEnableManualImpressions:NO
                                                                     isAdManagerUnit:YES]);
  XCTAssertFalse([RNGoogleMobileAdsOwnedCallbacks shouldApplyEnableManualImpressions:YES
                                                                     isAdManagerUnit:NO]);
}

- (void)testShouldRecordManualImpressionAcceptsAdManagerSubclassSpies {
  Class adManager = [RNGMAOwnedCallbacksAdManagerBanner class];
  Class spy = [RNGMAOwnedCallbacksSpyAdManagerBanner class];
  Class plain = [RNGMAOwnedCallbacksPlainBanner class];

  XCTAssertTrue([RNGoogleMobileAdsOwnedCallbacks
      shouldRecordManualImpressionForBannerClass:adManager
                            adManagerBannerClass:adManager]);
  XCTAssertTrue(
      [RNGoogleMobileAdsOwnedCallbacks shouldRecordManualImpressionForBannerClass:spy
                                                             adManagerBannerClass:adManager],
      @"spy-friendly seam must accept GAMBannerView subclasses");
  XCTAssertFalse([RNGoogleMobileAdsOwnedCallbacks
      shouldRecordManualImpressionForBannerClass:plain
                            adManagerBannerClass:adManager]);
  XCTAssertFalse(spy == adManager, @"exact-class equality would reject the spy subclass");
}

- (void)testClassicAndFabricCommandRouting {
  XCTAssertEqual([RNGoogleMobileAdsOwnedCallbacks actionForCommandName:@"recordManualImpression"],
                 RNGoogleMobileAdsBannerCommandActionRecordManualImpression);
  XCTAssertEqual([RNGoogleMobileAdsOwnedCallbacks actionForCommandName:@"load"],
                 RNGoogleMobileAdsBannerCommandActionLoad);
  XCTAssertEqual([RNGoogleMobileAdsOwnedCallbacks actionForCommandName:@"other"],
                 RNGoogleMobileAdsBannerCommandActionUnknown);
  XCTAssertEqual([RNGoogleMobileAdsOwnedCallbacks actionForCommandName:nil],
                 RNGoogleMobileAdsBannerCommandActionUnknown);
}

- (void)testLoadCommandIsNotCountedAsManualImpressionRoute {
  RNGoogleMobileAdsBannerCommandAction loadAction =
      [RNGoogleMobileAdsOwnedCallbacks actionForCommandName:@"load"];
  RNGoogleMobileAdsBannerCommandAction recordAction =
      [RNGoogleMobileAdsOwnedCallbacks actionForCommandName:@"recordManualImpression"];
  XCTAssertNotEqual(loadAction, recordAction);
  XCTAssertEqual(loadAction, RNGoogleMobileAdsBannerCommandActionLoad);
}

@end
