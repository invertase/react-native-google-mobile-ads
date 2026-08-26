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
 *
 */

#import <GoogleMobileAds/GADNativeAd.h>
#import <React/RCTBridge.h>
#import <React/RCTUIManager.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <React/RCTViewComponentView.h>
#else
#import <React/RCTView.h>
#endif

NS_ASSUME_NONNULL_BEGIN

#ifdef RCT_NEW_ARCH_ENABLED
@interface RNGoogleMobileAdsMediaView : RCTViewComponentView

// this setters/getters here are provided by RCTViewComponentView super, we just narrow the type.
@property(nonatomic, strong, nullable) GADMediaView *contentView;
#else
@interface RNGoogleMobileAdsMediaView : GADMediaView

- (instancetype)initWithBridge:(RCTBridge *)bridge;
#endif

@property(nonatomic, copy) NSString *responseId;
@property(nonatomic, copy) NSString *resizeMode;

@end

#ifndef RCT_NEW_ARCH_ENABLED
@interface RNGoogleMobileAdsMediaViewManager : RCTViewManager

@end
#endif

NS_ASSUME_NONNULL_END
