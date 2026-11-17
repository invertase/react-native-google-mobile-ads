package io.invertase.googlemobileads

import com.facebook.fbreact.specs.NativeSwipeableInterstitialAdModuleSpec
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * Swipeable interstitial ads require the GMA Next-Gen Android SDK and are unavailable on classic.
 */
@ReactModule(ReactNativeGoogleMobileAdsSwipeableInterstitialAdModule.NAME)
class ReactNativeGoogleMobileAdsSwipeableInterstitialAdModule(
  reactContext: ReactApplicationContext,
) : NativeSwipeableInterstitialAdModuleSpec(reactContext) {
  private fun unavailableError() =
    ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
      "swipeable-interstitial-unavailable",
      "Swipeable interstitial ads require the Android Next-Gen Google Mobile Ads SDK (private beta).",
      "load",
    )

  override fun getName() = NAME

  override fun swipeableInterstitialLoad(
    requestId: Double,
    adUnitId: String,
    adRequestOptions: ReadableMap,
  ) {
    ReactNativeGoogleMobileAdsCommon.sendAdEvent(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_SWIPEABLE_INTERSTITIAL,
      requestId.toInt(),
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
      adUnitId,
      unavailableError(),
      null,
    )
  }

  override fun swipeableInterstitialRecordCustomClickGesture(requestId: Double) {
    // No-op on classic.
  }

  override fun swipeableInterstitialDestroy(requestId: Double) {
    // No-op on classic.
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsSwipeableInterstitialAdModule"
  }
}
