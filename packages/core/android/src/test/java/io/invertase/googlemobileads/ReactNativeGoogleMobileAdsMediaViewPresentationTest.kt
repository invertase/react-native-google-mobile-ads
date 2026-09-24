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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Red→green for [#775](https://github.com/invertase/react-native-google-mobile-ads/issues/775):
 * MediaView must refresh presentation when it first becomes a non-zero, visible box — otherwise
 * native video in pagers/lists stays black until leave+return recreates the surface.
 */
class ReactNativeGoogleMobileAdsMediaViewPresentationTest {
  @Test
  fun canPresent_requiresPositiveSizeAndVisible() {
    assertFalse(ReactNativeGoogleMobileAdsMediaViewPresentation.canPresent(0, 300, View.VISIBLE))
    assertFalse(ReactNativeGoogleMobileAdsMediaViewPresentation.canPresent(400, 0, View.VISIBLE))
    assertFalse(ReactNativeGoogleMobileAdsMediaViewPresentation.canPresent(400, 300, View.INVISIBLE))
    assertFalse(ReactNativeGoogleMobileAdsMediaViewPresentation.canPresent(400, 300, View.GONE))
    assertTrue(ReactNativeGoogleMobileAdsMediaViewPresentation.canPresent(400, 300, View.VISIBLE))
  }

  @Test
  fun shouldRefreshAfterSizeChange_onlyWhenGrowingFromZero() {
    assertTrue(
      ReactNativeGoogleMobileAdsMediaViewPresentation.shouldRefreshAfterSizeChange(0, 0, 400, 300),
    )
    assertTrue(
      ReactNativeGoogleMobileAdsMediaViewPresentation.shouldRefreshAfterSizeChange(0, 300, 400, 300),
    )
    assertTrue(
      ReactNativeGoogleMobileAdsMediaViewPresentation.shouldRefreshAfterSizeChange(400, 0, 400, 300),
    )
    assertFalse(
      ReactNativeGoogleMobileAdsMediaViewPresentation.shouldRefreshAfterSizeChange(400, 300, 400, 300),
    )
    assertFalse(
      ReactNativeGoogleMobileAdsMediaViewPresentation.shouldRefreshAfterSizeChange(400, 300, 500, 300),
    )
    assertFalse(
      ReactNativeGoogleMobileAdsMediaViewPresentation.shouldRefreshAfterSizeChange(0, 0, 0, 0),
    )
  }

  @Test
  fun shouldRefreshAfterWindowVisibility_whenVisibleWithSize() {
    assertTrue(
      ReactNativeGoogleMobileAdsMediaViewPresentation.shouldRefreshAfterWindowVisibility(
        View.VISIBLE,
        400,
        300,
      ),
    )
    assertFalse(
      ReactNativeGoogleMobileAdsMediaViewPresentation.shouldRefreshAfterWindowVisibility(
        View.INVISIBLE,
        400,
        300,
      ),
    )
    assertFalse(
      ReactNativeGoogleMobileAdsMediaViewPresentation.shouldRefreshAfterWindowVisibility(
        View.VISIBLE,
        0,
        300,
      ),
    )
  }
}
