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

#import "RNGoogleMobileAdsMultiFormatBannerView.h"
#import "RNGoogleMobileAdsNativeModule.h"

#import <GoogleMobileAds/GAMBannerView.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <react/renderer/components/RNGoogleMobileAdsSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNGoogleMobileAdsSpec/EventEmitters.h>
#import <react/renderer/components/RNGoogleMobileAdsSpec/Props.h>
#import <react/renderer/components/RNGoogleMobileAdsSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"
#endif

#ifdef RCT_NEW_ARCH_ENABLED
using namespace facebook::react;

@interface RNGoogleMobileAdsMultiFormatBannerView () <
    RCTRNGoogleMobileAdsMultiFormatBannerViewViewProtocol>
@end
#endif

@implementation RNGoogleMobileAdsMultiFormatBannerView {
#ifndef RCT_NEW_ARCH_ENABLED
  __weak RCTBridge *_bridge;
#endif
  __weak GAMBannerView *_attachedBanner;
}

#ifdef RCT_NEW_ARCH_ENABLED
#pragma mark - Fabric specific

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const RNGoogleMobileAdsMultiFormatBannerViewProps>();
    _props = defaultProps;
  }
  return self;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<
      RNGoogleMobileAdsMultiFormatBannerViewComponentDescriptor>();
}

+ (BOOL)shouldBeRecycled {
  return NO;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
      *std::static_pointer_cast<RNGoogleMobileAdsMultiFormatBannerViewProps const>(_props);
  const auto &newViewProps =
      *std::static_pointer_cast<RNGoogleMobileAdsMultiFormatBannerViewProps const>(props);

  if (oldViewProps.handleId != newViewProps.handleId) {
    NSString *handleId = [[NSString alloc] initWithUTF8String:newViewProps.handleId.c_str()];
    [self setHandleId:handleId];
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle {
  [super prepareForRecycle];
  [self detachBanner];
  static const auto defaultProps =
      std::make_shared<const RNGoogleMobileAdsMultiFormatBannerViewProps>();
  _props = defaultProps;
  _handleId = nil;
}

#else
#pragma mark - Paper specific

- (instancetype)initWithBridge:(RCTBridge *)bridge {
  if (self = [super init]) {
    _bridge = bridge;
  }
  return self;
}

#endif  // RCT_NEW_ARCH_ENABLED

#pragma mark - Common

- (void)setHandleId:(NSString *)handleId {
  if (_handleId == handleId || [_handleId isEqualToString:handleId]) {
    return;
  }
  [self detachBanner];
  _handleId = [handleId copy];
  [self attachBanner];
}

- (void)attachBanner {
  if (_handleId.length == 0) {
    return;
  }
  GAMBannerView *banner = [RNGoogleMobileAdsNativeModule bannerViewForHandleId:_handleId];
  if (banner == nil) {
    return;
  }
  // Attach-only: do not call loadRequest.
  if (banner.superview != nil && banner.superview != self) {
    [banner removeFromSuperview];
  }
  banner.rootViewController = [UIApplication sharedApplication].delegate.window.rootViewController;
  banner.frame = self.bounds;
  banner.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [self addSubview:banner];
  _attachedBanner = banner;
}

- (void)detachBanner {
  GAMBannerView *banner = _attachedBanner;
  _attachedBanner = nil;
  if (banner != nil && banner.superview == self) {
    // removeFromSuperview only — destroyHandle owns destruction.
    [banner removeFromSuperview];
  }
}

- (void)dealloc {
  [self detachBanner];
}

@end

#ifndef RCT_NEW_ARCH_ENABLED

@implementation RNGoogleMobileAdsMultiFormatBannerViewManager

RCT_EXPORT_MODULE(RNGoogleMobileAdsMultiFormatBannerView)

RCT_EXPORT_VIEW_PROPERTY(handleId, NSString)

- (UIView *)view {
  return [[RNGoogleMobileAdsMultiFormatBannerView alloc] initWithBridge:self.bridge];
}

@end

#endif

#ifdef RCT_NEW_ARCH_ENABLED
Class<RCTComponentViewProtocol> RNGoogleMobileAdsMultiFormatBannerViewCls(void) {
  return RNGoogleMobileAdsMultiFormatBannerView.class;
}
#endif

#endif
