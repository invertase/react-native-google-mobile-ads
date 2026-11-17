package io.invertase.googlemobileads

import com.facebook.fbreact.specs.NativeIconAdModuleSpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE)
class ReactNativeGoogleMobileAdsIconAdModuleTest {
  @Test
  fun moduleNameMatchesTurboModule() {
    assertEquals(
      "RNGoogleMobileAdsIconAdModule",
      ReactNativeGoogleMobileAdsIconAdModule.NAME,
    )
    assertEquals(
      "google_mobile_ads_icon_ad_event",
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ICON_AD,
    )
  }

  @Test
  fun extendsNativeIconAdModuleSpec() {
    assertTrue(
      NativeIconAdModuleSpec::class.java.isAssignableFrom(
        ReactNativeGoogleMobileAdsIconAdModule::class.java,
      ),
    )
  }
}
