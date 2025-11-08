package io.invertase.googlemobileads

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap

class ReactNativeGoogleMobileAdsRewardedModule(reactContext: ReactApplicationContext?) : NativeRewardedModuleSpec(reactContext) {

  private val instance: ReactNativeGoogleMobileAdsRewardedModuleImpl = ReactNativeGoogleMobileAdsRewardedModuleImpl(reactContext)
  override fun rewardedLoad(
    requestId: Double,
    adUnitId: String,
    requestOptions: ReadableMap
  ) {
    instance.rewardedLoad(requestId.toInt(), adUnitId,requestOptions)
  }

  override fun rewardedShow(
    requestId: Double,
    adUnitId: String,
    showOptions: ReadableMap?,
    promise: Promise
  ) {
    val processedShowOptions = showOptions ?: Arguments.createMap()
    instance.rewardedShow(requestId.toInt(),adUnitId, processedShowOptions , promise)
  }
  companion object {
    const val NAME = NativeRewardedModuleSpec.NAME
  }
}
