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

#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Locates a WKWebView for GMA `-[GADMobileAds registerWebView:]`
 * (#855). Host wrappers (e.g. react-native-webview) are walked for a nested
 * WKWebView. Safe for the lightweight XCTest harness (UIKit + WebKit only; no GMA).
 */
@interface RNGoogleMobileAdsWebViewRegistration : NSObject

/** Depth-first: prefer `root` when it is already a WKWebView. */
+ (nullable WKWebView *)findWebViewInView:(nullable UIView *)root;

@end

NS_ASSUME_NONNULL_END
