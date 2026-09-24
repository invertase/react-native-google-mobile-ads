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
import io.invertase.googlemobileads.common.ReactNativeAdView
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Robolectric wiring for [#711](https://github.com/invertase/react-native-google-mobile-ads/issues/711):
 * first non-zero layout and window-visible cycles must invoke
 * [ReactNativeAdView.refreshBannerPresentation] (Next-Gen best-effort layout/invalidate parity;
 * no pause/resume API to assert).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsBannerAdPresentationRefreshTest {
  @Test
  fun firstPositiveLayout_invokesRefreshBannerPresentation() {
    val view = CountingBannerWrapper(RuntimeEnvironment.getApplication())

    view.measure(
      View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 0, 0)
    val afterZero = view.refreshCount

    view.measure(
      View.MeasureSpec.makeMeasureSpec(320, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(50, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 320, 50)

    assertTrue(
      "0×0 → positive layout must refresh banner presentation (was $afterZero → ${view.refreshCount})",
      view.refreshCount > afterZero,
    )
  }

  @Test
  fun windowVisibleWithSize_invokesRefreshBannerPresentation() {
    val view = CountingBannerWrapper(RuntimeEnvironment.getApplication())
    view.measure(
      View.MeasureSpec.makeMeasureSpec(320, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(50, View.MeasureSpec.EXACTLY),
    )
    view.layout(0, 0, 320, 50)
    val before = view.refreshCount

    view.dispatchWindowVisibilityChanged(View.INVISIBLE)
    view.dispatchWindowVisibilityChanged(View.VISIBLE)

    assertTrue(
      "VISIBLE window with non-zero size must refresh presentation (was $before → ${view.refreshCount})",
      view.refreshCount > before,
    )
  }

  private class CountingBannerWrapper(
    context: android.content.Context,
  ) : ReactNativeAdView(context) {
    var refreshCount = 0
      private set

    public override fun refreshBannerPresentation() {
      refreshCount++
    }
  }
}
