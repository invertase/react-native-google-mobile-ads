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
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.gms.ads.BaseAdView
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Regression for [#892](https://github.com/invertase/react-native-google-mobile-ads/issues/892):
 * configuration-change Activity destroy leaves `<BannerAd>` mounted in JS, so
 * [ReactNativeGoogleMobileAdsBannerAdViewManager.onDropViewInstance] never runs. Host destroy
 * must still tear down the AdView (setAdListener null + destroy + remove) or GMA retains the
 * Activity via ThemedReactContext and OOMs after repeated fontScale / display-size changes.
 *
 * [com.google.android.gms.ads.AdView] is final; tests subclass abstract [BaseAdView] to count
 * [BaseAdView.destroy] calls.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsBannerAdHostDestroyTest {
  @Test
  fun hostDestroy_withoutDropViewInstance_destroysAdView() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val themed = ThemedReactContext(reactContext, activity)
    val manager = ReactNativeGoogleMobileAdsBannerAdViewManager()
    val view = manager.createViewInstance(themed)

    val tracking = TrackingAdView(activity)
    view.addView(tracking)
    assertEquals("precondition: AdView attached", 1, view.childCount)

    // Config-change Activity destroy: AppState stays active → JS never drops the view.
    reactContext.onHostDestroy()

    assertEquals(
      "Host destroy must call AdView.destroy() without waiting for onDropViewInstance",
      1,
      tracking.destroyCount,
    )
    assertEquals("Destroyed AdView must be removed from the React wrapper", 0, view.childCount)
  }

  @Test
  fun dropViewInstance_thenHostDestroy_isIdempotent() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val themed = ThemedReactContext(reactContext, activity)
    val manager = ReactNativeGoogleMobileAdsBannerAdViewManager()
    val view = manager.createViewInstance(themed)

    val tracking = TrackingAdView(activity)
    view.addView(tracking)

    manager.onDropViewInstance(view)
    assertEquals(1, tracking.destroyCount)
    assertEquals(0, view.childCount)

    reactContext.onHostDestroy()
    assertEquals("Second teardown must not call AdView.destroy() again", 1, tracking.destroyCount)
  }

  /**
   * Minimal [BaseAdView] double. Constructor int is the GMA ad-view type used by [AdView]
   * (BANNER); we only need destroy/listener wiring under Robolectric.
   */
  private class TrackingAdView(
    context: Context,
  ) : BaseAdView(context, 0) {
    var destroyCount = 0

    override fun destroy() {
      destroyCount++
      // Skip super.destroy(): GMA internals need MobileAds init not available in this unit suite.
    }

    override fun onLayout(
      changed: Boolean,
      l: Int,
      t: Int,
      r: Int,
      b: Int,
    ) {
      // ViewGroup requires an implementation; banner layout is irrelevant here.
    }
  }
}
