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

#import "RNGoogleAdsFullScreenContentDelegate.h"

@implementation RNGoogleAdsFullScreenContentDelegate

#pragma mark -
#pragma mark Helper Methods

+ (void)sendInterstitialEvent:(NSString *)type
                    requestId:(NSNumber *)requestId
                     adUnitId:(NSString *)adUnitId
                        error:(nullable NSDictionary *)error {
  [RNGoogleAdsCommon sendAdEvent:GOOGLE_ADS_EVENT_INTERSTITIAL
                       requestId:requestId
                            type:type
                        adUnitId:adUnitId
                           error:error
                            data:nil];
}

#pragma mark -
#pragma mark GADFullScreenContentDelegate Methods

/// Tells the delegate that the ad failed to present full screen content.
- (void)ad:(nonnull id<GADFullScreenPresentingAd>)ad
didFailToPresentFullScreenContentWithError:(nonnull NSError *)error {
  NSDictionary *codeAndMessage = [RNGoogleAdsCommon getCodeAndMessageFromAdError:error];
  [RNGoogleAdsFullScreenContentDelegate sendInterstitialEvent:GOOGLE_ADS_EVENT_ERROR
                                               requestId:_requestId
                                                adUnitId:_adUnitId
                                                   error:codeAndMessage];
}

/// Tells the delegate that the ad presented full screen content.
- (void)adDidPresentFullScreenContent:(nonnull id<GADFullScreenPresentingAd>)ad {
  [RNGoogleAdsFullScreenContentDelegate sendInterstitialEvent:GOOGLE_ADS_EVENT_OPENED
                                               requestId:_requestId
                                                adUnitId:_adUnitId
                                                   error:nil];
}

/// Tells the delegate that the ad dismissed full screen content.
- (void)adDidDismissFullScreenContent:(nonnull id<GADFullScreenPresentingAd>)ad {
  [RNGoogleAdsFullScreenContentDelegate sendInterstitialEvent:GOOGLE_ADS_EVENT_CLOSED
                                             requestId:_requestId
                                              adUnitId:_adUnitId
                                                 error:nil];
}

@end
