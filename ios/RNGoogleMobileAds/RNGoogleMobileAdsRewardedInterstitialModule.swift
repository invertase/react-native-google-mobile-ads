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

#if !targetEnvironment(macCatalyst)

import Foundation
import GoogleMobileAds

@objc(RNGoogleMobileAdsRewardedInterstitialModule)
class RNGoogleMobileAdsRewardedInterstitialModule: NSObject {
  let ad = RNGoogleMobileAdsRewardedInterstitialAd()
  
  deinit {
    invalidate()
  }
  
  @objc
  func invalidate() {
    ad.invalidate()
  }
  
  @objc(rewardedInterstitialLoad:forAdUnitId:withAdRequestOptions:)
  func rewardedInterstitialLoad(
    requestId: NSNumber,
    adUnitId: String,
    adRequestOptions: Dictionary<String, Any>
  ) {
    ad.load(
      requestId: requestId.intValue,
      adUnitId: adUnitId,
      adRequestOptions: adRequestOptions
    )
  }
  
  @objc(rewardedInterstitialShow:forAdUnitId:withShowOptions:withResolve:withReject:)
  func rewardedInterstitialShow(
    requestId: NSNumber,
    adUnitId: String,
    showOptions: Dictionary<String, Any>,
    resolve: RCTPromiseResolveBlock?,
    reject: RCTPromiseRejectBlock?
  ) {
    ad.show(
      requestId: requestId.intValue,
      adUnitId: adUnitId,
      showOptions: showOptions,
      resolve: resolve,
      reject: reject
    )
  }
  
  class RNGoogleMobileAdsRewardedInterstitialAd: RNGoogleMobileAdsFullScreenAd<GADRewardedInterstitialAd> {
    override func getAdEventName() -> String {
      return GOOGLE_MOBILE_ADS_EVENT_REWARDED_INTERSTITIAL
    }
    
    override func loadAd(
      adUnitId: String,
      adRequest: GAMRequest,
      completionHandler: @escaping (GADRewardedInterstitialAd?, Error?) -> ()
    ) {
      GADRewardedInterstitialAd.load(
        withAdUnitID: adUnitId,
        request: adRequest,
        completionHandler: completionHandler
      )
    }
  }
}

#endif
