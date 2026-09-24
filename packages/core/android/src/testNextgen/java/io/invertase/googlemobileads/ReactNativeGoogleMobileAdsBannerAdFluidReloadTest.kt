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
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import io.invertase.googlemobileads.common.ReactNativeAdView
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Next-Gen twin of [ReactNativeGoogleMobileAdsBannerAdFluidReloadTest] for [#801].
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactNativeGoogleMobileAdsBannerAdFluidReloadTest {
  @Before
  fun setUp() {
    NextGenMobileAdsGate.resetForTests()
  }

  @After
  fun tearDown() {
    NextGenMobileAdsGate.resetForTests()
  }

  @Test
  fun identicalFluidSizeConfig_doesNotMarkPropsChanged() {
    val view = ReactNativeAdView(RuntimeEnvironment.getApplication())
    val manager = ReactNativeGoogleMobileAdsBannerAdViewManager()
    val config =
      JavaOnlyMap.of(
        "sizes",
        JavaOnlyArray.of("FLUID"),
      )

    manager.setSizeConfig(view, config)
    view.setPropsChanged(false)

    manager.setSizeConfig(
      view,
      JavaOnlyMap.of(
        "sizes",
        JavaOnlyArray.of("FLUID"),
      ),
    )

    assertFalse(
      "Identical FLUID sizeConfig must not set propsChanged (would reload the ad)",
      view.propsChanged,
    )
  }

  @Test
  fun fluidMeasureAndLayout_adoptsMeasuredHeight() {
    val view = ReactNativeAdView(RuntimeEnvironment.getApplication())
    view.setIsFluid(true)

    val child =
      object : View(RuntimeEnvironment.getApplication()) {
        override fun onMeasure(
          widthMeasureSpec: Int,
          heightMeasureSpec: Int,
        ) {
          setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec).coerceAtLeast(1), 200)
        }
      }
    view.addView(
      child,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
      ),
    )

    view.measure(
      View.MeasureSpec.makeMeasureSpec(320, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 320, 0)
    assertEquals("precondition: Yoga height is 0", 0, view.height)

    val measureAndLayout =
      ReactNativeAdView::class.java
        .getDeclaredField("measureAndLayout")
        .apply {
          isAccessible = true
        }.get(view) as Runnable
    measureAndLayout.run()

    assertEquals(
      "Fluid measureAndLayout must layout to getMeasuredHeight(), not the stale Yoga getHeight()",
      200,
      view.height,
    )
  }
}
