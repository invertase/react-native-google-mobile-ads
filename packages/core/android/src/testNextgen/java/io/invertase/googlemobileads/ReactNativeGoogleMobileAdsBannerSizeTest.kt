package io.invertase.googlemobileads

import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import org.junit.Assert.assertEquals
import org.junit.Test

class ReactNativeGoogleMobileAdsBannerSizeTest {
  @Test
  fun mapsClassicNamedAndCustomSizes() {
    assertEquals(AdSize.BANNER, ReactNativeGoogleMobileAdsBannerSize.fromString("BANNER"))
    assertEquals(
      AdSize.MEDIUM_RECTANGLE,
      ReactNativeGoogleMobileAdsBannerSize.fromString("MEDIUM_RECTANGLE"),
    )
    val skyscraper = ReactNativeGoogleMobileAdsBannerSize.fromString("WIDE_SKYSCRAPER")
    assertEquals(160, skyscraper.width)
    assertEquals(600, skyscraper.height)
    val custom = ReactNativeGoogleMobileAdsBannerSize.fromString("300x100")
    assertEquals(300, custom.width)
    assertEquals(100, custom.height)
  }
}
