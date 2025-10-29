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

#import "RNGoogleMobileAdsMediaView.h"
#import "RNGoogleMobileAdsNativeModule.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import <react/renderer/components/RNGoogleMobileAdsSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNGoogleMobileAdsSpec/EventEmitters.h>
#import <react/renderer/components/RNGoogleMobileAdsSpec/Props.h>
#import <react/renderer/components/RNGoogleMobileAdsSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"
#endif

@interface RCTBridge (Private)
+ (RCTBridge *)currentBridge;
@end

#ifdef RCT_NEW_ARCH_ENABLED
using namespace facebook::react;

@interface RNGoogleMobileAdsMediaView () <RCTRNGoogleMobileAdsMediaViewViewProtocol>
@end
#endif

@implementation RNGoogleMobileAdsMediaView {
  __weak RCTBridge *_bridge;
  __weak RNGoogleMobileAdsNativeModule *_nativeModule;
  GADMediaView *_mediaView;
  UIViewContentMode _contentMode;
}

#ifdef RCT_NEW_ARCH_ENABLED
#pragma mark - Fabric specific

@dynamic contentView;  // provided by superclass, but we narrow the type in our declaration

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RNGoogleMobileAdsBannerViewProps>();
    _props = defaultProps;

    _bridge = [RCTBridge currentBridge];
    _nativeModule = [_bridge moduleForClass:RNGoogleMobileAdsNativeModule.class];
    _mediaView = [[GADMediaView alloc] init];
    _contentMode = UIViewContentModeScaleAspectFill;
    self.contentView = _mediaView;
  }

  return self;
}

#pragma mark - RCTComponentViewProtocol

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<RNGoogleMobileAdsMediaViewComponentDescriptor>();
}

+ (BOOL)shouldBeRecycled {
  return NO;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
      *std::static_pointer_cast<RNGoogleMobileAdsMediaViewProps const>(_props);
  const auto &newViewProps =
      *std::static_pointer_cast<RNGoogleMobileAdsMediaViewProps const>(props);

  if (oldViewProps.responseId != newViewProps.responseId) {
    NSString *responseId = [[NSString alloc] initWithUTF8String:newViewProps.responseId.c_str()];
    [self setResponseId:responseId];
  }

  if (oldViewProps.resizeMode != newViewProps.resizeMode) {
    NSString *resizeMode = [[NSString alloc] initWithUTF8String:newViewProps.resizeMode.c_str()];
    [self setResizeMode:resizeMode];
  }

  [super updateProps:props oldProps:oldProps];
}

#else
#pragma mark - Paper specific

- (instancetype)initWithBridge:(RCTBridge *)bridge {
  if (self = [super init]) {
    _bridge = bridge;
    _nativeModule = [_bridge moduleForClass:RNGoogleMobileAdsNativeModule.class];
    _mediaView = self;
  }
  return self;
}

#endif  // RCT_NEW_ARCH_ENABLED

#pragma mark - Common logics

- (void)setResponseId:(NSString *)responseId {
  _responseId = responseId;
  GADNativeAd *nativeAd = [_nativeModule nativeAdForResponseId:responseId];
  _mediaView.mediaContent = nativeAd.mediaContent;
  _mediaView.contentMode = _contentMode;
}

- (void)setResizeMode:(NSString *)resizeMode {
  _resizeMode = resizeMode;
  if ([resizeMode isEqualToString:@"cover"]) {
    _contentMode = UIViewContentModeScaleAspectFill;
  } else if ([resizeMode isEqualToString:@"contain"]) {
    _contentMode = UIViewContentModeScaleAspectFit;
  } else if ([resizeMode isEqualToString:@"stretch"]) {
    _contentMode = UIViewContentModeScaleToFill;
  }
  _mediaView.contentMode = _contentMode;
}

@end

#ifndef RCT_NEW_ARCH_ENABLED

@implementation RNGoogleMobileAdsMediaViewManager

RCT_EXPORT_MODULE(RNGoogleMobileAdsMediaView)

RCT_EXPORT_VIEW_PROPERTY(responseId, NSString)
RCT_EXPORT_VIEW_PROPERTY(resizeMode, NSString)

- (UIView *)view {
  return [[RNGoogleMobileAdsMediaView alloc] initWithBridge:self.bridge];
}

@end

#endif

#ifdef RCT_NEW_ARCH_ENABLED
Class<RCTComponentViewProtocol> RNGoogleMobileAdsMediaViewCls(void) {
  return RNGoogleMobileAdsMediaView.class;
}
#endif
