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

#import "RNGoogleMobileAds/RNGoogleMobileAdsNativeAdViewLayout.h"

/**
 * Regression for invertase/react-native-google-mobile-ads#700:
 * fractional NativeAdView height (e.g. 637.333) makes GMA report asset views
 * outside the native ad view; ceilling size matches the reporter's Math.ceil
 * workaround.
 */
@interface RNGoogleMobileAdsNativeAdViewLayoutTests : XCTestCase
@end

@implementation RNGoogleMobileAdsNativeAdViewLayoutTests

- (void)testCeilsFractionalHeightFromIssue700 {
  CGRect input = CGRectMake(10, 20, 390, 637.3333129882812);
  CGRect out = RNGoogleMobileAdsCeilNativeAdViewFrame(input);

  XCTAssertEqualWithAccuracy(out.origin.x, 10, 0.001);
  XCTAssertEqualWithAccuracy(out.origin.y, 20, 0.001);
  XCTAssertEqualWithAccuracy(out.size.width, 390, 0.001);
  XCTAssertEqualWithAccuracy(out.size.height, 638, 0.001,
                             @"#700: fractional height must ceil so assets stay inside the "
                             @"GADNativeAdView bounds Google validates");
}

- (void)testCeilsFractionalWidthLeavesIntegralUnchanged {
  CGRect input = CGRectMake(0, 0, 100.25, 200);
  CGRect out = RNGoogleMobileAdsCeilNativeAdViewFrame(input);

  XCTAssertEqualWithAccuracy(out.size.width, 101, 0.001);
  XCTAssertEqualWithAccuracy(out.size.height, 200, 0.001);
}

- (void)testIntegralFrameIsUnchanged {
  CGRect input = CGRectMake(1, 2, 320, 480);
  CGRect out = RNGoogleMobileAdsCeilNativeAdViewFrame(input);
  XCTAssertTrue(CGRectEqualToRect(out, input));
}

@end
