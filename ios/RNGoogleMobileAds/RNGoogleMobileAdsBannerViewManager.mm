//
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

#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>
#ifdef RCT_NEW_ARCH_ENABLE

#else
#import "RNGoogleMobileAdsBannerComponent.h"
#endif

@interface RNGoogleMobileAdsBannerViewManager : RCTViewManager
@end

@implementation RNGoogleMobileAdsBannerViewManager

RCT_EXPORT_MODULE(RNGoogleMobileAdsBannerView);

RCT_EXPORT_VIEW_PROPERTY(sizes, NSArray);

RCT_EXPORT_VIEW_PROPERTY(unitId, NSString);

RCT_EXPORT_VIEW_PROPERTY(request, NSString);

RCT_EXPORT_VIEW_PROPERTY(manualImpressionsEnabled, BOOL);

RCT_EXPORT_VIEW_PROPERTY(onNativeEvent, RCTBubblingEventBlock);

RCT_EXPORT_METHOD(recordManualImpression : (nonnull NSNumber *)reactTag) {
#if !TARGET_OS_MACCATALYST
  [self.bridge.uiManager
      addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        RNGoogleMobileAdsBannerComponent *banner = viewRegistry[reactTag];
        if (!banner || ![banner isKindOfClass:[RNGoogleMobileAdsBannerComponent class]]) {
          RCTLogError(@"Cannot find NativeView with tag #%@", reactTag);
          return;
        }
        [banner recordManualImpression];
      }];
#endif
}

#ifdef RCT_NEW_ARCH_ENABLE

#else
@synthesize bridge = _bridge;

- (UIView *)view {
#if TARGET_OS_MACCATALYST
  return nil;
#else
  RNGoogleMobileAdsBannerComponent *banner = [RNGoogleMobileAdsBannerComponent new];
  return banner;
#endif
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}
#endif

@end
