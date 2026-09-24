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

import android.view.ViewGroup

/**
 * Keeps banner AdView / wrapper hierarchies from owning hardware BACK.
 *
 * AdMob banners embed WebViews that request focus. When those WebViews (or the AdView itself)
 * hold focus, KEYCODE_BACK is delivered to the ad hierarchy instead of React Navigation's
 * [androidx.activity.OnBackPressedDispatcher] callbacks — nested stacks finish the Activity
 * instead of popping ([#813](https://github.com/invertase/react-native-google-mobile-ads/issues/813)).
 *
 * [ViewGroup.FOCUS_BLOCK_DESCENDANTS] alone (since 2022) is not enough: the AdView container can
 * still become focusable after creative load. Also clear focusability on the container itself.
 */
object ReactNativeGoogleMobileAdsBannerAdFocus {
  @JvmStatic
  fun blockHardwareBackFocus(container: ViewGroup) {
    container.isFocusable = false
    container.isFocusableInTouchMode = false
    container.descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
    if (container.isFocused) {
      container.clearFocus()
    }
  }
}
