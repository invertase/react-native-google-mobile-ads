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

#import "RNGoogleMobileAdsNativeView.h"
#import "RNGoogleMobileAdsMediaView.h"
#import "RNGoogleMobileAdsNativeAdRegistry.h"
#import "RNGoogleMobileAdsNativeAssetInteraction.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNGoogleMobileAdsSpec/ComponentDescriptors.h>
#import <RNGoogleMobileAdsSpec/EventEmitters.h>
#import <RNGoogleMobileAdsSpec/Props.h>
#import <RNGoogleMobileAdsSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"
#endif

#ifdef RCT_NEW_ARCH_ENABLED
using namespace facebook::react;

@interface RNGoogleMobileAdsNativeView () <RCTRNGoogleMobileAdsNativeViewViewProtocol>
@end
#endif

@implementation RNGoogleMobileAdsNativeView {
#ifndef RCT_NEW_ARCH_ENABLED
  __weak RCTBridge *_bridge;
#endif
  __weak GADNativeAd *_nativeAd;
  GADNativeAdView *_nativeAdView;
  dispatch_block_t _debouncedReload;
  // Weak: asset views may already be gone when we tear down (#896 Fabric recycle).
  NSHashTable<UIView *> *_assetViewsDisabled;
}

#ifdef RCT_NEW_ARCH_ENABLED
#pragma mark - Fabric specific

@dynamic contentView;  // provided by superclass, but we narrow the type in our declaration

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RNGoogleMobileAdsNativeViewProps>();
    _props = defaultProps;

    _nativeAdView = [[GADNativeAdView alloc] init];
    self.contentView = _nativeAdView;
  }

  return self;
}

#pragma mark - RCTComponentViewProtocol

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<RNGoogleMobileAdsNativeViewComponentDescriptor>();
}

+ (BOOL)shouldBeRecycled {
  return NO;
}

- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                          index:(NSInteger)index {
  [_nativeAdView insertSubview:childComponentView atIndex:index];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView
                            index:(NSInteger)index {
  // Restore before the child re-enters Fabric's component-view recycle pool (#896).
  [RNGoogleMobileAdsNativeAssetInteraction
      restoreInteractionOnTrackedAssetViews:_assetViewsDisabled
                                  inSubtree:childComponentView];
  [childComponentView removeFromSuperview];
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
      *std::static_pointer_cast<RNGoogleMobileAdsNativeViewProps const>(_props);
  const auto &newViewProps =
      *std::static_pointer_cast<RNGoogleMobileAdsNativeViewProps const>(props);

  if (oldViewProps.responseId != newViewProps.responseId) {
    NSString *responseId = [[NSString alloc] initWithUTF8String:newViewProps.responseId.c_str()];
    [self setResponseId:responseId];
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args {
  RCTRNGoogleMobileAdsNativeViewHandleCommand(self, commandName, args);
}

- (UIView *)findViewByTag:(NSInteger)targetTag inView:(UIView *)parentView {
  for (UIView *subview in parentView.subviews) {
    if (subview.tag == targetTag) {
      return subview;
    }
    if ([subview isKindOfClass:[RCTViewComponentView class]]) {
      UIView *contentView = ((RCTViewComponentView *)subview).contentView;
      if (contentView && contentView.tag == targetTag) {
        return contentView;
      }
    }
    UIView *found = [self findViewByTag:targetTag inView:subview];
    if (found) return found;
  }
  return nil;
}

#else
#pragma mark - Paper specific

- (instancetype)initWithBridge:(RCTBridge *)bridge {
  if (self = [super init]) {
    _bridge = bridge;
    _nativeAdView = self;
  }
  return self;
}

#endif  // RCT_NEW_ARCH_ENABLED

#pragma mark - Common logics

- (void)setResponseId:(NSString *)responseId {
  _responseId = [responseId copy];
  _nativeAd = [RNGoogleMobileAdsNativeAdRegistry nativeAdForResponseId:responseId];
  [self reloadAd];
}

- (void)registerAsset:(NSString *)assetType reactTag:(NSInteger)reactTag {
  RCTExecuteOnMainQueue(^{
#ifdef RCT_NEW_ARCH_ENABLED
    UIView *view = [self findViewByTag:reactTag inView:_nativeAdView];
    if (!view) {
      view = [self findViewByTag:reactTag inView:self];
    }
#else
    UIView *view = [_bridge.uiManager viewForReactTag:@(reactTag)];
#endif
    if (!view) {
      RCTLogError(@"Cannot find NativeAssetView with tag #%zd while registering asset type %@",
                  reactTag, assetType);
      return;
    }

    if ([assetType isEqual:@"media"] && [view isKindOfClass:RNGoogleMobileAdsMediaView.class]) {
#ifdef RCT_NEW_ARCH_ENABLED
      GADMediaView *mediaView = ((RNGoogleMobileAdsMediaView *)view).contentView;
#else
      GADMediaView *mediaView = (RNGoogleMobileAdsMediaView *) view;
#endif
      [_nativeAdView setMediaView:mediaView];
      [self reloadAd];
      return;
    }

    NSDictionary *viewMappings = @{
      @"advertiser" : @"advertiserView",
      @"body" : @"bodyView",
      @"callToAction" : @"callToActionView",
      @"headline" : @"headlineView",
      @"price" : @"priceView",
      @"store" : @"storeView",
      @"starRating" : @"starRatingView",
      @"icon" : @"iconView",
      @"image" : @"imageView",
    };
    NSString *property = viewMappings[assetType];
    if (property) {
      UIView *previous = [_nativeAdView valueForKey:property];
      if (previous != nil && previous != view) {
        previous.userInteractionEnabled = YES;
        [self->_assetViewsDisabled removeObject:previous];
      }
      if (self->_assetViewsDisabled == nil) {
        self->_assetViewsDisabled = [NSHashTable weakObjectsHashTable];
      }
      [RNGoogleMobileAdsNativeAssetInteraction
          disableInteractionOnAssetView:view
                             trackingIn:self->_assetViewsDisabled];
      [_nativeAdView setValue:view forKey:property];
      [self reloadAd];
    }
  });
}

- (void)reloadAd {
  if (_debouncedReload != nil) {
    dispatch_block_cancel(_debouncedReload);
  }
  // Weak self: accessing ivars in a block otherwise retains self and prevents
  // dealloc (and thus #896 restore on teardown).
  __weak __typeof(self) weakSelf = self;
  _debouncedReload = dispatch_block_create(DISPATCH_BLOCK_NO_QOS_CLASS, ^{
    __strong __typeof(weakSelf) strongSelf = weakSelf;
    if (strongSelf == nil) {
      return;
    }
    if (strongSelf->_nativeAd != nil) {
      strongSelf->_nativeAdView.nativeAd = strongSelf->_nativeAd;
    }
  });
  dispatch_time_t time = dispatch_time(DISPATCH_TIME_NOW, 0.1 * NSEC_PER_SEC);
  dispatch_after(time, dispatch_get_main_queue(), _debouncedReload);
}

- (void)dealloc {
  [RNGoogleMobileAdsNativeAssetInteraction
      restoreInteractionOnTrackedAssetViews:_assetViewsDisabled];
  _nativeAdView = nil;
  if (_debouncedReload != nil) {
    dispatch_block_cancel(_debouncedReload);
    _debouncedReload = nil;
  }
}

@end

#ifndef RCT_NEW_ARCH_ENABLED

@implementation RNGoogleMobileAdsNativeViewManager

RCT_EXPORT_MODULE(RNGoogleMobileAdsNativeView)

RCT_EXPORT_VIEW_PROPERTY(responseId, NSString)

- (UIView *)view {
  return [[RNGoogleMobileAdsNativeView alloc] initWithBridge:self.bridge];
}

RCT_EXPORT_METHOD(registerAsset : (nonnull NSNumber *)reactTag assetType : (nonnull NSString *)
                      assetType assetReactTag : (nonnull NSNumber *)assetReactTag) {
  [self.bridge.uiManager
      addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        RNGoogleMobileAdsNativeView *view = viewRegistry[reactTag];
        if (!view || ![view isKindOfClass:[RNGoogleMobileAdsNativeView class]]) {
          RCTLogError(@"Cannot find NativeView with tag #%@", reactTag);
          return;
        }
        [view registerAsset:assetType reactTag:assetReactTag.intValue];
      }];
}

@end

#endif

#ifdef RCT_NEW_ARCH_ENABLED
Class<RCTComponentViewProtocol> RNGoogleMobileAdsNativeViewCls(void) {
  return RNGoogleMobileAdsNativeView.class;
}
#endif
