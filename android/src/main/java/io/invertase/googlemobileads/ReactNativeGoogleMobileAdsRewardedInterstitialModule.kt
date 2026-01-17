package io.invertase.googlemobileads

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd

class ReactNativeGoogleMobileAdsRewardedInterstitialModule(reactContext: ReactApplicationContext?) :
  NativeRewardedInterstitialModuleSpec(reactContext) {

  private val instance: ReactNativeGoogleMobileAdsRewardedInterstitialModuleImpl =
    ReactNativeGoogleMobileAdsRewardedInterstitialModuleImpl(reactContext)

  override fun rewardedInterstitialLoad(
    requestId: Double,
    adUnitId: String,
    requestOptions: ReadableMap?
  ) {
    instance.rewardedInterstitialLoad(
      requestId.toInt(),
      adUnitId,
      requestOptions ?: Arguments.createMap()
    )
  }

  override fun rewardedInterstitialShow(
    requestId: Double,
    adUnitId: String,
    showOptions: ReadableMap?,
    promise: Promise
  ) {
    instance.rewardedInterstitialShow(
      requestId.toInt(),
      adUnitId,
      showOptions ?: Arguments.createMap(),
      promise
    )
  }

  companion object {
    const val NAME = NativeRewardedInterstitialModuleSpec.NAME
  }
}
