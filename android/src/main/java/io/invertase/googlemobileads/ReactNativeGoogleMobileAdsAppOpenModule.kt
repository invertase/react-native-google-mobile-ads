package io.invertase.googlemobileads

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.google.android.gms.ads.appopen.AppOpenAd

class ReactNativeGoogleMobileAdsAppOpenModule(reactContext: ReactApplicationContext?) :
  NativeAppOpenModuleSpec(reactContext) {

    private var instance: ReactNativeGoogleMobileAdsAppOpenModuleImpl = ReactNativeGoogleMobileAdsAppOpenModuleImpl(reactContext)
  override fun appOpenLoad(
    requestId: Double,
    adUnitId: String?,
    requestOptions: ReadableMap?
  ) {
//    instance.appOpenLoad()
  }

  override fun appOpenShow(
    requestId: Double,
    adUnitId: String?,
    showOptions: ReadableMap?,
    promise: Promise?
  ) {
//    instance.appOpenShow()
  }
  companion object{
  const val NAME = NativeAppOpenModuleSpec.NAME
  }
}
