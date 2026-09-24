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
import android.view.ViewGroup
import android.widget.FrameLayout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Neutral helper coverage for [#813](https://github.com/invertase/react-native-google-mobile-ads/issues/813):
 * banner containers must not stay focusable / must block descendant focus so hardware BACK reaches
 * the Activity [androidx.activity.OnBackPressedDispatcher] (React Navigation) instead of finishing.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsBannerAdFocusTest {
  @Test
  fun blockHardwareBackFocus_clearsFocusabilityAndBlocksDescendants() {
    val context = RuntimeEnvironment.getApplication()
    val container = FrameLayout(context)
    container.isFocusable = true
    container.isFocusableInTouchMode = true
    container.descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS

    val child =
      View(context).apply {
        isFocusable = true
        isFocusableInTouchMode = true
      }
    container.addView(child)
    assertTrue("precondition: focusable child can take focus", child.requestFocus())
    assertTrue(child.isFocused)

    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(container)

    assertFalse("Ad container must not be focusable", container.isFocusable)
    assertFalse("Ad container must not be focusable in touch mode", container.isFocusableInTouchMode)
    assertEquals(
      ViewGroup.FOCUS_BLOCK_DESCENDANTS,
      container.descendantFocusability,
    )
    assertFalse("Blocked descendants must not keep / regain focus", child.requestFocus())
    assertFalse(container.isFocused)
  }

  @Test
  fun blockHardwareBackFocus_reappliesAfterPostLoadFocusReenable() {
    val context = RuntimeEnvironment.getApplication()
    val container = FrameLayout(context)
    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(container)

    // Simulate AdView / creative path re-enabling focus after onAdLoaded.
    container.isFocusable = true
    container.isFocusableInTouchMode = true
    container.descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
    assertTrue("precondition: post-load container can take focus", container.requestFocus())

    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(container)

    assertFalse(container.isFocusable)
    assertFalse(container.isFocusableInTouchMode)
    assertEquals(ViewGroup.FOCUS_BLOCK_DESCENDANTS, container.descendantFocusability)
    assertFalse(container.isFocused)
  }
}
