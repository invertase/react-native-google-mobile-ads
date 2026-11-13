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
 * Native-ad counterpart of the #540 banner regression.
 *
 * GADNativeAd.paidEventHandler is a copy property, modelled here by
 * RNGoogleMobileAdsPaidEventSurface. The native ad holders set a handler that
 * read `nativeAd.responseInfo` and called `self`, so the block strongly
 * captured the very ad that owns it:
 *   nativeAd → paidEventHandler → nativeAd
 * `dispose` only drops the holder's reference, so neither the ad nor its
 * WKWebView ever deallocates after destroy().
 */
@interface RNGoogleMobileAdsNativeAdPaidHandlerLifecycleTests : XCTestCase
@end

@implementation RNGoogleMobileAdsNativeAdPaidHandlerLifecycleTests

/**
 * Pre-fix pattern: the handler reads the ad it is attached to. Built in its own
 * method so the stack block goes away on return and only the copy held by the
 * property keeps the ad, as in the holders.
 */
- (void)attachSelfCapturingPaidHandlerToNativeAd:(RNGoogleMobileAdsPaidEventSurface *)nativeAd {
  nativeAd.paidEventHandler = ^(id value) {
    (void)value;
    (void)nativeAd.paidEventHandler;
  };
}

- (void)testSelfCapturingPaidHandlerKeepsAdAliveAfterRelease {
  RNGoogleMobileAdsPaidEventSurface *nativeAd = [[RNGoogleMobileAdsPaidEventSurface alloc] init];
  __weak RNGoogleMobileAdsPaidEventSurface *weakNativeAd = nativeAd;

  [self attachSelfCapturingPaidHandlerToNativeAd:nativeAd];

  nativeAd = nil;

  XCTAssertNotNil(weakNativeAd,
                  @"Failure mode: a paidEventHandler that strongly captures its own native ad "
                  @"keeps the ad alive after every external reference is gone");

  // Break the cycle so the test does not leak.
  weakNativeAd.paidEventHandler = nil;
}

- (void)testWeakCapturePaidHandlerAllowsAdDealloc {
  RNGoogleMobileAdsPaidEventSurface *nativeAd = [[RNGoogleMobileAdsPaidEventSurface alloc] init];
  __weak RNGoogleMobileAdsPaidEventSurface *weakNativeAd = nativeAd;
  __block id holder = [[NSObject alloc] init];
  __weak id weakHolder = holder;

  [RNGoogleMobileAdsBannerPaidHandlerLifecycle
      attachWeakOwnerPaidHandlerToSurface:nativeAd
                                    owner:holder
                                     emit:^(id owner, id value) {
                                       (void)owner;
                                       (void)value;
                                     }];

  holder = nil;
  nativeAd = nil;

  XCTAssertNil(weakHolder, @"A weak-capture paidEventHandler must let the ad holder deallocate");
  XCTAssertNil(weakNativeAd,
               @"A weak-capture paidEventHandler must let the native ad deallocate once the "
               @"holder releases it on destroy()");
}

- (void)testClearingPaidHandlerOnDisposeReleasesSelfCapturingAd {
  RNGoogleMobileAdsPaidEventSurface *nativeAd = [[RNGoogleMobileAdsPaidEventSurface alloc] init];
  __weak RNGoogleMobileAdsPaidEventSurface *weakNativeAd = nativeAd;

  [self attachSelfCapturingPaidHandlerToNativeAd:nativeAd];

  // What the holders' dispose now does before dropping the ad.
  nativeAd.paidEventHandler = nil;
  nativeAd = nil;

  XCTAssertNil(weakNativeAd,
               @"Clearing paidEventHandler on dispose must release the native ad even if a "
               @"handler captured it");
}

@end
