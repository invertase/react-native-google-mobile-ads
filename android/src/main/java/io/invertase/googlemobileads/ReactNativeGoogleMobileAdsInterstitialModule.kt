package io.invertase.googlemobileads

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.google.android.gms.ads.admanager.AdManagerInterstitialAd

class ReactNativeGoogleMobileAdsInterstitialModule(reactContext: ReactApplicationContext?) :
  NativeInterstitialModuleSpec(reactContext) {

  private val instance: ReactNativeGoogleMobileAdsInterstitialModuleImpl = ReactNativeGoogleMobileAdsInterstitialModuleImpl(reactContext)
  override fun interstitialLoad(
    requestId: Double,
    adUnitId: String?,
    requestOptions: ReadableMap?
  ) {
//    instance.interstitialLoad()
  }

  override fun interstitialShow(
    requestId: Double,
    adUnitId: String?,
    showOptions: ReadableMap?,
    promise: Promise?
  ) {
//    instance.interstitialShow()
  }
  companion object {
    const val NAME = NativeInterstitialModuleSpec.NAME
  }
}
