#if !targetEnvironment(macCatalyst)

import Foundation
import GoogleMobileAds

class RNGoogleMobileAdsFullScreenContentDelegate: NSObject, GADFullScreenContentDelegate, GADAppEventDelegate {
  let adEventName: String
  let requestId: Int
  let adUnitId: String
  
  init(adEventName: String, requestId: Int, adUnitId: String) {
    self.adEventName = adEventName
    self.requestId = requestId
    self.adUnitId = adUnitId
  }
  
  func adWillPresentFullScreenContent(_ ad: GADFullScreenPresentingAd) {
    sendAdEvent(
      type: GOOGLE_MOBILE_ADS_EVENT_OPENED,
      error: nil,
      data: nil
    )
  }
  
  func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
    sendAdEvent(
      type: GOOGLE_MOBILE_ADS_EVENT_ERROR,
      error: RNGoogleMobileAdsCommon.getCodeAndMessage(fromAdError: error) as? Dictionary<String, Any>,
      data: nil
    )
  }
  
  func adDidDismissFullScreenContent(_ ad: GADFullScreenPresentingAd) {
    sendAdEvent(
      type: GOOGLE_MOBILE_ADS_EVENT_CLOSED,
      error: nil,
      data: nil
    )
  }
  
  func adDidRecordClick(_ ad: GADFullScreenPresentingAd) {
    sendAdEvent(
      type: GOOGLE_MOBILE_ADS_EVENT_CLICKED,
      error: nil,
      data: nil
    )
  }
  
  func adDidRecordImpression(_ ad: GADFullScreenPresentingAd) {
    // Not implemented yet
  }
  
  func interstitialAd(_ interstitialAd: GADInterstitialAd, didReceiveAppEvent name: String, withInfo info: String?) {
    sendAdEvent(
      type: GOOGLE_MOBILE_ADS_EVENT_APP_EVENT,
      error: nil,
      data: [
        "name": name,
        "data": info ?? ""
      ]
    )
  }
  
  private func sendAdEvent(type: String, error: Dictionary<String, Any>?, data: Dictionary<String, Any>?) {
    RNGoogleMobileAdsCommon.sendAdEvent(
      adEventName,
      requestId: requestId as NSNumber,
      type: type,
      adUnitId: adUnitId,
      error: error,
      data: data
    )
  }
}

#endif
