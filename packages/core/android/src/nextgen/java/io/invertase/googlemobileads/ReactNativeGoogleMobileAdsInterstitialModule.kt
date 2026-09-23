package io.invertase.googlemobileads

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAd

class ReactNativeGoogleMobileAdsInterstitialModule(
  reactContext: ReactApplicationContext?,
) : ReactNativeGoogleMobileAdsFullScreenAdModule<InterstitialAd>(reactContext, NAME) {
  override fun getAdEventName(): String = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_INTERSTITIAL

  @ReactMethod
  fun interstitialLoad(
    requestId: Int,
    adUnitId: String,
    adRequestOptions: ReadableMap,
  ) = load(requestId, adUnitId, adRequestOptions)

  @ReactMethod
  fun interstitialShow(
    requestId: Int,
    adUnitId: String,
    showOptions: ReadableMap,
    promise: Promise,
  ) = show(requestId, adUnitId, showOptions, promise)

  @ReactMethod
  fun interstitialDestroy(requestId: Int) = destroy(requestId)

  override fun loadAd(
    adRequest: AdRequest,
    adLoadCallback: AdLoadCallback<InterstitialAd>,
  ) {
    InterstitialAd.load(adRequest, adLoadCallback)
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsInterstitialModule"
  }
}
