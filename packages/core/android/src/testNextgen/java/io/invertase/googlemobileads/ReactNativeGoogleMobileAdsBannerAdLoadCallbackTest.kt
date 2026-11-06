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
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.banner.AdView
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import io.invertase.googlemobileads.common.ReactNativeAdView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy

/**
 * Next-Gen can fire a banner's first impression and paid event right after onAdLoaded, before
 * anything posted from it runs, so the event callback has to be attached in onAdLoaded itself.
 * No Google auction/fill asserts ([GMA-AD-6]).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactNativeGoogleMobileAdsBannerAdLoadCallbackTest {
  @Test
  fun loadAttachesTheEventCallbackBeforeItsPostedWorkRuns() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val manager = CapturingBannerManager()
    val view = ReactNativeAdView(ThemedReactContext(reactContext, activity))
    val adView = AdView(activity)
    view.addView(adView)
    activity.setContentView(view)
    shadowOf(activity.mainLooper).idle()
    val banner = FakeBannerAd()

    // The main looper is not idled: the onAdLoaded runnable is still queued, as when the SDK
    // fires the impression before it runs.
    manager.buildLoadCallback(view, adView).onAdLoaded(banner.proxy)

    assertNotNull(banner.eventCallback)
    assertEquals(emptyList<String>(), manager.events)
  }

  private class CapturingBannerManager : ReactNativeGoogleMobileAdsBannerAdViewManager() {
    val events = mutableListOf<String>()

    override fun sendEvent(
      view: ReactNativeAdView,
      type: String,
      payload: WritableMap?,
    ) {
      events += type
    }
  }

  private class FakeBannerAd {
    var eventCallback: BannerAdEventCallback? = null
    private val responseInfo =
      ResponseInfo(
        "adapter.class",
        "banner-load-response",
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
          "getAdEventCallback" -> eventCallback
          "setAdEventCallback" -> {
            eventCallback = args?.get(0) as BannerAdEventCallback?
            null
          }
          "isCollapsible" -> false
          "toString" -> "FakeBannerAd"
          "hashCode" -> System.identityHashCode(proxy)
          "equals" -> proxy === args?.firstOrNull()
          else -> null
        }
      } as BannerAd
  }
}
