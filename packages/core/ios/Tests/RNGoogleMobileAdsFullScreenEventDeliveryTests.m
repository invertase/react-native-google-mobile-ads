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

#import "RNGoogleMobileAds/RNGoogleMobileAdsFullScreenEventDelivery.h"

/**
 * Regression for invertase/react-native-google-mobile-ads#880:
 * Rewarded EARNED_REWARD / CLOSED must reach JS. Evicting the weakly-held
 * fullScreenContentDelegate before emit drops deferred CLOSED; reward
 * payloads must be nil-safe and share CLOSED's main-queue policy (sync when
 * already on main) so earn-then-dismiss keeps EARNED_REWARD before CLOSED.
 */
@interface RNGoogleMobileAdsFullScreenEventDeliveryTests : XCTestCase
@end

@implementation RNGoogleMobileAdsFullScreenEventDeliveryTests

- (void)testDeliverTerminalEmitsBeforeEvict {
  NSMutableArray<NSString *> *order = [NSMutableArray array];

  [RNGoogleMobileAdsFullScreenEventDelivery
      deliverTerminalEventWithEmit:^{
        [order addObject:@"emit"];
      }
      evict:^{
        [order addObject:@"evict"];
      }];

  XCTAssertEqualObjects(order, (@[ @"emit", @"evict" ]),
                        @"#880: CLOSED/ERROR must emit before onTerminal evicts the weak "
                        @"fullScreenContentDelegate, otherwise deferred bridge delivery can "
                        @"observe a deallocated emitter");
}

- (void)testEvictBeforeAsyncEmitDropsClosedWhenDelegateOnlyStronglyHeldInMap {
  // Models GADFullScreenPresentingAd.fullScreenContentDelegate (weak) + our
  // delegateMap (strong). Evict-then-async-emit loses CLOSED.
  __block id delegate = [[NSObject alloc] init];
  __weak id weakDelegate = delegate;
  NSMutableArray *map = [NSMutableArray arrayWithObject:delegate];
  __block BOOL closedEmitted = NO;

  // Buggy order (pre-fix FullScreenContentDelegate):
  [map removeAllObjects];
  delegate = nil;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (weakDelegate != nil) {
      closedEmitted = YES;
    }
  });

  XCTestExpectation *expectation = [self expectationWithDescription:@"async emit attempt"];
  dispatch_async(dispatch_get_main_queue(), ^{
    [expectation fulfill];
  });
  [self waitForExpectations:@[ expectation ] timeout:1.0];

  XCTAssertNil(weakDelegate);
  XCTAssertFalse(closedEmitted,
                 @"documents #880 failure mode: evict-before-async-emit drops CLOSED");
}

- (void)testCorrectOrderKeepsDelegateAliveForAsyncClosedEmit {
  __block id delegate = [[NSObject alloc] init];
  __weak id weakDelegate = delegate;
  NSMutableArray *map = [NSMutableArray arrayWithObject:delegate];
  __block BOOL closedEmitted = NO;

  [RNGoogleMobileAdsFullScreenEventDelivery
      deliverTerminalEventWithEmit:^{
        id strong = weakDelegate;
        dispatch_async(dispatch_get_main_queue(), ^{
          if (strong != nil) {
            closedEmitted = YES;
          }
        });
      }
      evict:^{
        [map removeAllObjects];
        delegate = nil;
      }];

  XCTestExpectation *expectation = [self expectationWithDescription:@"async closed"];
  dispatch_async(dispatch_get_main_queue(), ^{
    [expectation fulfill];
  });
  [self waitForExpectations:@[ expectation ] timeout:1.0];

  XCTAssertTrue(closedEmitted,
                @"#880: emit-before-evict retains the emitter through deferred CLOSED delivery");
}

- (void)testRewardEventDataNilSafeAndBridgeFriendly {
  NSDictionary *payload = [RNGoogleMobileAdsFullScreenEventDelivery rewardEventDataWithType:nil
                                                                                     amount:nil];
  XCTAssertEqualObjects(payload[@"type"], @"");
  XCTAssertEqualObjects(payload[@"amount"], @0);

  NSDecimalNumber *decimal = [NSDecimalNumber decimalNumberWithString:@"10"];
  NSDictionary *fromDecimal =
      [RNGoogleMobileAdsFullScreenEventDelivery rewardEventDataWithType:@"coins" amount:decimal];
  XCTAssertEqualObjects(fromDecimal[@"type"], @"coins");
  XCTAssertEqualWithAccuracy([fromDecimal[@"amount"] doubleValue], 10.0, 0.0001);
}

- (void)testDispatchOnMainQueueRunsSyncWhenAlreadyOnMain {
  __block BOOL ran = NO;

  XCTAssertTrue([NSThread isMainThread]);
  [RNGoogleMobileAdsFullScreenEventDelivery dispatchAsyncOnMainQueue:^{
    ran = [NSThread isMainThread];
  }];

  XCTAssertTrue(ran, @"#880 F1: already on main must run sync so reward shares "
                     @"CLOSED's queueing policy");
}

- (void)testDispatchOnMainQueueHopsWhenOffMain {
  XCTestExpectation *expectation = [self expectationWithDescription:@"off-main hop"];
  __block BOOL ranOnMain = NO;

  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    XCTAssertFalse([NSThread isMainThread]);
    [RNGoogleMobileAdsFullScreenEventDelivery dispatchAsyncOnMainQueue:^{
      ranOnMain = [NSThread isMainThread];
      [expectation fulfill];
    }];
  });

  [self waitForExpectations:@[ expectation ] timeout:1.0];
  XCTAssertTrue(ranOnMain);
}

- (void)testEarnThenDismissOnSameMainTurnDeliversRewardBeforeClosed {
  // Models GMA: userDidEarnRewardHandler then adDidDismissFullScreenContent on
  // the same main turn. Always-async reward hop + sync CLOSED inverted order.
  NSMutableArray<NSString *> *order = [NSMutableArray array];

  [RNGoogleMobileAdsFullScreenEventDelivery dispatchAsyncOnMainQueue:^{
    [order addObject:@"EARNED_REWARD"];
  }];
  [RNGoogleMobileAdsFullScreenEventDelivery
      deliverTerminalEventWithEmit:^{
        [order addObject:@"CLOSED"];
      }
      evict:^{
        [order addObject:@"evict"];
      }];

  XCTAssertEqualObjects(order, (@[ @"EARNED_REWARD", @"CLOSED", @"evict" ]),
                        @"#880 F1: earn then dismiss on one main turn must keep "
                        @"EARNED_REWARD before CLOSED (pre-fix always-async "
                        @"reward hop inverted this)");
}

@end
