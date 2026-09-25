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

#import "RNGoogleMobileAds/RNGoogleMobileAdsBannerEventMapping.h"

/**
 * Guard for invertase/react-native-google-mobile-ads#589:
 * iOS banner click detection is `onAdClicked` (DidRecordClick), not
 * `onAdOpened` (WillPresentScreen). Present-screen remains a separate overlay
 * lifecycle event.
 */
@interface RNGoogleMobileAdsBannerEventMappingTests : XCTestCase
@end

@implementation RNGoogleMobileAdsBannerEventMappingTests

- (void)testWillPresentScreenMapsToOnAdOpened {
  XCTAssertEqualObjects(
      [RNGoogleMobileAdsBannerEventMapping
          nativeEventTypeForCallback:RNGoogleMobileAdsBannerDelegateCallbackWillPresentScreen],
      @"onAdOpened");
}

- (void)testDidRecordClickMapsToOnAdClicked {
  XCTAssertEqualObjects(
      [RNGoogleMobileAdsBannerEventMapping
          nativeEventTypeForCallback:RNGoogleMobileAdsBannerDelegateCallbackDidRecordClick],
      @"onAdClicked",
      @"#589: click-counting / hide-on-second-click must use onAdClicked; onAdOpened only fires "
      @"when an in-app fullscreen overlay is presented");
}

- (void)testDidRecordClickIsNotOnAdOpened {
  NSString *clickType = [RNGoogleMobileAdsBannerEventMapping
      nativeEventTypeForCallback:RNGoogleMobileAdsBannerDelegateCallbackDidRecordClick];
  NSString *openedType = [RNGoogleMobileAdsBannerEventMapping
      nativeEventTypeForCallback:RNGoogleMobileAdsBannerDelegateCallbackWillPresentScreen];
  XCTAssertNotEqualObjects(clickType, openedType);
}

- (void)testImpressionAndClosedMappings {
  XCTAssertEqualObjects(
      [RNGoogleMobileAdsBannerEventMapping
          nativeEventTypeForCallback:RNGoogleMobileAdsBannerDelegateCallbackDidRecordImpression],
      @"onAdImpression");
  XCTAssertEqualObjects(
      [RNGoogleMobileAdsBannerEventMapping
          nativeEventTypeForCallback:RNGoogleMobileAdsBannerDelegateCallbackDidDismissScreen],
      @"onAdClosed");
}

@end
