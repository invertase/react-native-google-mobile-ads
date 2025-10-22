package io.invertase.googlemobileads

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.google.android.gms.ads.admanager.AdManagerInterstitialAd

class ReactNativeGoogleMobileAdsInterstitialModule(reactContext: ReactApplicationContext?) :
  NativeInterstitialModuleSpec(reactContext) {

  private val instance: ReactNativeGoogleMobileAdsInterstitialModuleImpl = ReactNativeGoogleMobileAdsInterstitialModuleImpl(reactContext)
  override fun interstitialLoad(
    requestId: Double,
    adUnitId: String,
    requestOptions: ReadableMap?
  ) {
    instance.interstitialLoad(requestId.toInt(), adUnitId, requestOptions?: Arguments.createMap())
  }

  override fun interstitialShow(
    requestId: Double,
    adUnitId: String,
    showOptions: ReadableMap?,
    promise: Promise
  ) {
    instance.interstitialShow(requestId.toInt(), adUnitId, showOptions?: Arguments.createMap(),promise)
  }
  companion object {
    const val NAME = NativeInterstitialModuleSpec.NAME
  }
}
