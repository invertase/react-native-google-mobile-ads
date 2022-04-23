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

#import "RNGoogleMobileAdsFullScreenContentDelegate.h"

@implementation RNGoogleMobileAdsFullScreenContentDelegate

#pragma mark -
#pragma mark GADFullScreenContentDelegate Methods

/// Tells the delegate that the ad is about to present full screen content.
- (void)adWillPresentFullScreenContent:(nonnull id<GADFullScreenPresentingAd>)ad {
  [RNGoogleMobileAdsCommon sendAdEvent:_sendAdEvent
                             requestId:_requestId
                                  type:GOOGLE_MOBILE_ADS_EVENT_OPENED
                              adUnitId:_adUnitId
                                 error:nil
                                  data:nil];
}

/// Tells the delegate that the ad failed to present full screen content.
- (void)ad:(nonnull id<GADFullScreenPresentingAd>)ad
    didFailToPresentFullScreenContentWithError:(nonnull NSError *)error {
  NSDictionary *codeAndMessage = [RNGoogleMobileAdsCommon getCodeAndMessageFromAdError:error];
  [RNGoogleMobileAdsCommon sendAdEvent:_sendAdEvent
                             requestId:_requestId
                                  type:GOOGLE_MOBILE_ADS_EVENT_ERROR
                              adUnitId:_adUnitId
                                 error:codeAndMessage
                                  data:nil];
}

/// Tells the delegate that the ad dismissed full screen content.
- (void)adDidDismissFullScreenContent:(nonnull id<GADFullScreenPresentingAd>)ad {
  [RNGoogleMobileAdsCommon sendAdEvent:_sendAdEvent
                             requestId:_requestId
                                  type:GOOGLE_MOBILE_ADS_EVENT_CLOSED
                              adUnitId:_adUnitId
                                 error:nil
                                  data:nil];
}

/// Called when the ad receives an app event.
- (void)ad:(nonnull GADInterstitialAd *)ad
    didReceiveAppEvent:(nonnull NSString *)name
              withInfo:(nullable NSString *)info {
  [RNGoogleMobileAdsCommon sendAdEvent:_sendAdEvent
                             requestId:_requestId
                                  type:GOOGLE_MOBILE_ADS_EVENT_APP_EVENT
                              adUnitId:_adUnitId
                                 error:nil
                                  data:@{
                                    @"name" : name,
                                    @"data" : info,
                                  }];
}

@end
