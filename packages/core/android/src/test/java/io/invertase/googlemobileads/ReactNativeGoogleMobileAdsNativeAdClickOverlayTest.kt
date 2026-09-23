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
import android.widget.TextView
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Neutral (classic+nextgen) coverage for [#893](https://github.com/invertase/react-native-google-mobile-ads/issues/893)
 * overlay / asset-click helpers.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsNativeAdClickOverlayTest {
  @Test
  fun ensureSdkOverlayOnTop_outranksElevatedReactContent() {
    val context = RuntimeEnvironment.getApplication()
    val nativeAdView =
      object : FrameLayout(context) {
        private val overlay = FrameLayout(context)

        init {
          addView(overlay)
        }

        override fun bringChildToFront(child: View?) {
          super.bringChildToFront(child)
          if (child !== overlay) {
            super.bringChildToFront(overlay)
          }
        }

        fun overlay(): FrameLayout = overlay
      }
    val reactContent = FrameLayout(context)
    nativeAdView.addView(reactContent)
    reactContent.elevation = 24f

    ReactNativeGoogleMobileAdsNativeAdClickOverlay.ensureSdkOverlayOnTop(nativeAdView, reactContent)

    assertSame(nativeAdView.overlay(), nativeAdView.getChildAt(nativeAdView.childCount - 1))
    assertTrue(nativeAdView.overlay().elevation > reactContent.elevation)
  }

  @Test
  fun prepareAssetViewForSdkOwnedClicks_clearsClickConsumption() {
    val asset = TextView(RuntimeEnvironment.getApplication())
    asset.isClickable = true
    asset.isFocusable = true

    ReactNativeGoogleMobileAdsNativeAdClickOverlay.prepareAssetViewForSdkOwnedClicks(asset)

    assertFalse(asset.isClickable)
    assertFalse(asset.isFocusable)
  }
}
