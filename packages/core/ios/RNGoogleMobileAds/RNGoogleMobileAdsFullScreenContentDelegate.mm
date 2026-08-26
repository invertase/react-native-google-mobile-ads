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

#import "RNGoogleMobileAdsFullScreenContentDelegate.h"
#import "RNGoogleMobileAdsCommon.h"

@implementation RNGoogleMobileAdsFullScreenContentDelegate

- (instancetype)initWithAdEventName:(NSString *)adEventName
                          requestId:(int)requestId
                           adUnitId:(NSString *)adUnitId {
  if (self = [super init]) {
    _adEventName = adEventName;
    _requestId = requestId;
    _adUnitId = adUnitId;
  }
  return self;
}

- (void)adWillPresentFullScreenContent:(id<GADFullScreenPresentingAd>)ad {
  [self sendAdEventWithType:GOOGLE_MOBILE_ADS_EVENT_OPENED error:nil data:nil];
}

- (void)ad:(id<GADFullScreenPresentingAd>)ad
    didFailToPresentFullScreenContentWithError:(NSError *)error {
  NSDictionary *errorInfo = [RNGoogleMobileAdsCommon getCodeAndMessageFromAdError:error];
  [self sendAdEventWithType:GOOGLE_MOBILE_ADS_EVENT_ERROR error:errorInfo data:nil];
}

- (void)adDidDismissFullScreenContent:(id<GADFullScreenPresentingAd>)ad {
  [self sendAdEventWithType:GOOGLE_MOBILE_ADS_EVENT_CLOSED error:nil data:nil];
}

- (void)adDidRecordClick:(id<GADFullScreenPresentingAd>)ad {
  [self sendAdEventWithType:GOOGLE_MOBILE_ADS_EVENT_CLICKED error:nil data:nil];
}

- (void)adDidRecordImpression:(id<GADFullScreenPresentingAd>)ad {
  // Not implemented yet
}

- (void)interstitialAd:(GADInterstitialAd *)interstitialAd
    didReceiveAppEvent:(NSString *)name
              withInfo:(nullable NSString *)info {
  NSDictionary *data = @{@"name" : name, @"data" : info ?: @""};
  [self sendAdEventWithType:GOOGLE_MOBILE_ADS_EVENT_APP_EVENT error:nil data:data];
}

#pragma mark - Private

- (void)sendAdEventWithType:(NSString *)type
                      error:(nullable NSDictionary *)error
                       data:(nullable NSDictionary *)data {
  [RNGoogleMobileAdsCommon sendAdEvent:self.adEventName
                             requestId:@(self.requestId)
                                  type:type
                              adUnitId:self.adUnitId
                                 error:error
                                  data:data];
}

@end

#endif