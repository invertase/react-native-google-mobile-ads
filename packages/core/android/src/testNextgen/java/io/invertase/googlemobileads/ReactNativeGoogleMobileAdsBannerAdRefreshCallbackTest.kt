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
import android.content.Context
import android.os.Bundle
import android.view.ViewGroup
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.banner.AdView
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdRefreshCallback
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.PrecisionType
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import io.invertase.googlemobileads.common.ReactNativeAdView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.robolectric.shadows.ShadowLooper
import org.robolectric.shadows.ShadowViewGroup
import java.lang.reflect.Proxy

/**
 * Next-Gen automatic banner refreshes emit the same onAdLoaded / onAdFailedToLoad events as the
 * classic backend's AdListener, and only for the AdView still hosted. No Google auction/fill
 * asserts ([GMA-AD-6]).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactNativeGoogleMobileAdsBannerAdRefreshCallbackTest {
  private lateinit var activity: Activity
  private lateinit var manager: CapturingBannerManager
  private lateinit var view: CountingAdView
  private lateinit var adView: AdView
  private val banner = FakeBannerAd()
  private val error = LoadAdError(LoadAdError.ErrorCode.NO_FILL, "No fill", null)

  @Before
  fun setUp() {
    activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    manager = CapturingBannerManager()
    view = CountingAdView(ThemedReactContext(reactContext, activity))
    adView = AdView(activity)
    view.addView(adView)
    activity.setContentView(view)
    idle()
  }

  @Test
  @Config(shadows = [ShadowBannerAdLoad::class])
  fun loadSuccessRegistersTheRefreshCallbackFromBuildRefreshCallback() {
    ShadowBannerAdLoad.loadCallback = null
    ShadowBannerAdLoad.lastRequest = null
    view.setUnitId("/21775744923/example/banner")
    view.setSizes(listOf(AdSize.BANNER))
    view.setRequestOptions(JavaOnlyMap())
    manager.setManualImpressionsEnabled(view, true)

    manager.routeCommand(view, "load")

    val request = ShadowBannerAdLoad.lastRequest
    assertNotNull(request)
    assertEquals("/21775744923/example/banner", request!!.adUnitId)
    assertTrue(request.adSizes.contains(AdSize.BANNER))
    assertTrue(request.manualImpressionRequested)
    val loadCallback = ShadowBannerAdLoad.loadCallback
    assertNotNull(loadCallback)
    loadCallback!!.onAdLoaded(banner.proxy)
    idle()

    assertNotNull(manager.builtRefreshCallback)
    assertSame(manager.builtRefreshCallback, banner.refreshCallback)
    assertNotNull(banner.eventCallback)
  }

  @Test
  @Config(shadows = [ShadowBannerAdLoad::class])
  fun loadAdOmitsManualImpressionWhenDisabled() {
    ShadowBannerAdLoad.lastRequest = null
    view.setUnitId("/21775744923/example/banner")
    view.setSizes(listOf(AdSize.BANNER))
    view.setRequestOptions(JavaOnlyMap())

    manager.routeCommand(view, "load")

    assertFalse(ShadowBannerAdLoad.lastRequest!!.manualImpressionRequested)
  }

  @Test
  @Config(shadows = [ShadowBannerAdLoad::class])
  fun loadSuccessReblocksHardwareBackOnTheAdViewAndHost() {
    armHardwareBackFocus()
    ShadowBannerAdLoad.loadCallback = null
    prepareLoad()

    manager.routeCommand(view, "load")
    ShadowBannerAdLoad.loadCallback!!.onAdLoaded(banner.proxy)
    idle()

    assertHardwareBackBlocked(adView)
    assertHardwareBackBlocked(view)
  }

  @Test
  @Config(shadows = [ShadowBannerAdLoad::class])
  fun loadSuccessKicksBannerPresentation() {
    ShadowBannerAdLoad.loadCallback = null
    prepareLoad()
    val before = view.presentationRefreshes

    manager.routeCommand(view, "load")
    ShadowBannerAdLoad.loadCallback!!.onAdLoaded(banner.proxy)
    idle()

    assertTrue(view.presentationRefreshes > before)
  }

  @Test
  @Config(shadows = [ShadowBannerAdLoad::class])
  fun loadSuccessStoresCollapsibleFromTheLoadedAd() {
    ShadowBannerAdLoad.loadCallback = null
    prepareLoad()

    manager.routeCommand(view, "load")
    ShadowBannerAdLoad.loadCallback!!.onAdLoaded(FakeBannerAd(collapsible = true).proxy)
    idle()

    assertTrue(view.isCollapsible)
  }

  @Test
  @Config(shadows = [ShadowBannerAdLoad::class])
  fun loadSuccessStoresNonCollapsibleFromTheLoadedAd() {
    ShadowBannerAdLoad.loadCallback = null
    prepareLoad()

    manager.routeCommand(view, "load")
    ShadowBannerAdLoad.loadCallback!!.onAdLoaded(banner.proxy)
    idle()

    assertFalse(view.isCollapsible)
  }

  @Test
  @Config(shadows = [ShadowBannerAdLoad::class])
  fun loadSuccessLaysOutAFixedBannerAndSkipsSizeTracking() {
    ShadowBannerAdLoad.loadCallback = null
    prepareLoad()
    view.isFluid = false

    manager.routeCommand(view, "load")
    ShadowBannerAdLoad.loadCallback!!.onAdLoaded(banner.proxy)
    idle()

    assertEquals(AdSize.BANNER.getWidthInPixels(activity), adView.width)
    assertEquals(AdSize.BANNER.getHeightInPixels(activity), adView.height)
    assertEquals("onAdLoaded", manager.events.single().type)
    adView.layout(0, 0, adView.width + 40, adView.height + 20)
    idle()
    assertEquals("onAdLoaded", manager.events.single().type)
  }

  @Test
  @Config(shadows = [ShadowBannerAdLoad::class])
  fun loadSuccessFluidPassesTheHostViewSize() {
    ShadowBannerAdLoad.loadCallback = null
    prepareLoad()
    view.isFluid = true
    view.layout(0, 0, 300, 120)
    adView.layout(0, 0, 11, 22)

    manager.routeCommand(view, "load")
    ShadowBannerAdLoad.loadCallback!!.onAdLoaded(banner.proxy)
    idle()

    val event = manager.events.single()
    assertEquals("onAdLoaded", event.type)
    assertEquals(300, event.payload?.getInt("widthPx"))
    assertEquals(120, event.payload?.getInt("heightPx"))
    assertEquals(11, adView.width)
    assertEquals(22, adView.height)
  }

  @Test
  fun refreshEmitsOnAdLoadedWithTheRefreshedSizeAndResponseInfo() {
    manager.buildRefreshCallback(view, adView, banner.proxy).onAdRefreshed()
    idle()

    val event = manager.events.single()
    assertEquals("onAdLoaded", event.type)
    assertEquals(AdSize.BANNER.getWidthInPixels(activity), event.payload?.getInt("widthPx"))
    assertEquals(AdSize.BANNER.getHeightInPixels(activity), event.payload?.getInt("heightPx"))
    assertEquals("banner-refresh-response", event.payload?.getString("responseId"))
  }

  @Test
  fun fluidRefreshReportsTheHostViewSize() {
    view.isFluid = true
    view.layout(0, 0, 300, 120)

    manager.buildRefreshCallback(view, adView, banner.proxy).onAdRefreshed()
    idle()

    val event = manager.events.single()
    assertEquals("onAdLoaded", event.type)
    assertEquals(300, event.payload?.getInt("widthPx"))
    assertEquals(120, event.payload?.getInt("heightPx"))
  }

  @Test
  fun refreshResizesTheAdViewToTheRefreshedSize() {
    val first = AdSize.BANNER
    adView.measure(first.getWidthInPixels(activity), first.getHeightInPixels(activity))
    adView.layout(0, 0, first.getWidthInPixels(activity), first.getHeightInPixels(activity))
    val taller = FakeBannerAd(AdSize.LARGE_BANNER)

    manager.buildRefreshCallback(view, adView, taller.proxy).onAdRefreshed()
    idle()

    assertEquals(AdSize.LARGE_BANNER.getWidthInPixels(activity), adView.width)
    assertEquals(AdSize.LARGE_BANNER.getHeightInPixels(activity), adView.height)
    assertEquals(
      adView.height,
      manager.events
        .single()
        .payload
        ?.getInt("heightPx"),
    )
  }

  @Test
  fun refreshMovesClickAndPaidEventsToASwappedBannerAd() {
    val swapped = FakeBannerAd()
    manager.currentAd = swapped.proxy

    manager.buildRefreshCallback(view, adView, banner.proxy).onAdRefreshed()
    idle()
    manager.events.clear()
    swapped.eventCallback!!.onAdClicked()
    idle()

    assertEquals("onAdClicked", manager.events.single().type)

    manager.events.clear()
    swapped.eventCallback!!.onAdPaid(AdValue(PrecisionType.PRECISE, 42, "USD"))
    idle()

    val paid = manager.events.single()
    assertEquals("onPaid", paid.type)
    assertEquals("USD", paid.payload?.getString("currency"))
    assertEquals("42", paid.payload?.getString("valueMicros"))
  }

  @Test
  fun refreshResizesToTheSwappedBannerAdSize() {
    val loaded = FakeBannerAd(AdSize.BANNER)
    val swapped = FakeBannerAd(AdSize.MEDIUM_RECTANGLE)
    manager.currentAd = swapped.proxy
    adView.layout(0, 0, 1, 1)

    manager.buildRefreshCallback(view, adView, loaded.proxy).onAdRefreshed()
    idle()

    val width = AdSize.MEDIUM_RECTANGLE.getWidthInPixels(activity)
    val height = AdSize.MEDIUM_RECTANGLE.getHeightInPixels(activity)
    assertTrue(width != AdSize.BANNER.getWidthInPixels(activity))
    assertTrue(height != AdSize.BANNER.getHeightInPixels(activity))
    assertEquals(width, adView.width)
    assertEquals(height, adView.height)
    val event = manager.events.single()
    assertEquals(width, event.payload?.getInt("widthPx"))
    assertEquals(height, event.payload?.getInt("heightPx"))
  }

  @Test
  fun refreshReblocksHardwareBackOnTheAdViewAndHost() {
    armHardwareBackFocus()

    manager.buildRefreshCallback(view, adView, banner.proxy).onAdRefreshed()
    idle()

    assertHardwareBackBlocked(adView)
    assertHardwareBackBlocked(view)
  }

  @Test
  fun refreshKeepsTheEventCallbackOfAnUnchangedBannerAd() {
    manager.buildRefreshCallback(view, adView, banner.proxy).onAdRefreshed()
    idle()

    assertEquals(null, banner.eventCallback)
  }

  @Test
  fun refreshKicksBannerPresentation() {
    val before = view.presentationRefreshes

    manager.buildRefreshCallback(view, adView, banner.proxy).onAdRefreshed()
    idle()

    assertTrue(view.presentationRefreshes > before)
  }

  @Test
  fun failedRefreshEmitsOnAdFailedToLoad() {
    manager.buildRefreshCallback(view, adView, banner.proxy).onAdFailedToRefresh(error)
    idle()

    val event = manager.events.single()
    assertEquals("onAdFailedToLoad", event.type)
    assertEquals("No fill", event.payload?.getString("message"))
  }

  @Test
  fun refreshQueuedBeforeAReloadEmitsNothing() {
    val callback = manager.buildRefreshCallback(view, adView, banner.proxy)
    callback.onAdRefreshed()
    callback.onAdFailedToRefresh(error)
    view.removeView(adView)
    view.addView(AdView(activity))
    val before = view.presentationRefreshes

    idle()

    assertEquals(emptyList<CapturedBannerEvent>(), manager.events)
    assertEquals(before, view.presentationRefreshes)
  }

  @Test
  fun refreshQueuedBeforeTeardownEmitsNothing() {
    val callback = manager.buildRefreshCallback(view, adView, banner.proxy)
    callback.onAdRefreshed()
    callback.onAdFailedToRefresh(error)
    view.beginAdTeardown()

    idle()

    assertEquals(emptyList<CapturedBannerEvent>(), manager.events)
  }

  private fun idle() {
    shadowOf(activity.mainLooper).idle()
    ShadowLooper.idleMainLooper()
  }

  private fun prepareLoad() {
    view.setUnitId("/21775744923/example/banner")
    view.setSizes(listOf(AdSize.BANNER))
    view.setRequestOptions(JavaOnlyMap())
  }

  private fun armHardwareBackFocus() {
    adView.isFocusable = true
    adView.isFocusableInTouchMode = true
    adView.descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
    view.isFocusable = true
    view.isFocusableInTouchMode = true
    view.descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
  }

  private fun assertHardwareBackBlocked(target: ViewGroup) {
    assertFalse(target.isFocusable)
    assertFalse(target.isFocusableInTouchMode)
    assertEquals(ViewGroup.FOCUS_BLOCK_DESCENDANTS, target.descendantFocusability)
  }

  private data class CapturedBannerEvent(
    val type: String,
    val payload: WritableMap?,
  )

  private class CountingAdView(
    context: Context,
  ) : ReactNativeAdView(context) {
    var presentationRefreshes = 0
      private set

    public override fun refreshBannerPresentation() {
      presentationRefreshes++
    }
  }

  private class CapturingBannerManager : ReactNativeGoogleMobileAdsBannerAdViewManager() {
    val events = mutableListOf<CapturedBannerEvent>()
    var currentAd: BannerAd? = null
    var builtRefreshCallback: BannerAdRefreshCallback? = null

    public override fun buildRefreshCallback(
      view: ReactNativeAdView,
      adView: AdView,
      ad: BannerAd,
    ): BannerAdRefreshCallback {
      val callback = super.buildRefreshCallback(view, adView, ad)
      builtRefreshCallback = callback
      return callback
    }

    override fun currentBannerAd(
      adView: AdView,
      loaded: BannerAd,
    ): BannerAd = currentAd ?: loaded

    override fun sendEvent(
      view: ReactNativeAdView,
      type: String,
      payload: WritableMap?,
    ) {
      events += CapturedBannerEvent(type, payload)
    }

    override fun adLoadedPayload(
      widthPx: Int,
      heightPx: Int,
      responseInfo: ResponseInfo?,
    ): WritableMap =
      JavaOnlyMap.of(
        "widthPx",
        widthPx,
        "heightPx",
        heightPx,
        "responseId",
        responseInfo?.responseId,
      )

    override fun loadAdErrorPayload(error: LoadAdError): WritableMap = JavaOnlyMap.of("message", error.message)

    override fun paidEventPayload(
      value: AdValue,
      responseInfo: ResponseInfo?,
    ): WritableMap = JavaOnlyMap.of("currency", value.currencyCode, "valueMicros", value.valueMicros.toString())
  }

  private class FakeBannerAd(
    private val adSize: AdSize = AdSize.BANNER,
    private val collapsible: Boolean = false,
  ) {
    var eventCallback: BannerAdEventCallback? = null
    var refreshCallback: BannerAdRefreshCallback? = null
    private val responseInfo =
      ResponseInfo(
        "adapter.class",
        "banner-refresh-response",
        Bundle(),
        null,
        emptyList(),
      )

    val proxy: BannerAd =
      Proxy.newProxyInstance(
        BannerAd::class.java.classLoader,
        arrayOf(BannerAd::class.java),
      ) { proxy, method, args ->
        when (method.name) {
          "getAdSize" -> adSize
          "getResponseInfo" -> responseInfo
          "getAdEventCallback" -> eventCallback
          "setAdEventCallback" -> {
            eventCallback = args?.get(0) as BannerAdEventCallback?
            null
          }
          "setBannerAdRefreshCallback" -> {
            refreshCallback = args?.get(0) as BannerAdRefreshCallback?
            null
          }
          "getBannerAdRefreshCallback" -> refreshCallback
          "isCollapsible" -> collapsible
          "toString" -> "FakeBannerAd"
          "hashCode" -> System.identityHashCode(proxy)
          "equals" -> proxy === args?.firstOrNull()
          else -> null
        }
      } as BannerAd
  }
}

/** Intercepts [AdView.loadAd] so a test can run the load-success callback without a fill. */
@Implements(value = AdView::class, looseSignatures = true)
class ShadowBannerAdLoad : ShadowViewGroup() {
  @Implementation
  @Suppress("UNCHECKED_CAST")
  fun loadAd(
    request: Any?,
    callback: Any?,
  ) {
    lastRequest = request as? BannerAdRequest
    loadCallback = callback as? AdLoadCallback<BannerAd>
  }

  companion object {
    var loadCallback: AdLoadCallback<BannerAd>? = null
    var lastRequest: BannerAdRequest? = null
  }
}
