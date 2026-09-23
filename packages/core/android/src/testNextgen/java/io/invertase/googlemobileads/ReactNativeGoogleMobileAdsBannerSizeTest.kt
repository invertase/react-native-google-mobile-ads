package io.invertase.googlemobileads

import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import io.invertase.googlemobileads.common.ReactNativeAdView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
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

  /**
   * Intentional alias: deprecated wire `ANCHORED_ADAPTIVE_BANNER` and
   * `LARGE_ANCHORED_ADAPTIVE_BANNER` both resolve via
   * [AdSize.getLargeAnchoredAdaptiveBannerAdSize] (TS already `@deprecated` ANCHORED → LARGE).
   */
  @Test
  fun anchoredAndLargeAnchoredWireValues_resolveViaLargeAnchored() {
    val view = ReactNativeAdView(RuntimeEnvironment.getApplication())
    val metrics = view.context.resources.displayMetrics
    val adWidth = (metrics.widthPixels / metrics.density).toInt()
    val expectedLarge = AdSize.getLargeAnchoredAdaptiveBannerAdSize(view.context, adWidth)
    val deprecatedAnchored =
      AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(view.context, adWidth)

    for (wire in listOf("ANCHORED_ADAPTIVE_BANNER", "LARGE_ANCHORED_ADAPTIVE_BANNER")) {
      val resolved = ReactNativeGoogleMobileAdsBannerSize.getAdSize(wire, view)
      assertTrue(wire, resolved.isLargeAnchoredAdaptiveBanner)
      assertFalse(wire, resolved.isAnchoredAdaptiveBanner)
      assertEquals(wire, expectedLarge, resolved)
      assertNotEquals(wire, deprecatedAnchored, resolved)
    }

    assertEquals(
      ReactNativeGoogleMobileAdsBannerSize.getAdSize("ANCHORED_ADAPTIVE_BANNER", view),
      ReactNativeGoogleMobileAdsBannerSize.getAdSize("LARGE_ANCHORED_ADAPTIVE_BANNER", view),
    )
  }
}
