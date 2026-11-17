package io.invertase.googlemobileads

import com.facebook.fbreact.specs.NativeIconAdModuleSpec
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * Icon ads require the GMA Next-Gen Android SDK and are unavailable on classic.
 */
@ReactModule(ReactNativeGoogleMobileAdsIconAdModule.NAME)
class ReactNativeGoogleMobileAdsIconAdModule(
  reactContext: ReactApplicationContext,
) : NativeIconAdModuleSpec(reactContext) {
  private fun unavailableError() =
    ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
      "icon-ad-unavailable",
      "Icon ads require the Android Next-Gen Google Mobile Ads SDK (experimental).",
      "load",
    )

  override fun getName() = NAME

  override fun iconAdLoad(
    requestId: Double,
    adUnitId: String,
    adRequestOptions: ReadableMap,
  ) {
    ReactNativeGoogleMobileAdsCommon.sendAdEvent(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ICON_AD,
      requestId.toInt(),
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
      adUnitId,
      unavailableError(),
      null,
    )
  }

  override fun iconAdDestroy(requestId: Double) {
    // No-op on classic.
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsIconAdModule"
  }
}
