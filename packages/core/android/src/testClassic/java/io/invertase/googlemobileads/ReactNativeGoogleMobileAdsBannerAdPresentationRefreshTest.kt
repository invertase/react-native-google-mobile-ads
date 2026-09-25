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

import android.content.Context
import android.view.View
import com.google.android.gms.ads.BaseAdView
import io.invertase.googlemobileads.common.ReactNativeAdView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Robolectric coverage for [#711](https://github.com/invertase/react-native-google-mobile-ads/issues/711):
 * classic kick body calls [BaseAdView.resume] when presentable; size / window-VISIBLE wiring
 * reaches that body. Does not override [ReactNativeAdView.refreshBannerPresentation] — counts
 * resume on a child [BaseAdView] double instead ([AdView] is final).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsBannerAdPresentationRefreshTest {
  @Test
  fun refreshWhenPresentable_callsBaseAdViewResume() {
    val context = RuntimeEnvironment.getApplication()
    val view = ReactNativeAdView(context)
    val tracking = TrackingAdView(context)
    view.addView(tracking)

    view.measure(
      View.MeasureSpec.makeMeasureSpec(320, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(50, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 320, 50)
    val before = tracking.resumeCount

    view.refreshBannerPresentation()

    assertTrue(
      "Presentable refresh must call BaseAdView.resume() (was $before → ${tracking.resumeCount})",
      tracking.resumeCount > before,
    )
  }

  @Test
  fun refreshWhenZeroWidth_skipsBaseAdViewResume() {
    val context = RuntimeEnvironment.getApplication()
    val view = ReactNativeAdView(context)
    val tracking = TrackingAdView(context)
    view.addView(tracking)

    view.measure(
      View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(50, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 0, 50)

    assertEquals(0, tracking.resumeCount)
    view.refreshBannerPresentation()
    assertEquals(
      "Zero-width wrapper must not call BaseAdView.resume()",
      0,
      tracking.resumeCount,
    )
  }

  @Test
  fun firstPositiveLayout_invokesBaseAdViewResume() {
    val context = RuntimeEnvironment.getApplication()
    val view = ReactNativeAdView(context)
    val tracking = TrackingAdView(context)
    view.addView(tracking)

    view.measure(
      View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 0, 0)
    assertEquals(0, tracking.resumeCount)

    view.measure(
      View.MeasureSpec.makeMeasureSpec(320, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(50, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 320, 50)

    assertTrue(
      "0×0 → positive layout must call BaseAdView.resume() (count=${tracking.resumeCount})",
      tracking.resumeCount > 0,
    )
  }

  @Test
  fun windowVisibleWithSize_invokesBaseAdViewResume() {
    val context = RuntimeEnvironment.getApplication()
    val view = ReactNativeAdView(context)
    val tracking = TrackingAdView(context)
    view.addView(tracking)
    view.measure(
      View.MeasureSpec.makeMeasureSpec(320, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(50, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 320, 50)
    val before = tracking.resumeCount

    view.dispatchWindowVisibilityChanged(View.INVISIBLE)
    view.dispatchWindowVisibilityChanged(View.VISIBLE)

    assertTrue(
      "VISIBLE window with non-zero size must call BaseAdView.resume() (was $before → ${tracking.resumeCount})",
      tracking.resumeCount > before,
    )
  }

  /**
   * Minimal [BaseAdView] double. Constructor int is the GMA ad-view type used by [com.google.android.gms.ads.AdView]
   * (BANNER); we only need resume counting under Robolectric.
   */
  private class TrackingAdView(
    context: Context,
  ) : BaseAdView(context, 0) {
    var resumeCount = 0
      private set

    override fun resume() {
      resumeCount++
      // Skip super.resume(): GMA internals need MobileAds init not available in this unit suite.
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
