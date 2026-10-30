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
import android.widget.FrameLayout
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.banner.AdView
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import io.invertase.googlemobileads.common.ReactNativeAdView
import org.junit.Assert.assertEquals
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
    view.layoutParams = FrameLayout.LayoutParams(300, 120)
    idle()

    manager.buildRefreshCallback(view, adView, banner.proxy).onAdRefreshed()
    idle()

    val event = manager.events.single()
    assertEquals("onAdLoaded", event.type)
    assertEquals(300, event.payload?.getInt("widthPx"))
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
  }

  private class FakeBannerAd {
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
          "getAdSize" -> AdSize.BANNER
          "getResponseInfo" -> responseInfo
          "isCollapsible" -> false
          "toString" -> "FakeBannerAd"
          "hashCode" -> System.identityHashCode(proxy)
          "equals" -> proxy === args?.firstOrNull()
          else -> null
        }
      } as BannerAd
  }
}
