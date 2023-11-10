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

class RNGoogleMobileAdsFullScreenAd<T>: NSObject where T : GADFullScreenPresentingAd {  
  var adMap = Dictionary<Int, T>()
  var delegateMap = Dictionary<Int, RNGoogleMobileAdsFullScreenContentDelegate>()
  
  deinit {
    invalidate()
  }
  
  func invalidate() {
    adMap.removeAll()
    delegateMap.removeAll()
  }
  
  func getAdEventName() -> String {
    fatalError("Method `getAdEventName` must be overriden")
  }
  
  func loadAd(
    adUnitId: String,
    adRequest: GAMRequest,
    completionHandler: @escaping (_ ad: T?, _ error: Error?) -> ()
  ) {
    fatalError("Method `loadAd` must be overriden")
  }
  
  func sendAdEvent(
    _ type: String,
    requestId: Int,
    adUnitId: String,
    error: Dictionary<String, Any>?,
    data: Dictionary<String, Any>?
  ) {
    RNGoogleMobileAdsCommon.sendAdEvent(
      getAdEventName(),
      requestId: requestId as NSNumber,
      type: type,
      adUnitId: adUnitId,
      error: error,
      data: data
    )
  }
  
  //MARK: - Load function
  
  func load(
    requestId: Int,
    adUnitId: String,
    adRequestOptions: Dictionary<String, Any>
  ) {
    let adRequest = RNGoogleMobileAdsCommon.buildAdRequest(adRequestOptions)!
    
    let delegate = RNGoogleMobileAdsFullScreenContentDelegate(
      adEventName: getAdEventName(),
      requestId: requestId,
      adUnitId: adUnitId
    )
    
    let completionHandler = { (ad: T?, error: Error?) -> () in
      var eventType = GOOGLE_MOBILE_ADS_EVENT_LOADED
      var data: Dictionary<String, Any>? = nil
      if let error = error {
        let codeAndMessage = RNGoogleMobileAdsCommon.getCodeAndMessage(fromAdError: error)
        self.sendAdEvent(
          GOOGLE_MOBILE_ADS_EVENT_ERROR,
          requestId: requestId,
          adUnitId: adUnitId,
          error: codeAndMessage as? Dictionary<String, Any>,
          data: nil
        )
        return
      }
      
      let paidEventHandler = {(value: GADAdValue) in
        self.sendAdEvent(
          "paid",
          requestId: requestId,
          adUnitId: adUnitId,
          error: nil,
          data: [
            "value": value.value,
            "precision": value.precision.rawValue,
            "currency": value.currencyCode,
          ]
        );
      };

      (ad as? GADRewardedAd)?.paidEventHandler = paidEventHandler;
      (ad as? GADRewardedInterstitialAd)?.paidEventHandler = paidEventHandler;
      (ad as? GADInterstitialAd)?.paidEventHandler = paidEventHandler;
      (ad as? GADAppOpenAd)?.paidEventHandler = paidEventHandler;

      if (ad is GADRewardedAd || ad is GADRewardedInterstitialAd) {
        if let serverSideVerificationOptions =
            adRequestOptions["serverSideVerificationOptions"] as? Dictionary<String, Any> {
          let options = GADServerSideVerificationOptions()
          
          if let userId = serverSideVerificationOptions["userId"] as? String {
            options.userIdentifier = userId
          }
          if let customData = serverSideVerificationOptions["customData"] as? String {
            options.customRewardString = customData
          }
          
          if let ad = ad as? GADRewardedAd {
            ad.serverSideVerificationOptions = options
          }
          else if let ad = ad as? GADRewardedInterstitialAd {
            ad.serverSideVerificationOptions = options
          }
        }
        
        eventType = GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED
        
        let adReward = (ad as? GADRewardedAd)?.adReward ?? (ad as? GADRewardedInterstitialAd)?.adReward
        data = [
          "type": adReward!.type,
          "amount": adReward!.amount
        ]
      }
      
      if let ad = ad as? GAMInterstitialAd {
        ad.appEventDelegate = delegate
      }
      
      ad!.fullScreenContentDelegate = delegate
      
      self.adMap.updateValue(ad!, forKey: requestId)
      self.delegateMap.updateValue(delegate, forKey: requestId)
      self.sendAdEvent(
        eventType,
        requestId: requestId,
        adUnitId: adUnitId,
        error: nil,
        data: data
      )
    }
    
    loadAd(adUnitId: adUnitId, adRequest: adRequest, completionHandler: completionHandler)
  }
  
  //MARK: - Show function
  
  func show(
    requestId: Int,
    adUnitId: String,
    showOptions: Dictionary<String, Any>,
    resolve: RCTPromiseResolveBlock?,
    reject: RCTPromiseRejectBlock?
  ) {
    guard let viewController = RNGoogleMobileAdsCommon.currentViewController() else {
      RNSharedUtils.rejectPromise(userInfo: reject, userInfo: [
        "code" : "nil-vc",
        "message" : "Ad attempted to show but the current View Controller was nil.",
      ])
      return
    }
    
    guard let ad = adMap[requestId] else {
      RNSharedUtils.rejectPromise(userInfo: reject, userInfo: [
        "code" : "not-ready",
        "message" : "Ad attempted to show but was not ready.",
      ])
      return
    }
    
    var rewardData: Dictionary<String, Any>? = nil
    if let adReward =
        (ad as? GADRewardedAd)?.adReward ??
        (ad as? GADRewardedInterstitialAd)?.adReward {
      rewardData = [
        "type": adReward.type,
        "amount": adReward.amount
      ]
    }
    let userDidEarnRewardHandler = { () -> Void in
      self.sendAdEvent(
        GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD,
        requestId: requestId,
        adUnitId: adUnitId,
        error: nil,
        data: rewardData
      )
    }
    
    // TODO: Find way to compact this area
    if let ad = ad as? GADAppOpenAd {
      ad.present(fromRootViewController: viewController)
    }
    else if let ad = ad as? GADInterstitialAd {
      ad.present(fromRootViewController: viewController)
    }
    else if let ad = ad as? GADRewardedAd {
      ad.present(
        fromRootViewController: viewController,
        userDidEarnRewardHandler: userDidEarnRewardHandler
      )
    }
    else if let ad = ad as? GADRewardedInterstitialAd {
      ad.present(
        fromRootViewController: viewController,
        userDidEarnRewardHandler: userDidEarnRewardHandler
      )
    }
    
    resolve!(nil)
  }
}

#endif
