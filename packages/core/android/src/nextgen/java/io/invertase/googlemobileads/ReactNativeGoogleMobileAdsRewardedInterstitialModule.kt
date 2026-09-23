package io.invertase.googlemobileads

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.rewardedinterstitial.RewardedInterstitialAd

class ReactNativeGoogleMobileAdsRewardedInterstitialModule(
  reactContext: ReactApplicationContext?,
) : ReactNativeGoogleMobileAdsFullScreenAdModule<RewardedInterstitialAd>(reactContext, NAME) {
  override fun getAdEventName(): String = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_INTERSTITIAL

  @ReactMethod
  fun rewardedInterstitialLoad(
    requestId: Int,
    adUnitId: String,
    adRequestOptions: ReadableMap,
  ) = load(requestId, adUnitId, adRequestOptions)

  @ReactMethod
  fun rewardedInterstitialShow(
    requestId: Int,
    adUnitId: String,
    showOptions: ReadableMap,
    promise: Promise,
  ) = show(requestId, adUnitId, showOptions, promise)

  @ReactMethod
  fun rewardedInterstitialDestroy(requestId: Int) = destroy(requestId)

  override fun loadAd(
    adRequest: AdRequest,
    adLoadCallback: AdLoadCallback<RewardedInterstitialAd>,
  ) {
    RewardedInterstitialAd.load(adRequest, adLoadCallback)
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsRewardedInterstitialModule"
  }
}
