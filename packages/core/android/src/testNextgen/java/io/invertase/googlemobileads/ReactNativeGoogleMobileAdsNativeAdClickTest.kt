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
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.uimanager.ThemedReactContext
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Next-Gen slice of [#893](https://github.com/invertase/react-native-google-mobile-ads/issues/893)
 * / [#726](https://github.com/invertase/react-native-google-mobile-ads/issues/726).
 *
 * Full overlay/asset click ownership is covered by classic
 * [ReactNativeGoogleMobileAdsNativeAdClickTest] and neutral
 * [ReactNativeGoogleMobileAdsNativeAdClickOverlayTest]. Constructing a real Next-Gen
 * [com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdView] in this suite flips
 * `MobileAds.isInitialized` and poisons [ReactNativeGoogleMobileAdsPreInitializationTest].
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactNativeGoogleMobileAdsNativeAdClickTest {
  @Test
  fun sdkViewContext_prefersCurrentActivity() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val context = BridgeReactContext(activity)
    context.onHostResume(activity)

    assertSame(
      activity,
      ReactNativeGoogleMobileAdsNativeAdView.sdkViewContext(context),
    )
  }

  @Test
  fun sdkViewContext_withoutActivity_returnsNull() {
    val context = BridgeReactContext(RuntimeEnvironment.getApplication())

    assertNull(
      "Non-Activity ReactContext must not back NativeAdView (#726 NEW_TASK blank task)",
      ReactNativeGoogleMobileAdsNativeAdView.sdkViewContext(context),
    )
  }

  @Test
  fun sdkViewContext_walksThemedReactContextBaseToActivity() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(RuntimeEnvironment.getApplication())
    assertNull(reactContext.currentActivity)

    val themed = ThemedReactContext(reactContext, activity)

    assertSame(
      "ThemedReactContext base is often Activity even when currentActivity is null (#726)",
      activity,
      ReactNativeGoogleMobileAdsNativeAdView.sdkViewContext(themed),
    )
  }
}
