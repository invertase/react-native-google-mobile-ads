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

import android.view.View
import android.widget.FrameLayout
import io.invertase.googlemobileads.common.ReactNativeAdView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Regression for [#594](https://github.com/invertase/react-native-google-mobile-ads/issues/594):
 * collapsible banners change AdView height after load. Without dynamic-height measure/layout,
 * Yoga keeps the initial AdSize height until a React refocus re-lays out.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsBannerAdCollapsibleExpandTest {
  @Test
  fun collapsibleMeasureAndLayout_adoptsMeasuredHeight() {
    val view = ReactNativeAdView(RuntimeEnvironment.getApplication())
    view.setIsFluid(false)
    view.setIsCollapsible(true)

    assertTrue(
      "Collapsible (non-FLUID) must use dynamic height measure",
      ReactNativeGoogleMobileAdsBannerAdLayout.usesDynamicHeight(
        view.isFluid,
        view.isCollapsible,
      ),
    )

    val child =
      object : View(RuntimeEnvironment.getApplication()) {
        override fun onMeasure(
          widthMeasureSpec: Int,
          heightMeasureSpec: Int,
        ) {
          // Simulate expand from collapsed strip (50) to expanded overlay (400).
          setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec).coerceAtLeast(1), 400)
        }
      }
    view.addView(
      child,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
      ),
    )

    // Yoga still has the initial AdSize / collapsed height.
    view.measure(
      View.MeasureSpec.makeMeasureSpec(320, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(50, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 320, 50)
    assertEquals("precondition: Yoga height is collapsed AdSize", 50, view.height)

    val measureAndLayout =
      ReactNativeAdView::class.java
        .getDeclaredField("measureAndLayout")
        .apply { isAccessible = true }
        .get(view) as Runnable
    measureAndLayout.run()

    assertEquals(
      "Collapsible measureAndLayout must layout to getMeasuredHeight(), not stale Yoga getHeight()",
      400,
      view.height,
    )
  }
}
