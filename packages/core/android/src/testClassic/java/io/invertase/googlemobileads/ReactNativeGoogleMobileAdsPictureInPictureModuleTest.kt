package io.invertase.googlemobileads

import com.facebook.fbreact.specs.NativePictureInPictureModuleSpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE)
class ReactNativeGoogleMobileAdsPictureInPictureModuleTest {
  @Test
  fun moduleNameMatchesTurboModule() {
    assertEquals(
      "RNGoogleMobileAdsPictureInPictureModule",
      ReactNativeGoogleMobileAdsPictureInPictureModule.NAME,
    )
    assertEquals(
      "google_mobile_ads_picture_in_picture_event",
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PICTURE_IN_PICTURE,
    )
  }

  @Test
  fun extendsNativePictureInPictureModuleSpec() {
    assertTrue(
      NativePictureInPictureModuleSpec::class.java.isAssignableFrom(
        ReactNativeGoogleMobileAdsPictureInPictureModule::class.java,
      ),
    )
  }
}
