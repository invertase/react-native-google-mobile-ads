package io.invertase.googlemobileads

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap

class ReactNativeGoogleMobileAdsRewardedModule(reactContext: ReactApplicationContext?) : NativeRewardedModuleSpec(reactContext) {

  private val instance: ReactNativeGoogleMobileAdsRewardedModuleImpl = ReactNativeGoogleMobileAdsRewardedModuleImpl(reactContext)
  override fun rewardedLoad(
    requestId: Double,
    adUnitId: String?,
    requestOptions: ReadableMap?
  ) {
//    instance.rewardedLoad()
  }

  override fun rewardedShow(
    requestId: Double,
    adUnitId: String?,
    showOptions: ReadableMap?,
    promise: Promise?
  ) {
//    instance.rewardedShow()
  }
  companion object {
    const val NAME = NativeRewardedModuleSpec.NAME
  }
}
