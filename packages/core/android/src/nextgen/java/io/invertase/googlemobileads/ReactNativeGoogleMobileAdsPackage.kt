package io.invertase.googlemobileads

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Compile-time placeholder until the Next-Gen Android implementation lands.
 */
@SuppressWarnings("unused")
class ReactNativeGoogleMobileAdsPackage : TurboReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? = failNotImplemented()

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      MODULE_NAMES.associateWith { name ->
        ReactModuleInfo(name, name, false, false, false, true)
      }
    }

  companion object {
    const val NOT_IMPLEMENTED_MESSAGE =
      "The react-native-google-mobile-ads Next-Gen Android backend is not implemented yet."

    private val MODULE_NAMES =
      listOf(
        "RNAppModule",
        "RNGoogleMobileAdsModule",
        "RNGoogleMobileAdsConsentModule",
        "RNGoogleMobileAdsAppOpenModule",
        "RNGoogleMobileAdsInterstitialModule",
        "RNGoogleMobileAdsRewardedModule",
        "RNGoogleMobileAdsRewardedInterstitialModule",
        "RNGoogleMobileAdsNativeModule",
        "RNGoogleMobileAdsPoolModule",
      )

    @JvmStatic
    fun failNotImplemented(): Nothing = throw UnsupportedOperationException(NOT_IMPLEMENTED_MESSAGE)
  }
}
