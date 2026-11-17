package io.invertase.googlemobileads

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import io.invertase.googlemobileads.common.ReactNativeModule

/**
 * Picture-in-picture ads require the GMA Next-Gen Android SDK and are unavailable on classic.
 */
class ReactNativeGoogleMobileAdsPictureInPictureModule(
  reactContext: ReactApplicationContext?,
) : ReactNativeModule(reactContext, NAME) {
  private fun unavailableError() =
    ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
      "picture-in-picture-unavailable",
      "Picture-in-picture ads require the Android Next-Gen Google Mobile Ads SDK (experimental).",
      "load",
    )

  @ReactMethod
  fun pictureInPictureLoad(
    requestId: Int,
    adUnitId: String,
    @Suppress("UNUSED_PARAMETER") adRequestOptions: ReadableMap,
  ) {
    ReactNativeGoogleMobileAdsCommon.sendAdEvent(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PICTURE_IN_PICTURE,
      requestId,
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
      adUnitId,
      unavailableError(),
      null,
    )
  }

  @ReactMethod
  fun pictureInPictureShow(
    requestId: Int,
    @Suppress("UNUSED_PARAMETER") adUnitId: String,
    @Suppress("UNUSED_PARAMETER") showOptions: ReadableMap?,
    promise: Promise,
  ) {
    rejectPromiseWithCodeAndMessage(
      promise,
      "picture-in-picture-unavailable",
      "Picture-in-picture ads require the Android Next-Gen Google Mobile Ads SDK (experimental).",
    )
  }

  @ReactMethod
  fun pictureInPictureHide(
    @Suppress("UNUSED_PARAMETER") requestId: Int,
  ) {
    // No-op on classic.
  }

  @ReactMethod
  fun pictureInPictureDestroy(
    @Suppress("UNUSED_PARAMETER") requestId: Int,
  ) {
    // No-op on classic.
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsPictureInPictureModule"
  }
}
