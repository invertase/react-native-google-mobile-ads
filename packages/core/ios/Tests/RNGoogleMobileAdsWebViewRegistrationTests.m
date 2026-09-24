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

#import <WebKit/WebKit.h>
#import <XCTest/XCTest.h>

#import "RNGoogleMobileAds/RNGoogleMobileAdsWebViewRegistration.h"

/**
 * Guard for invertase/react-native-google-mobile-ads#855:
 * registerWebView must locate a WKWebView under a host wrapper (e.g. RNCWebView).
 */
@interface RNGoogleMobileAdsWebViewRegistrationTests : XCTestCase
@end

@implementation RNGoogleMobileAdsWebViewRegistrationTests

- (void)testReturnsRootWhenAlreadyWKWebView {
  WKWebView *webView = [[WKWebView alloc] initWithFrame:CGRectZero];
  XCTAssertEqualObjects([RNGoogleMobileAdsWebViewRegistration findWebViewInView:webView], webView);
}

- (void)testWalksHostWrapperForNestedWKWebView {
  UIView *host = [[UIView alloc] initWithFrame:CGRectZero];
  UIView *nested = [[UIView alloc] initWithFrame:CGRectZero];
  WKWebView *webView = [[WKWebView alloc] initWithFrame:CGRectZero];
  [nested addSubview:webView];
  [host addSubview:nested];
  XCTAssertEqualObjects([RNGoogleMobileAdsWebViewRegistration findWebViewInView:host], webView);
}

- (void)testReturnsNilWhenAbsent {
  UIView *host = [[UIView alloc] initWithFrame:CGRectZero];
  [host addSubview:[[UIView alloc] initWithFrame:CGRectZero]];
  XCTAssertNil([RNGoogleMobileAdsWebViewRegistration findWebViewInView:host]);
  XCTAssertNil([RNGoogleMobileAdsWebViewRegistration findWebViewInView:nil]);
}

@end
