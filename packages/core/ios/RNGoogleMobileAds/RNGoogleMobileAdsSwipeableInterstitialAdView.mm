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

#if !TARGET_OS_MACCATALYST

#import "RNGoogleMobileAdsSwipeableInterstitialAdView.h"
#import <GoogleMobileAds/GADSwipeableInterstitialAd_Beta.h>
#import "RNGoogleMobileAdsSwipeableInterstitialAdModule.h"

#import <RNGoogleMobileAdsSpec/ComponentDescriptors.h>
#import <RNGoogleMobileAdsSpec/Props.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@implementation RNGoogleMobileAdsSwipeableInterstitialAdView {
  NSInteger _requestId;
  UIView *_attachedAdView;
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const RNGoogleMobileAdsSwipeableInterstitialAdViewProps>();
    _props = defaultProps;
    _requestId = 0;
  }
  return self;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<
      RNGoogleMobileAdsSwipeableInterstitialAdViewComponentDescriptor>();
}

+ (BOOL)shouldBeRecycled {
  return NO;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
      *std::static_pointer_cast<RNGoogleMobileAdsSwipeableInterstitialAdViewProps const>(_props);
  const auto &newViewProps =
      *std::static_pointer_cast<RNGoogleMobileAdsSwipeableInterstitialAdViewProps const>(props);

  if (oldViewProps.requestId != newViewProps.requestId) {
    _requestId = newViewProps.requestId;
    [self attachAdView];
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle {
  [super prepareForRecycle];
  [self detachAdView];
  static const auto defaultProps =
      std::make_shared<const RNGoogleMobileAdsSwipeableInterstitialAdViewProps>();
  _props = defaultProps;
  _requestId = 0;
}

- (void)attachAdView {
  [self detachAdView];
  if (_requestId == 0) {
    return;
  }
  GADSwipeableInterstitialAd *ad = [RNGoogleMobileAdsSwipeableInterstitialAdModule
      swipeableInterstitialAdForRequestId:(int)_requestId];
  if (ad == nil) {
    return;
  }
  UIView *adView = ad.adView;
  if (adView == nil) {
    return;
  }
  _attachedAdView = adView;
  adView.translatesAutoresizingMaskIntoConstraints = NO;
  [self addSubview:adView];
  [NSLayoutConstraint activateConstraints:@[
    [adView.topAnchor constraintEqualToAnchor:self.topAnchor],
    [adView.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
    [adView.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
    [adView.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
  ]];
}

- (void)detachAdView {
  [_attachedAdView removeFromSuperview];
  _attachedAdView = nil;
}

@end

Class<RCTComponentViewProtocol> RNGoogleMobileAdsSwipeableInterstitialAdViewCls(void) {
  return RNGoogleMobileAdsSwipeableInterstitialAdView.class;
}

#endif