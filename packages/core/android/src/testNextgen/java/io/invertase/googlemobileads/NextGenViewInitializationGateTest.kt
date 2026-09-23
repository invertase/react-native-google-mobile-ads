package io.invertase.googlemobileads

import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import io.invertase.googlemobileads.common.ReactNativeAdView
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class NextGenViewInitializationGateTest {
  @Before
  fun setUp() {
    NextGenMobileAdsGate.resetForTests()
  }

  @After
  fun tearDown() {
    NextGenMobileAdsGate.resetForTests()
  }

  @Test
  fun nativeAndMediaConstructionStaySdkFreeBeforeInitialization() {
    val context = BridgeReactContext(RuntimeEnvironment.getApplication())

    val nativeView = ReactNativeGoogleMobileAdsNativeAdView(context)
    val mediaView = ReactNativeGoogleMobileAdsMediaView(context)

    assertEquals(1, nativeView.childCount)
    assertEquals(0, mediaView.childCount)
    assertEquals(2, NextGenMobileAdsGate.pendingActionCount())
  }

  @Test
  fun bannerSizeResolutionWaitsForInitialization() {
    val view = ReactNativeAdView(RuntimeEnvironment.getApplication())
    val manager = ReactNativeGoogleMobileAdsBannerAdViewManager()

    manager.setSizeConfig(
      view,
      JavaOnlyMap.of(
        "width",
        320.0,
        "maxHeight",
        100.0,
        "sizes",
        JavaOnlyArray.of("ANCHORED_ADAPTIVE_BANNER"),
      ),
    )

    assertEquals(listOf("ANCHORED_ADAPTIVE_BANNER"), view.sizeNames)
    assertNull(view.sizes)
    assertEquals(1, NextGenMobileAdsGate.pendingActionCount())
  }
}
