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

import android.app.Activity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.uimanager.ThemedReactContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Regression for [#813](https://github.com/invertase/react-native-google-mobile-ads/issues/813):
 * nested React Navigation stacks must receive hardware BACK. Banner wrappers must not be
 * focusable / must not consume KEYCODE_BACK (AdView WebViews historically finished the Activity).
 *
 * Does not regress [#892](https://github.com/invertase/react-native-google-mobile-ads/issues/892)
 * host-destroy teardown — see [ReactNativeGoogleMobileAdsBannerAdHostDestroyTest].
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsBannerAdBackFocusTest {
  @Test
  fun createViewInstance_blocksFocusAndDoesNotConsumeBack() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val themed = ThemedReactContext(reactContext, activity)
    val manager = ReactNativeGoogleMobileAdsBannerAdViewManager()
    val view = manager.createViewInstance(themed)

    assertFalse("Banner wrapper must not be focusable", view.isFocusable)
    assertFalse("Banner wrapper must not be focusable in touch mode", view.isFocusableInTouchMode)
    assertEquals(
      ViewGroup.FOCUS_BLOCK_DESCENDANTS,
      view.descendantFocusability,
    )

    val child =
      View(activity).apply {
        isFocusable = true
        isFocusableInTouchMode = true
      }
    view.addView(child)
    assertFalse("Descendants must not take focus through the banner wrapper", child.requestFocus())

    val down = KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_BACK)
    val up = KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_BACK)
    assertFalse("Banner wrapper must not consume BACK down", view.dispatchKeyEvent(down))
    assertFalse("Banner wrapper must not consume BACK up", view.dispatchKeyEvent(up))
    assertFalse("onKeyPreIme must not intercept BACK", view.onKeyPreIme(KeyEvent.KEYCODE_BACK, down))
  }
}
