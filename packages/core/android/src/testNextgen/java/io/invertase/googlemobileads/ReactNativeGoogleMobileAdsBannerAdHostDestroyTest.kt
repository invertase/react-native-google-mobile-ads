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
import android.view.View
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.uimanager.ThemedReactContext
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Regression for [#892](https://github.com/invertase/react-native-google-mobile-ads/issues/892):
 * configuration-change Activity destroy leaves `<BannerAd>` mounted in JS, so
 * [ReactNativeGoogleMobileAdsBannerAdViewManager.onDropViewInstance] never runs. Host destroy
 * must still tear down the banner child. Next-Gen SDK [AdView] is final and needs MobileAds
 * init, so this suite asserts child removal (classic twin counts [BaseAdView.destroy]).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsBannerAdHostDestroyTest {
  @Test
  fun hostDestroy_withoutDropViewInstance_removesBannerChild() {
    val controller = Robolectric.buildActivity(Activity::class.java).setup()
    val activity = controller.get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val themed = ThemedReactContext(reactContext, activity)
    val manager = ReactNativeGoogleMobileAdsBannerAdViewManager()
    val view = manager.createViewInstance(themed)

    view.addView(View(activity))
    assertEquals("precondition: child attached", 1, view.childCount)

    // onHostDestroy is dispatched from the Activity's own onDestroy, so destroy it first.
    controller.pause().stop().destroy()
    reactContext.onHostDestroy()

    assertEquals(
      "Host destroy must remove the banner child without waiting for onDropViewInstance",
      0,
      view.childCount,
    )
  }

  @Test
  fun hostDestroy_ofAnotherActivity_keepsBannerChild() {
    val hostController = Robolectric.buildActivity(Activity::class.java).setup()
    val hostActivity = hostController.get()
    val reactContext = BridgeReactContext(hostActivity)
    reactContext.onHostResume(hostActivity)
    val themed = ThemedReactContext(reactContext, hostActivity)
    val manager = ReactNativeGoogleMobileAdsBannerAdViewManager()
    val view = manager.createViewInstance(themed)

    view.addView(View(hostActivity))

    // A second Activity sharing the ReactContext (e.g. an app widget configuration screen)
    // comes to the front and is then closed while the banner's Activity stays alive.
    val otherController = Robolectric.buildActivity(Activity::class.java).setup()
    reactContext.onHostResume(otherController.get())
    otherController.pause().stop().destroy()
    reactContext.onHostDestroy()

    assertEquals("Another Activity's destroy must keep the banner child", 1, view.childCount)

    // The banner's own Activity is destroyed later: teardown must still happen.
    reactContext.onHostResume(hostActivity)
    hostController.pause().stop().destroy()
    reactContext.onHostDestroy()

    assertEquals(0, view.childCount)
  }

  @Test
  fun dropViewInstance_thenHostDestroy_isIdempotent() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val themed = ThemedReactContext(reactContext, activity)
    val manager = ReactNativeGoogleMobileAdsBannerAdViewManager()
    val view = manager.createViewInstance(themed)

    view.addView(View(activity))

    manager.onDropViewInstance(view)
    assertEquals(0, view.childCount)

    reactContext.onHostDestroy()
    assertEquals("Second teardown must remain idempotent", 0, view.childCount)
  }
}
