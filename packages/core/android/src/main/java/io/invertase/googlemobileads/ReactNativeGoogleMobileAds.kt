package io.invertase.googlemobileads

/**
 * Stable native entry point for detecting the Android SDK backend linked into the application.
 */
object ReactNativeGoogleMobileAds {
  @JvmStatic
  val backend: String = BuildConfig.RNGMA_ANDROID_BACKEND
}
