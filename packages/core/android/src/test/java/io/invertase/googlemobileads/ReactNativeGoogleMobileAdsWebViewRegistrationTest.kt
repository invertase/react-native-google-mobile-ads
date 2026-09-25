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
import android.webkit.WebView
import android.widget.FrameLayout
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Neutral (classic+nextgen) coverage for [#855](https://github.com/invertase/react-native-google-mobile-ads/issues/855)
 * WebView host resolution (react-native-webview wrappers nest the platform WebView).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsWebViewRegistrationTest {
  @Test
  fun findWebView_returnsRootWhenAlreadyWebView() {
    val webView = WebView(RuntimeEnvironment.getApplication())
    assertSame(webView, ReactNativeGoogleMobileAdsWebViewRegistration.findWebView(webView))
  }

  @Test
  fun findWebView_walksHostWrapperForNestedWebView() {
    val context = RuntimeEnvironment.getApplication()
    val host = FrameLayout(context)
    val nestedHost = FrameLayout(context)
    val webView = WebView(context)
    nestedHost.addView(webView)
    host.addView(nestedHost)

    assertSame(webView, ReactNativeGoogleMobileAdsWebViewRegistration.findWebView(host))
  }

  @Test
  fun findWebView_returnsNullWhenAbsent() {
    val host = FrameLayout(RuntimeEnvironment.getApplication())
    host.addView(View(RuntimeEnvironment.getApplication()))
    assertNull(ReactNativeGoogleMobileAdsWebViewRegistration.findWebView(host))
    assertNull(ReactNativeGoogleMobileAdsWebViewRegistration.findWebView(null))
  }
}
