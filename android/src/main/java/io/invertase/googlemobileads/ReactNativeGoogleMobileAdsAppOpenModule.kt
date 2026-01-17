package io.invertase.googlemobileads

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap

class ReactNativeGoogleMobileAdsAppOpenModule(reactContext: ReactApplicationContext?) :
  NativeAppOpenModuleSpec(reactContext) {

  private var instance: ReactNativeGoogleMobileAdsAppOpenModuleImpl =
    ReactNativeGoogleMobileAdsAppOpenModuleImpl(reactContext)

  override fun appOpenLoad(
    requestId: Double,
    adUnitId: String,
    requestOptions: ReadableMap?
  ) {
    instance.appOpenLoad(requestId.toInt(), adUnitId, requestOptions ?: Arguments.createMap())
  }

  override fun appOpenShow(
    requestId: Double,
    adUnitId: String,
    showOptions: ReadableMap?,
    promise: Promise
  ) {
    instance.appOpenShow(requestId.toInt(), adUnitId, showOptions ?: Arguments.createMap(), promise)
  }

  companion object {
    const val NAME = NativeAppOpenModuleSpec.NAME
  }
}
