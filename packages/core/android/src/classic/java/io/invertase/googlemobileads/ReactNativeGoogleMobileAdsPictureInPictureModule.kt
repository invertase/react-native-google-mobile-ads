package io.invertase.googlemobileads

import com.facebook.fbreact.specs.NativePictureInPictureModuleSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import io.invertase.googlemobileads.common.ReactNativeModule

/**
 * Picture-in-picture ads require the GMA Next-Gen Android SDK and are unavailable on classic.
 */
@ReactModule(ReactNativeGoogleMobileAdsPictureInPictureModule.NAME)
class ReactNativeGoogleMobileAdsPictureInPictureModule(
  reactContext: ReactApplicationContext,
) : NativePictureInPictureModuleSpec(reactContext) {
  private fun unavailableError() =
    ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
      "picture-in-picture-unavailable",
      "Picture-in-picture ads require the Android Next-Gen Google Mobile Ads SDK (experimental).",
      "load",
    )

  override fun getName() = NAME

  override fun pictureInPictureLoad(
    requestId: Double,
    adUnitId: String,
    adRequestOptions: ReadableMap,
  ) {
    ReactNativeGoogleMobileAdsCommon.sendAdEvent(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PICTURE_IN_PICTURE,
      requestId.toInt(),
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
      adUnitId,
      unavailableError(),
      null,
    )
  }

  override fun pictureInPictureShow(
    requestId: Double,
    adUnitId: String,
    showOptions: ReadableMap?,
    promise: Promise,
  ) {
    ReactNativeModule.rejectPromiseWithCodeAndMessage(
      promise,
      "picture-in-picture-unavailable",
      "Picture-in-picture ads require the Android Next-Gen Google Mobile Ads SDK (experimental).",
    )
  }

  override fun pictureInPictureHide(requestId: Double) {
    // No-op on classic.
  }

  override fun pictureInPictureDestroy(requestId: Double) {
    // No-op on classic.
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsPictureInPictureModule"
  }
}
