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

#import "RNGoogleMobileAdsIconAdView.h"

#import <RNGoogleMobileAdsSpec/ComponentDescriptors.h>
#import <RNGoogleMobileAdsSpec/EventEmitters.h>
#import <RNGoogleMobileAdsSpec/Props.h>
#import <RNGoogleMobileAdsSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface RNGoogleMobileAdsIconAdView () <RCTRNGoogleMobileAdsIconAdViewViewProtocol>
@end

@implementation RNGoogleMobileAdsIconAdView

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RNGoogleMobileAdsIconAdViewProps>();
    _props = defaultProps;
  }
  return self;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<RNGoogleMobileAdsIconAdViewComponentDescriptor>();
}

+ (BOOL)shouldBeRecycled {
  return NO;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  [super updateProps:props oldProps:oldProps];
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args {
  RCTRNGoogleMobileAdsIconAdViewHandleCommand(self, commandName, args);
}

#pragma mark - RCTRNGoogleMobileAdsIconAdViewViewProtocol

- (void)registerAsset:(NSString *)assetType reactTag:(NSInteger)reactTag {
  // Icon ads are Android Next-Gen only; view registration is a no-op on iOS.
}

@end

Class<RCTComponentViewProtocol> RNGoogleMobileAdsIconAdViewCls(void) {
  return RNGoogleMobileAdsIconAdView.class;
}