package io.invertase.googlemobileads

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.google.android.libraries.ads.mobile.sdk.appopen.AppOpenAd
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest

class ReactNativeGoogleMobileAdsAppOpenModule(
  reactContext: ReactApplicationContext?,
) : ReactNativeGoogleMobileAdsFullScreenAdModule<AppOpenAd>(reactContext, NAME) {
  override fun getAdEventName(): String = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_APP_OPEN

  @ReactMethod
  fun appOpenLoad(
    requestId: Int,
    adUnitId: String,
    adRequestOptions: ReadableMap,
  ) = load(requestId, adUnitId, adRequestOptions)

  @ReactMethod
  fun appOpenShow(
    requestId: Int,
    adUnitId: String,
    showOptions: ReadableMap,
    promise: Promise,
  ) = show(requestId, adUnitId, showOptions, promise)

  @ReactMethod
  fun appOpenDestroy(requestId: Int) = destroy(requestId)

  override fun loadAd(
    adRequest: AdRequest,
    adLoadCallback: AdLoadCallback<AppOpenAd>,
  ) {
    AppOpenAd.load(adRequest, adLoadCallback)
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsAppOpenModule"
  }
}
