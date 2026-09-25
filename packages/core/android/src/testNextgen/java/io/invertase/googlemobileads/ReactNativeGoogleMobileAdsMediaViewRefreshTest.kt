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
import com.facebook.react.bridge.BridgeReactContext
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLooper

/**
 * Next-Gen Robolectric wiring for
 * [#775](https://github.com/invertase/react-native-google-mobile-ads/issues/775).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactNativeGoogleMobileAdsMediaViewRefreshTest {
  @Before
  fun setUp() {
    NextGenMobileAdsGate.resetForTests()
  }

  @After
  fun tearDown() {
    NextGenMobileAdsGate.resetForTests()
  }

  @Test
  fun firstPositiveLayout_invokesRefreshPresentation() {
    NextGenMobileAdsGate.markInitialized()
    val context = BridgeReactContext(RuntimeEnvironment.getApplication())
    val view = CountingMediaView(context)
    ShadowLooper.idleMainLooper()

    view.measure(
      View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 0, 0)
    val afterZero = view.refreshCount

    view.measure(
      View.MeasureSpec.makeMeasureSpec(400, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(300, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 400, 300)
    ShadowLooper.idleMainLooper()

    assertTrue(
      "0×0 → positive layout must refresh MediaView presentation (was $afterZero → ${view.refreshCount})",
      view.refreshCount > afterZero,
    )
  }

  @Test
  fun windowVisibleWithSize_invokesRefreshPresentation() {
    NextGenMobileAdsGate.markInitialized()
    val context = BridgeReactContext(RuntimeEnvironment.getApplication())
    val view = CountingMediaView(context)
    ShadowLooper.idleMainLooper()

    view.measure(
      View.MeasureSpec.makeMeasureSpec(400, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(300, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 400, 300)
    ShadowLooper.idleMainLooper()
    val before = view.refreshCount

    view.dispatchWindowVisibilityChanged(View.INVISIBLE)
    view.dispatchWindowVisibilityChanged(View.VISIBLE)
    ShadowLooper.idleMainLooper()

    assertTrue(
      "VISIBLE window with non-zero size must refresh presentation (was $before → ${view.refreshCount})",
      view.refreshCount > before,
    )
  }

  private class CountingMediaView(
    context: BridgeReactContext,
  ) : ReactNativeGoogleMobileAdsMediaView(context) {
    var refreshCount = 0
      private set

    override fun refreshPresentation() {
      refreshCount++
    }
  }
}
