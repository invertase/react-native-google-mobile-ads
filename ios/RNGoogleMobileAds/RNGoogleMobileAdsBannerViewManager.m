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

#import "RNGoogleMobileAdsBannerViewManager.h"
#import <GoogleMobileAds/GADBannerView.h>
#import <GoogleMobileAds/GADBannerViewDelegate.h>
#import <GoogleMobileAds/GADAppEventDelegate.h>
#import "RNGoogleMobileAdsCommon.h"

@interface BannerComponent : UIView <GADBannerViewDelegate, GADAppEventDelegate>

@property GADBannerView *banner;
@property(nonatomic, assign) CGFloat viewWidth;
@property(nonatomic, assign) BOOL requested;

@property(nonatomic, copy) NSArray *sizes;
@property(nonatomic, copy) NSString *unitId;
@property(nonatomic, copy) NSDictionary *request;

@property(nonatomic, copy) RCTBubblingEventBlock onNativeEvent;

- (void)requestAd;

@end

@implementation BannerComponent

- (void)reactSetFrame:(CGRect)frame {
  [super reactSetFrame:frame];
  CGFloat newWidth = CGRectGetWidth(frame);
  if (newWidth != _viewWidth) {
    _viewWidth = newWidth;
    [self requestAd];
  }
}

- (void)initBanner:(GADAdSize)adSize {
  if (_requested) {
    [_banner removeFromSuperview];
  }
  if ([RNGoogleMobileAdsCommon isAdManagerUnit:_unitId]) {
    _banner = [[GAMBannerView alloc] initWithAdSize:adSize];

    if ([_sizes containsObject:NSValueFromGADAdSize(GADAdSizeFluid)]) {
      CGRect frameRect = _banner.frame;
      frameRect.size.width = _viewWidth;
      _banner.frame = frameRect;
    }

    ((GAMBannerView *)_banner).validAdSizes = _sizes;
    ((GAMBannerView *)_banner).appEventDelegate = self;
  } else {
    _banner = [[GADBannerView alloc] initWithAdSize:adSize];
  }
  _banner.rootViewController = [UIApplication sharedApplication].delegate.window.rootViewController;
  _banner.delegate = self;
}

- (void)setUnitId:(NSString *)unitId {
  _unitId = unitId;
  [self requestAd];
}

- (void)setSizes:(NSArray *)sizes {
  __block NSMutableArray *adSizes = [[NSMutableArray alloc] initWithCapacity:sizes.count];
  [sizes enumerateObjectsUsingBlock:^(id jsonValue, NSUInteger idx, __unused BOOL *stop) {
    GADAdSize adSize = [RNGoogleMobileAdsCommon stringToAdSize:jsonValue];
    if (GADAdSizeEqualToSize(adSize, GADAdSizeInvalid)) {
      RCTLogWarn(@"Invalid adSize %@", jsonValue);
    } else {
      [adSizes addObject:NSValueFromGADAdSize(adSize)];
    }
  }];
  _sizes = adSizes;
  [self requestAd];
}

- (void)setRequest:(NSDictionary *)request {
  _request = request;
  [self requestAd];
}

- (void)requestAd {
#ifndef __LP64__
  return;  // prevent crash on 32bit
#endif

  if (_unitId == nil || _sizes == nil || _request == nil) {
    [self setRequested:NO];
    return;
  }

  if ([_sizes containsObject:NSValueFromGADAdSize(GADAdSizeFluid)] && _viewWidth == 0) {
    return;
  }

  [self initBanner:GADAdSizeFromNSValue(_sizes[0])];
  [self addSubview:_banner];
  _banner.adUnitID = _unitId;
  [self setRequested:YES];
  [_banner loadRequest:[RNGoogleMobileAdsCommon buildAdRequest:_request]];
  [self sendEvent:@"onSizeChange"
          payload:@{
            @"width" : @(_banner.bounds.size.width),
            @"height" : @(_banner.bounds.size.height),
          }];
}

- (void)sendEvent:(NSString *)type payload:(NSDictionary *_Nullable)payload {
  if (!self.onNativeEvent) {
    return;
  }

  NSMutableDictionary *event = [@{
    @"type" : type,
  } mutableCopy];

  if (payload != nil) {
    [event addEntriesFromDictionary:payload];
  }

  self.onNativeEvent(event);
}

- (void)bannerViewDidReceiveAd:(GADBannerView *)bannerView {
  [self sendEvent:@"onAdLoaded"
          payload:@{
            @"width" : @(bannerView.bounds.size.width),
            @"height" : @(bannerView.bounds.size.height),
          }];
}

- (void)bannerView:(GADBannerView *)bannerView didFailToReceiveAdWithError:(NSError *)error {
  NSDictionary *errorAndMessage = [RNGoogleMobileAdsCommon getCodeAndMessageFromAdError:error];
  [self sendEvent:@"onAdFailedToLoad" payload:errorAndMessage];
}

- (void)bannerViewWillPresentScreen:(GADBannerView *)bannerView {
  [self sendEvent:@"onAdOpened" payload:nil];
}

- (void)bannerViewWillDismissScreen:(GADBannerView *)bannerView {
  // not in use
}

- (void)bannerViewDidDismissScreen:(GADBannerView *)bannerView {
  [self sendEvent:@"onAdClosed" payload:nil];
}

- (void)bannerView:(GAMBannerView *)bannerView didReceiveAppEvent:(NSString *)name withInfo:(nullable NSString *)info {
  [self sendEvent:@"onAppEvent"
          payload:@{
            @"name" : name,
            @"data" : info,
          }];
}

@end

@implementation RNGoogleMobileAdsBannerViewManager

RCT_EXPORT_MODULE(RNGoogleMobileAdsBannerView);

RCT_EXPORT_VIEW_PROPERTY(sizes, NSArray);

RCT_EXPORT_VIEW_PROPERTY(unitId, NSString);

RCT_EXPORT_VIEW_PROPERTY(request, NSDictionary);

RCT_EXPORT_VIEW_PROPERTY(onNativeEvent, RCTBubblingEventBlock);

@synthesize bridge = _bridge;

- (UIView *)view {
  BannerComponent *banner = [BannerComponent new];
  return banner;
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

@end
