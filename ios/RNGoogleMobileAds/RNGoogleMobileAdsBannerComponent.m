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

#import "RNGoogleMobileAdsBannerComponent.h"
#import <React/RCTLog.h>
#import "RNGoogleMobileAdsCommon.h"

@implementation RNGoogleMobileAdsBannerComponent

- (void)dealloc {
  if (_banner) {
    [_banner removeFromSuperview];
    _banner = nil;
  }
}

- (void)didSetProps:(NSArray<NSString *> *)changedProps {
  if (_propsChanged) {
    [self requestAd];
  }
  _propsChanged = false;
}

- (void)initBanner:(GADAdSize)adSize {
  if (_requested) {
    [_banner removeFromSuperview];
  }
  if ([RNGoogleMobileAdsCommon isAdManagerUnit:_unitId]) {
    _banner = [[GAMBannerView alloc] initWithAdSize:adSize];

    ((GAMBannerView *)_banner).validAdSizes = _sizes;
    ((GAMBannerView *)_banner).appEventDelegate = self;
    ((GAMBannerView *)_banner).enableManualImpressions = [_manualImpressionsEnabled boolValue];
  } else {
    _banner = [[GADBannerView alloc] initWithAdSize:adSize];
  }
  _banner.rootViewController = [UIApplication sharedApplication].delegate.window.rootViewController;
  _banner.delegate = self;
}

- (void)setUnitId:(NSString *)unitId {
  _unitId = unitId;
  _propsChanged = true;
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
  _propsChanged = true;
}

- (void)setRequest:(NSString *)request {
  NSData *jsonData = [request dataUsingEncoding:NSUTF8StringEncoding];
  NSError *error = nil;
  _request = [NSJSONSerialization JSONObjectWithData:jsonData options:kNilOptions error:&error];
  if (error) {
    NSLog(@"Error parsing JSON: %@", error.localizedDescription);
  }
  _propsChanged = true;
}

- (void)setManualImpressionsEnabled:(BOOL *)manualImpressionsEnabled {
  _manualImpressionsEnabled = [NSNumber numberWithBool:manualImpressionsEnabled];
  _propsChanged = true;
}

- (void)requestAd {
#ifndef __LP64__
  return;  // prevent crash on 32bit
#endif

  if (_unitId == nil || _sizes == nil || _request == nil || _manualImpressionsEnabled == nil) {
    [self setRequested:NO];
    return;
  }

  [self initBanner:GADAdSizeFromNSValue(_sizes[0])];
  [self addSubview:_banner];
  _banner.adUnitID = _unitId;
  [self setRequested:YES];
  _banner.paidEventHandler = ^(GADAdValue *_Nonnull value) {
    [self sendEvent:@"onPaid"
            payload:@{
              @"value" : value.value,
              @"precision" : @(value.precision),
              @"currency" : value.currencyCode,
            }];
  };
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

- (void)adView:(nonnull GADBannerView *)banner
    didReceiveAppEvent:(nonnull NSString *)name
              withInfo:(nullable NSString *)info {
  [self sendEvent:@"onAppEvent"
          payload:@{
            @"name" : name,
            @"data" : info,
          }];
}

- (void)recordManualImpression {
  if ([_banner class] == [GAMBannerView class]) {
    [((GAMBannerView *)_banner) recordImpression];
  }
}

@end

#endif
