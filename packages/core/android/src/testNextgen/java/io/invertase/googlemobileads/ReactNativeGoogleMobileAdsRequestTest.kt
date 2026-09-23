package io.invertase.googlemobileads

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactNativeGoogleMobileAdsRequestTest {
  @Test
  fun buildAdRequest_mapsAdManagerFieldsWithoutRejectingUnitId() {
    val options =
      JavaOnlyMap.of(
        "requestNonPersonalizedAdsOnly",
        true,
        "networkExtras",
        JavaOnlyMap.of("mediation_key", "mediation_value"),
        "publisherProvidedSignals",
        JavaOnlyMap.of("IAB_AUDIENCE_1_1", JavaOnlyArray.of(1, 2)),
        "keywords",
        JavaOnlyArray.of("sports", "news"),
        "contentUrl",
        "https://example.com/article",
        "neighboringContentUrls",
        JavaOnlyArray.of("https://example.com/one", "https://example.com/two"),
        "requestAgent",
        "rngma-test",
        "customTargeting",
        JavaOnlyMap.of(
          "single",
          "value",
          "multiple",
          JavaOnlyArray.of("first", "second"),
        ),
        "publisherProvidedId",
        "publisher-user",
      )

    val request =
      ReactNativeGoogleMobileAdsCommon.buildAdRequest(
        "/21775744923/example/interstitial",
        options,
      )

    assertEquals("/21775744923/example/interstitial", request.adUnitId)
    assertEquals(setOf("sports", "news"), request.keywords)
    assertEquals("https://example.com/article", request.contentUrl)
    assertEquals(
      setOf("https://example.com/one", "https://example.com/two"),
      request.neighboringContentUrls,
    )
    assertEquals("rngma-test", request.requestAgent)
    assertEquals("publisher-user", request.publisherProvidedId)
    assertEquals("value", request.customTargeting["single"])
    assertEquals("first,second", request.customTargeting["multiple"])
    assertEquals("1", request.googleExtrasBundle.getString("npa"))
    assertEquals("mediation_value", request.googleExtrasBundle.getString("mediation_key"))
    assertEquals(
      arrayListOf(1, 2),
      request.googleExtrasBundle.getIntegerArrayList("IAB_AUDIENCE_1_1"),
    )
    assertTrue(request.googleExtrasBundle.containsKey("IAB_AUDIENCE_1_1"))
  }

  @Test
  fun bannerAndNativeBuilders_preserveGamUnitAndFormatConfiguration() {
    val options =
      JavaOnlyMap.of(
        "keywords",
        JavaOnlyArray.of("sports"),
        "customTargeting",
        JavaOnlyMap.of("section", "front"),
      )
    val banner =
      ReactNativeGoogleMobileAdsCommon.buildBannerAdRequest(
        "/21775744923/example/banner",
        listOf(AdSize.BANNER, AdSize.MEDIUM_RECTANGLE),
        options,
        true,
      )
    assertEquals("/21775744923/example/banner", banner.adUnitId)
    assertEquals(listOf(AdSize.BANNER, AdSize.MEDIUM_RECTANGLE), banner.adSizes)
    assertTrue(banner.manualImpressionRequested)
    assertEquals("front", banner.customTargeting["section"])

    val native =
      ReactNativeGoogleMobileAdsCommon
        .buildNativeAdRequestBuilder(
          "/21775744923/example/native",
          listOf(NativeAd.NativeAdType.NATIVE, NativeAd.NativeAdType.BANNER),
          options,
        ).build()
    assertEquals("/21775744923/example/native", native.adUnitId)
    assertEquals(
      listOf(NativeAd.NativeAdType.NATIVE, NativeAd.NativeAdType.BANNER),
      native.nativeAdTypes,
    )
    assertEquals(setOf("sports"), native.keywords)
  }

  @Test
  fun standardBanner_usesSingleSizeRequestShape() {
    val request =
      ReactNativeGoogleMobileAdsCommon.buildBannerAdRequest(
        "ca-app-pub-3940256099942544/6300978111",
        listOf(AdSize.BANNER),
        JavaOnlyMap(),
        false,
      )

    assertEquals(AdSize.BANNER, request.adSize)
    assertEquals(listOf(AdSize.BANNER), request.adSizes)
  }
}
