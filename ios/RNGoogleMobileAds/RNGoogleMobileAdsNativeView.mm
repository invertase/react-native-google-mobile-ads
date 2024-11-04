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

#import "RNGoogleMobileAdsNativeModule.h"
#import "RNGoogleMobileAdsNativeView.h"

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

@interface RNGoogleMobileAdsNativeView () <RCTRNGoogleMobileAdsNativeViewViewProtocol>
@end
#endif

@implementation RNGoogleMobileAdsNativeView {
  __weak RCTBridge *_bridge;
  __weak RNGoogleMobileAdsNativeModule *_nativeModule;
  __weak GADNativeAd *_nativeAd;
  GADNativeAdView *_nativeAdView;
  dispatch_block_t _debouncedReload;
}

#ifdef RCT_NEW_ARCH_ENABLED
#pragma mark - Fabric specific

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RNGoogleMobileAdsBannerViewProps>();
    _props = defaultProps;
    
    _bridge = [RCTBridge currentBridge];
    _nativeModule = [_bridge moduleForClass:RNGoogleMobileAdsNativeModule.class];
    _nativeAdView = [[GADNativeAdView alloc] init];
    self.contentView = _nativeAdView;
  }

  return self;
}

#pragma mark - RCTComponentViewProtocol

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<RNGoogleMobileAdsNativeViewComponentDescriptor>();
}

+ (BOOL)shouldBeRecycled
{
  return NO;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps = *std::static_pointer_cast<RNGoogleMobileAdsNativeViewProps const>(_props);
  const auto &newViewProps = *std::static_pointer_cast<RNGoogleMobileAdsNativeViewProps const>(props);
  
  if (oldViewProps.responseId != newViewProps.responseId) {
    NSString *responseId = [[NSString alloc] initWithUTF8String:newViewProps.responseId.c_str()];
    _nativeAd = [_nativeModule nativeAdForResponseId:responseId];
    [self reloadAd];
  }
  
  [super updateProps:props oldProps:oldProps];
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args {
  RCTRNGoogleMobileAdsNativeViewHandleCommand(self, commandName, args);
}

#else
#pragma mark - Paper specific

-(instancetype)initWithBridge:(RCTBridge *)bridge {
  if (self = [super init]) {
    _bridge = bridge;
    _nativeModule = [_bridge moduleForClass:RNGoogleMobileAdsNativeModule.class];
    _nativeAdView = self;
  }
  return self;
}

#endif // RCT_NEW_ARCH_ENABLED

- (void)registerAsset:(NSString *)assetKey reactTag:(NSInteger)reactTag {
  RCTExecuteOnMainQueue(^{
    UIView *view = [_bridge.uiManager viewForReactTag:@(reactTag)];
    [_nativeAdView setValue:view forKey:assetKey];
    [self reloadAd];
  });
}

- (void)reloadAd {
  if (_debouncedReload != nil) {
    dispatch_block_cancel(_debouncedReload);
  }
  _debouncedReload = dispatch_block_create(DISPATCH_BLOCK_NO_QOS_CLASS, ^{
    if (_nativeAd != nil) {
      _nativeAdView.nativeAd =_nativeAd;
      NSLog(@"%@", _nativeAd);
    }
  });
  dispatch_time_t time = dispatch_time(DISPATCH_TIME_NOW, 0.1 * NSEC_PER_SEC);
  dispatch_after(time, dispatch_get_main_queue(), _debouncedReload);
}

@end

@implementation RNGoogleMobileAdsNativeViewManager

RCT_EXPORT_MODULE(RNGoogleMobileAdsNativeView)

RCT_EXPORT_VIEW_PROPERTY(responseId, NSString)

#ifndef RCT_NEW_ARCH_ENABLED
- (UIView *)view
{
  return [[RNGoogleMobileAdsNativeView alloc] initWithBridge:self.bridge];
}
#endif

@end

#ifdef RCT_NEW_ARCH_ENABLED
Class<RCTComponentViewProtocol> RNGoogleMobileAdsNativeViewCls(void)
{
  return RNGoogleMobileAdsNativeView.class;
}
#endif
