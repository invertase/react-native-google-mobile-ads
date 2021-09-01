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

#import "RNAdMobRewardedDelegate.h"

@implementation RNAdMobRewardedDelegate

+ (instancetype)sharedInstance {
  static dispatch_once_t once;
  static RNAdMobRewardedDelegate *sharedInstance;
  dispatch_once(&once, ^{
    sharedInstance = [[RNAdMobRewardedDelegate alloc] init];
  });
  return sharedInstance;
}

#pragma mark -
#pragma mark Helper Methods

+ (void)sendRewardedEvent:(NSString *)type
                    requestId:(NSNumber *)requestId
                     adUnitId:(NSString *)adUnitId
                        error:(nullable NSDictionary *)error
                        data:(nullable NSDictionary *)data {
  [RNAdMobCommon sendAdEvent:EVENT_REWARDED requestId:requestId type:type adUnitId:adUnitId error:error data:data];
}


#pragma mark -
#pragma mark GADInterstitialDelegate Methods

/// Tells the delegate that the user earned a reward.
- (void)rewardedAd:(GADRewardedAd *)ad userDidEarnReward:(GADAdReward *)reward {
  NSDictionary *data = @{
      @"type": reward.type,
      @"amount": reward.amount,
  };
  [RNAdMobRewardedDelegate sendRewardedEvent:ADMOB_EVENT_REWARDED_EARNED_REWARD requestId:[(RNGADRewarded *) ad requestId] adUnitId:ad.adUnitID error:nil data:data];
}

/// Tells the delegate that the rewarded ad was presented.
- (void)rewardedAdDidPresent:(GADRewardedAd *)ad {
  [RNAdMobRewardedDelegate sendRewardedEvent:ADMOB_EVENT_OPENED requestId:[(RNGADRewarded *) ad requestId] adUnitId:ad.adUnitID error:nil data:nil];
}

/// Tells the delegate that the rewarded ad failed to present.
- (void)rewardedAd:(GADRewardedAd *)ad didFailToPresentWithError:(NSError *)error {
  NSMutableDictionary *userError = [@{
    @"code": @"unknown",
    @"message": error.localizedDescription,
  } mutableCopy];
  [RNAdMobRewardedDelegate sendRewardedEvent:ADMOB_EVENT_ERROR requestId:[(RNGADRewarded *) ad requestId] adUnitId:ad.adUnitID error:userError data:nil];
}

/// Tells the delegate that the rewarded ad was dismissed.
- (void)rewardedAdDidDismiss:(GADRewardedAd *)ad {
  [RNAdMobRewardedDelegate sendRewardedEvent:ADMOB_EVENT_CLOSED requestId:[(RNGADRewarded *) ad requestId] adUnitId:ad.adUnitID error:nil data:nil];
}

@end

