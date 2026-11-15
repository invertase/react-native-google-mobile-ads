package io.invertase.googlemobileads

/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import android.app.Activity
import android.os.Bundle
import android.util.DisplayMetrics
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.DisplayMetricsHolder
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.banner.AdView
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdRefreshCallback
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import io.invertase.googlemobileads.common.ReactNativeAdView
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLooper
import java.lang.reflect.Proxy

/**
 * Calls the production banner payload and current-ad seams. Refresh tests may keep stubbing those
 * seams so they do not need React Native maps. No Google auction/fill asserts ([GMA-AD-6]).
 */
@RunWith(RobolectricTestRunner::class)
@Config(
  sdk = [35],
  shadows = [
    ShadowReactArguments::class,
    ShadowWritableNativeMap::class,
    ShadowReadableNativeMap::class,
    ShadowWritableNativeArray::class,
    ShadowBannerAdLoad::class,
  ],
)
class ReactNativeGoogleMobileAdsBannerAdProductionSeamTest {
  private var previousScreenMetrics: DisplayMetrics? = null
  private lateinit var activity: Activity
  private lateinit var manager: WiringManager
  private lateinit var view: ReactNativeAdView
  private lateinit var adView: AdView

  @Before
  fun setUp() {
    previousScreenMetrics =
      try {
        DisplayMetricsHolder.getScreenDisplayMetrics()
      } catch (_: IllegalStateException) {
        null
      }
    val metrics = DisplayMetrics()
    metrics.density = 2f
    metrics.densityDpi = DisplayMetrics.DENSITY_XHIGH
    DisplayMetricsHolder.setScreenDisplayMetrics(metrics)

    activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    manager = WiringManager()
    view = ReactNativeAdView(ThemedReactContext(reactContext, activity))
    adView = AdView(activity)
    view.addView(adView)
    activity.setContentView(view)
    ShadowBannerAdLoad.loadCallback = null
    ShadowBannerAdLoad.lastRequest = null
    idle()
  }

  @After
  fun tearDown() {
    DisplayMetricsHolder.setScreenDisplayMetrics(previousScreenMetrics)
    ShadowBannerAdLoad.loadCallback = null
    ShadowBannerAdLoad.lastRequest = null
  }

  @Test
  fun currentBannerAdReturnsTheLoadedAdWhenTheGetterIsNull() {
    val loaded = banner()
    assertEquals(null, adView.getBannerAd())

    assertSame(loaded, manager.current(adView, loaded))
  }

  @Test
  fun currentBannerAdReturnsTheHostedAdWhenTheGetterIsNonNull() {
    val loaded = banner()
    val hosted = banner()
    val field =
      AdView::class.java.declaredFields.single { BannerAd::class.java.isAssignableFrom(it.type) }
    field.isAccessible = true
    field.set(adView, hosted)
    assertSame(hosted, adView.getBannerAd())

    assertSame(hosted, manager.current(adView, loaded))
  }

  @Test
  fun adLoadedPayloadConvertsPixelsToDipAndIncludesResponseInfo() {
    val payload = manager.loadedPayload(200, 100, responseInfo("payload-response"))

    assertEquals(100.0, payload.getDouble("width"), 0.001)
    assertEquals(50.0, payload.getDouble("height"), 0.001)
    assertEquals("payload-response", payload.getMap("responseInfo")?.getString("responseId"))
  }

  @Test
  fun adLoadedPayloadOmitsNullResponseInfo() {
    val payload = manager.loadedPayload(200, 100, null)

    assertEquals(100.0, payload.getDouble("width"), 0.001)
    assertEquals(50.0, payload.getDouble("height"), 0.001)
    assertFalse(payload.hasKey("responseInfo"))
  }

  @Test
  fun loadAdErrorPayloadMapsSharedFieldsAndResponseInfo() {
    val payload =
      manager.errorPayload(
        LoadAdError(LoadAdError.ErrorCode.NO_FILL, "No fill", responseInfo("error-response")),
      )

    assertEquals("no-fill", payload.getString("code"))
    assertEquals("No fill", payload.getString("message"))
    assertEquals("no-fill", payload.getString("reason"))
    assertEquals("load", payload.getString("phase"))
    assertEquals("error-response", payload.getMap("responseInfo")?.getString("responseId"))
  }

  @Test
  fun loadAdErrorPayloadOmitsNullResponseInfo() {
    val payload =
      manager.errorPayload(LoadAdError(LoadAdError.ErrorCode.INVALID_REQUEST, "", null))

    assertEquals("invalid-request", payload.getString("code"))
    assertEquals("", payload.getString("message"))
    assertEquals("invalid-request", payload.getString("reason"))
    assertEquals("load", payload.getString("phase"))
    assertFalse(payload.hasKey("responseInfo"))
  }

  @Test
  fun loadAdErrorPayloadMapsAnUnrecognisedCodeToUnknown() {
    val payload =
      manager.errorPayload(LoadAdError(LoadAdError.ErrorCode.TIMEOUT, "timed out", null))

    assertEquals("unknown", payload.getString("code"))
    assertEquals("timed out", payload.getString("message"))
    assertEquals("unknown", payload.getString("reason"))
    assertEquals("load", payload.getString("phase"))
    assertFalse(payload.hasKey("responseInfo"))
  }

  @Test
  fun loadSuccessSendsTheProductionDipPayload() {
    prepareLoad()
    val creative = FakeBanner()

    var laidOutWidth = -1
    var laidOutHeight = -1
    manager.onLoaded = {
      laidOutWidth = adView.width
      laidOutHeight = adView.height
    }
    manager.routeCommand(view, "load")
    ShadowBannerAdLoad.loadCallback!!.onAdLoaded(creative.proxy)
    idle()

    val widthPx = AdSize.BANNER.getWidthInPixels(view.context)
    val heightPx = AdSize.BANNER.getHeightInPixels(view.context)
    assertEquals(widthPx, laidOutWidth)
    assertEquals(heightPx, laidOutHeight)
    val event = manager.events.first { it.type == "onAdLoaded" }
    assertEquals("onAdLoaded", event.type)
    assertEquals(widthPx / 2.0, event.payload!!.getDouble("width"), 0.001)
    assertEquals(heightPx / 2.0, event.payload.getDouble("height"), 0.001)
    assertTrue(event.payload.getDouble("width") < widthPx)
    assertEquals("banner-load-response", event.payload.getMap("responseInfo")?.getString("responseId"))
    assertSame(manager.builtRefreshCallback, creative.refreshCallback)
  }

  @Test
  fun loadSuccessFluidEmitsHostDipSizeAndLayoutChanges() {
    prepareLoad()
    view.isFluid = true
    view.layout(0, 0, 300, 120)

    manager.routeCommand(view, "load")
    ShadowBannerAdLoad.loadCallback!!.onAdLoaded(FakeBanner().proxy)
    idle()

    val loaded = manager.events.first { it.type == "onAdLoaded" }
    assertEquals(150.0, loaded.payload!!.getDouble("width"), 0.001)
    assertEquals(60.0, loaded.payload.getDouble("height"), 0.001)

    val settled = manager.events.size
    adView.layout(0, 0, adView.width, adView.height)
    idle()
    assertEquals(settled, manager.events.size)

    adView.layout(0, 0, 40, 20)
    idle()
    val changed = manager.events.last()
    assertEquals("onSizeChange", changed.type)
    assertEquals(20.0, changed.payload!!.getDouble("width"), 0.001)
    assertEquals(10.0, changed.payload.getDouble("height"), 0.001)
  }

  @Test
  fun loadSuccessCollapsibleTracksAdPixelSizeChanges() {
    prepareLoad()
    view.isFluid = false
    view.layout(0, 0, 300, 120)
    val creative = FakeBanner(collapsible = true)

    var laidOutWidth = -1
    var laidOutHeight = -1
    manager.onLoaded = {
      laidOutWidth = adView.width
      laidOutHeight = adView.height
    }
    manager.routeCommand(view, "load")
    ShadowBannerAdLoad.loadCallback!!.onAdLoaded(creative.proxy)
    idle()

    assertTrue(view.isCollapsible)
    val widthPx = AdSize.BANNER.getWidthInPixels(view.context)
    val heightPx = AdSize.BANNER.getHeightInPixels(view.context)
    assertEquals(widthPx, laidOutWidth)
    assertEquals(heightPx, laidOutHeight)
    val loaded = manager.events.first { it.type == "onAdLoaded" }
    assertEquals(widthPx / 2.0, loaded.payload!!.getDouble("width"), 0.001)
    assertEquals(heightPx / 2.0, loaded.payload.getDouble("height"), 0.001)
    assertTrue(loaded.payload.getDouble("width") != 150.0)

    val settled = manager.events.size
    adView.layout(0, 0, adView.width, adView.height)
    idle()
    assertEquals(settled, manager.events.size)

    val nextWidth = adView.width + 30
    val nextHeight = adView.height + 16
    adView.layout(0, 0, nextWidth, nextHeight)
    idle()
    val changed = manager.events.last()
    assertEquals("onSizeChange", changed.type)
    assertEquals(nextWidth / 2.0, changed.payload!!.getDouble("width"), 0.001)
    assertEquals(nextHeight / 2.0, changed.payload.getDouble("height"), 0.001)
  }

  @Test
  fun loadFailureSendsTheProductionErrorPayload() {
    prepareLoad()

    manager.routeCommand(view, "load")
    ShadowBannerAdLoad.loadCallback!!.onAdFailedToLoad(
      LoadAdError(LoadAdError.ErrorCode.NO_FILL, "No fill", responseInfo("fail-response")),
    )
    idle()

    val event = manager.events.single()
    assertEquals("onAdFailedToLoad", event.type)
    assertEquals("no-fill", event.payload!!.getString("code"))
    assertEquals("No fill", event.payload.getString("message"))
    assertEquals("no-fill", event.payload.getString("reason"))
    assertEquals("load", event.payload.getString("phase"))
    assertEquals("fail-response", event.payload.getMap("responseInfo")?.getString("responseId"))
  }

  private fun prepareLoad() {
    view.setUnitId("/21775744923/example/banner")
    view.setSizes(listOf(AdSize.BANNER))
    view.setRequestOptions(JavaOnlyMap())
  }

  private fun idle() {
    shadowOf(activity.mainLooper).idle()
    ShadowLooper.idleMainLooper()
  }

  private fun responseInfo(id: String): ResponseInfo = ResponseInfo("adapter.class", id, Bundle(), null, emptyList())

  private fun banner(): BannerAd = FakeBanner().proxy

  private data class CapturedEvent(
    val type: String,
    val payload: WritableMap?,
  )

  private class WiringManager : ReactNativeGoogleMobileAdsBannerAdViewManager() {
    val events = mutableListOf<CapturedEvent>()
    var builtRefreshCallback: BannerAdRefreshCallback? = null
    var onLoaded: (() -> Unit)? = null

    fun current(
      adView: AdView,
      loaded: BannerAd,
    ): BannerAd = currentBannerAd(adView, loaded)

    fun loadedPayload(
      widthPx: Int,
      heightPx: Int,
      responseInfo: ResponseInfo?,
    ): WritableMap = adLoadedPayload(widthPx, heightPx, responseInfo)

    fun errorPayload(error: LoadAdError): WritableMap = loadAdErrorPayload(error)

    override fun buildRefreshCallback(
      view: ReactNativeAdView,
      adView: AdView,
      ad: BannerAd,
    ): BannerAdRefreshCallback {
      val callback = super.buildRefreshCallback(view, adView, ad)
      builtRefreshCallback = callback
      return callback
    }

    override fun sendEvent(
      view: ReactNativeAdView,
      type: String,
      payload: WritableMap?,
    ) {
      events += CapturedEvent(type, payload)
      if (type == "onAdLoaded") {
        onLoaded?.invoke()
      }
    }
  }

  private class FakeBanner(
    private val collapsible: Boolean = false,
  ) {
    var refreshCallback: BannerAdRefreshCallback? = null
    private val responseInfo =
      ResponseInfo("adapter.class", "banner-load-response", Bundle(), null, emptyList())

    val proxy: BannerAd =
      Proxy.newProxyInstance(
        BannerAd::class.java.classLoader,
        arrayOf(BannerAd::class.java),
      ) { proxy, method, args ->
        when (method.name) {
          "getAdSize" -> AdSize.BANNER
          "getResponseInfo" -> responseInfo
          "setAdEventCallback" -> null
          "setBannerAdRefreshCallback" -> {
            refreshCallback = args?.get(0) as BannerAdRefreshCallback?
            null
          }
          "isCollapsible" -> collapsible
          "toString" -> "FakeBanner"
          "hashCode" -> System.identityHashCode(proxy)
          "equals" -> proxy === args?.firstOrNull()
          else -> null
        }
      } as BannerAd
  }
}
