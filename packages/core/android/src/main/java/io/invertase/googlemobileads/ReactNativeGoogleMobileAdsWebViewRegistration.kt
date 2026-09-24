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
import android.webkit.WebView
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.UIManagerHelper

/**
 * Resolves a React view tag to an [WebView] for GMA `MobileAds.registerWebView`
 * ([#855](https://github.com/invertase/react-native-google-mobile-ads/issues/855)).
 *
 * Uses [UIManagerHelper.getUIManagerForReactTag] so Bridgeless / New Architecture
 * does not depend on the legacy `UIManagerModule` native module (null there).
 * Host wrappers (e.g. react-native-webview) are walked for a nested [WebView].
 */
object ReactNativeGoogleMobileAdsWebViewRegistration {
  @JvmStatic
  fun resolveWebView(
    reactContext: ReactContext,
    viewTag: Int,
  ): WebView? {
    val uiManager = UIManagerHelper.getUIManagerForReactTag(reactContext, viewTag) ?: return null
    val root =
      try {
        uiManager.resolveView(viewTag)
      } catch (_: Exception) {
        null
      } ?: return null
    return findWebView(root)
  }

  /** Depth-first: prefer the root when it is already a [WebView]. */
  @JvmStatic
  fun findWebView(root: View?): WebView? {
    if (root == null) {
      return null
    }
    if (root is WebView) {
      return root
    }
    if (root is ViewGroup) {
      for (i in 0 until root.childCount) {
        val found = findWebView(root.getChildAt(i))
        if (found != null) {
          return found
        }
      }
    }
    return null
  }
}
