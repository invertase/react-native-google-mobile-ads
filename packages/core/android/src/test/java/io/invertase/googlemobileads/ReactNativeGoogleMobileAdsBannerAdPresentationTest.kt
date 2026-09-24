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
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Gate unit tests for [#711](https://github.com/invertase/react-native-google-mobile-ads/issues/711):
 * banner wrappers must kick presentation when presentable — gate parity with MediaView plus
 * [ReactNativeGoogleMobileAdsBannerAdPresentation.refreshIfPresentable].
 */
class ReactNativeGoogleMobileAdsBannerAdPresentationTest {
  @Test
  fun canPresent_matchesMediaViewGates() {
    assertFalse(ReactNativeGoogleMobileAdsBannerAdPresentation.canPresent(0, 50, View.VISIBLE))
    assertTrue(ReactNativeGoogleMobileAdsBannerAdPresentation.canPresent(320, 50, View.VISIBLE))
    assertEquals(
      ReactNativeGoogleMobileAdsMediaViewPresentation.canPresent(320, 50, View.VISIBLE),
      ReactNativeGoogleMobileAdsBannerAdPresentation.canPresent(320, 50, View.VISIBLE),
    )
  }

  @Test
  fun shouldRefreshAfterSizeChange_onlyWhenGrowingFromZero() {
    assertTrue(
      ReactNativeGoogleMobileAdsBannerAdPresentation.shouldRefreshAfterSizeChange(0, 0, 320, 50),
    )
    assertFalse(
      ReactNativeGoogleMobileAdsBannerAdPresentation.shouldRefreshAfterSizeChange(320, 50, 320, 50),
    )
  }

  @Test
  fun shouldRefreshAfterWindowVisibility_whenVisibleWithSize() {
    assertTrue(
      ReactNativeGoogleMobileAdsBannerAdPresentation.shouldRefreshAfterWindowVisibility(
        View.VISIBLE,
        320,
        50,
      ),
    )
    assertFalse(
      ReactNativeGoogleMobileAdsBannerAdPresentation.shouldRefreshAfterWindowVisibility(
        View.INVISIBLE,
        320,
        50,
      ),
    )
  }

  @Test
  fun refreshIfPresentable_runsOnlyWhenPresentable() {
    var runs = 0
    ReactNativeGoogleMobileAdsBannerAdPresentation.refreshIfPresentable(0, 50, View.VISIBLE) {
      runs++
    }
    assertEquals(0, runs)

    ReactNativeGoogleMobileAdsBannerAdPresentation.refreshIfPresentable(320, 50, View.VISIBLE) {
      runs++
    }
    assertEquals(1, runs)
  }
}
