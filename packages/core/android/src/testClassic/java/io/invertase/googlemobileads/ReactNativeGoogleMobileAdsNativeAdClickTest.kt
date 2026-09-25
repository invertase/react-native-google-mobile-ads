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
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.gms.ads.nativead.NativeAdView
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Regression for [#893](https://github.com/invertase/react-native-google-mobile-ads/issues/893)
 * (overlay / asset click ownership) and [#726](https://github.com/invertase/react-native-google-mobile-ads/issues/726)
 * (Activity-backed NativeAdView so click intents do not need FLAG_ACTIVITY_NEW_TASK).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsNativeAdClickTest {
  @Test
  fun sdkClickOverlay_staysAboveReactContent_afterLayoutAndElevation() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val context = BridgeReactContext(activity)
    context.onHostResume(activity)
    val host = ReactNativeGoogleMobileAdsNativeAdView(context)
    val nativeAdView = findNativeAdView(host)
    assertNotNull(nativeAdView)

    val headline = TextView(context).also { it.text = "headline" }
    host.viewGroup.addView(headline)
    nativeAdView!!.headlineView = headline

    host.measure(
      View.MeasureSpec.makeMeasureSpec(400, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(300, View.MeasureSpec.EXACTLY),
    )
    host.layout(0, 0, 400, 300)

    // Elevation from RN shadows / zIndex outranks sibling order for hit testing.
    host.viewGroup.elevation = 24f
    host.ensureClickOverlayOnTop()

    val top = nativeAdView.getChildAt(nativeAdView.childCount - 1)
    assertTrue(
      "SDK click/AdChoices overlay must be topmost child after RN layout (was ${top?.javaClass?.name})",
      top is FrameLayout && top !== host.viewGroup,
    )
    assertTrue(
      "SDK overlay elevation must outrank React content (content=${host.viewGroup.elevation}, overlay=${top.elevation})",
      top.elevation > host.viewGroup.elevation,
    )
  }

  @Test
  fun registerAsset_disablesAssetClickConsumption_soSdkOwnsClicks() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val context = BridgeReactContext(activity)
    context.onHostResume(activity)
    val host = ReactNativeGoogleMobileAdsNativeAdView(context)
    val asset =
      TextView(context).also {
        it.id = 42
        it.text = "CTA"
        it.isClickable = true
        it.isFocusable = true
      }
    host.viewGroup.addView(asset)

    host.registerResolvedAsset("callToAction", asset)

    assertFalse("Asset must not consume clicks away from NativeAdView/SDK", asset.isClickable)
    assertFalse(asset.isFocusable)
    assertSame(asset, findNativeAdView(host)!!.callToActionView)
  }

  @Test
  fun nativeAdView_usesActivityContextWhenAvailable() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val context = BridgeReactContext(activity)
    context.onHostResume(activity)
    val host = ReactNativeGoogleMobileAdsNativeAdView(context)
    val nativeAdView = findNativeAdView(host)!!

    // GMA click intents need an Activity-backed context (same rationale as banner AdView).
    assertSame(activity, unwrapActivity(nativeAdView.context))
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
  fun nativeAdView_notConstructedWithApplicationContext() {
    val context = BridgeReactContext(RuntimeEnvironment.getApplication())
    val host = ReactNativeGoogleMobileAdsNativeAdView(context)

    assertNull(
      "Without an Activity, tip must defer NativeAdView (banner parity) instead of " +
        "Application/ReactContext that forces FLAG_ACTIVITY_NEW_TASK on clicks (#726)",
      findNativeAdView(host),
    )
  }

  @Test
  fun nativeAdView_createdWhenActivityArrivesOnResume() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val context = BridgeReactContext(RuntimeEnvironment.getApplication())
    val host = ReactNativeGoogleMobileAdsNativeAdView(context)
    assertNull(findNativeAdView(host))

    context.onHostResume(activity)

    val nativeAdView = findNativeAdView(host)
    assertNotNull(nativeAdView)
    assertSame(activity, unwrapActivity(nativeAdView!!.context))
  }

  @Test
  fun registerAsset_beforeActivity_flushedOnHostResume() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val context = BridgeReactContext(RuntimeEnvironment.getApplication())
    val host = ReactNativeGoogleMobileAdsNativeAdView(context)
    assertNull(findNativeAdView(host))

    val cta =
      TextView(context).also {
        it.text = "CTA"
        it.isClickable = true
      }
    val headline = TextView(context).also { it.text = "headline" }
    host.viewGroup.addView(cta)
    host.viewGroup.addView(headline)

    // NativeAsset one-shot registration can land before Activity is attached (#726).
    host.registerResolvedAsset("callToAction", cta)
    host.registerResolvedAsset("headline", headline)
    assertNull(findNativeAdView(host))

    context.onHostResume(activity)

    val nativeAdView = findNativeAdView(host)
    assertNotNull(nativeAdView)
    assertSame(cta, nativeAdView!!.callToActionView)
    assertSame(headline, nativeAdView.headlineView)
    assertFalse(cta.isClickable)
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

  private fun findNativeAdView(host: ViewGroup): NativeAdView? {
    for (i in 0 until host.childCount) {
      val child = host.getChildAt(i)
      if (child is NativeAdView) return child
      if (child is ViewGroup) {
        findNativeAdView(child)?.let {
          return it
        }
      }
    }
    return null
  }

  private fun unwrapActivity(context: android.content.Context): Activity? {
    var current: android.content.Context? = context
    while (current != null) {
      if (current is Activity) return current
      current = (current as? android.content.ContextWrapper)?.baseContext
    }
    return null
  }
}
