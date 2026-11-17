package io.invertase.googlemobileads

import com.facebook.fbreact.specs.NativeSwipeableInterstitialAdModuleSpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE)
class ReactNativeGoogleMobileAdsSwipeableInterstitialAdModuleTest {
  @Test
  fun moduleNameMatchesTurboModule() {
    assertEquals(
      "RNGoogleMobileAdsSwipeableInterstitialAdModule",
      ReactNativeGoogleMobileAdsSwipeableInterstitialAdModule.NAME,
    )
    assertEquals(
      "google_mobile_ads_swipeable_interstitial_event",
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_SWIPEABLE_INTERSTITIAL,
    )
  }

  @Test
  fun extendsNativeSwipeableInterstitialAdModuleSpec() {
    assertTrue(
      NativeSwipeableInterstitialAdModuleSpec::class.java.isAssignableFrom(
        ReactNativeGoogleMobileAdsSwipeableInterstitialAdModule::class.java,
      ),
    )
  }
}
