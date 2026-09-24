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

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression helpers for [#801](https://github.com/invertase/react-native-google-mobile-ads/issues/801)
 * and [#594](https://github.com/invertase/react-native-google-mobile-ads/issues/594):
 * Android FLUID banners must not treat every sizeConfig re-delivery or layout ping as a full
 * ad reload, fluid/collapsible measure/layout must adopt [android.view.View.getMeasuredHeight],
 * and collapsible ads must use the dynamic-height path.
 */
class ReactNativeGoogleMobileAdsBannerAdLayoutTest {
  @Test
  fun identicalFluidSizeConfig_doesNotRequireReload() {
    assertFalse(
      ReactNativeGoogleMobileAdsBannerAdLayout.sizeConfigRequiresReload(
        listOf("FLUID"),
        0f,
        0f,
        listOf("FLUID"),
        0f,
        0f,
      ),
    )
  }

  @Test
  fun firstSizeConfig_requiresReload() {
    assertTrue(
      ReactNativeGoogleMobileAdsBannerAdLayout.sizeConfigRequiresReload(
        null,
        0f,
        0f,
        listOf("FLUID"),
        0f,
        0f,
      ),
    )
  }

  @Test
  fun sizeListChange_requiresReload() {
    assertTrue(
      ReactNativeGoogleMobileAdsBannerAdLayout.sizeConfigRequiresReload(
        listOf("BANNER"),
        0f,
        0f,
        listOf("FLUID"),
        0f,
        0f,
      ),
    )
  }

  @Test
  fun shouldEmitSizeChange_onlyWhenPixelSizeDiffers() {
    assertFalse(
      ReactNativeGoogleMobileAdsBannerAdLayout.shouldEmitSizeChange(100, 200, 100, 200),
    )
    assertTrue(
      ReactNativeGoogleMobileAdsBannerAdLayout.shouldEmitSizeChange(100, 200, 100, 250),
    )
  }

  @Test
  fun usesDynamicHeight_forFluidOrCollapsible() {
    assertFalse(ReactNativeGoogleMobileAdsBannerAdLayout.usesDynamicHeight(false, false))
    assertTrue(ReactNativeGoogleMobileAdsBannerAdLayout.usesDynamicHeight(true, false))
    assertTrue(ReactNativeGoogleMobileAdsBannerAdLayout.usesDynamicHeight(false, true))
    assertTrue(ReactNativeGoogleMobileAdsBannerAdLayout.usesDynamicHeight(true, true))
  }

  @Test
  fun fluidLayoutBottom_usesMeasuredHeight() {
    assertEquals(250, ReactNativeGoogleMobileAdsBannerAdLayout.fluidLayoutBottom(0, 250))
    assertEquals(310, ReactNativeGoogleMobileAdsBannerAdLayout.fluidLayoutBottom(60, 250))
  }
}
