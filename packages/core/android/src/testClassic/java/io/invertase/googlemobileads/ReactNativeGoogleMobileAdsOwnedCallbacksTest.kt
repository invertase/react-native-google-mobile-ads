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
import android.content.Context
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.gms.ads.AdLoadCallback
import com.google.android.gms.ads.AdValue
import com.google.android.gms.ads.BaseAdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.OnPaidEventListener
import com.google.android.gms.ads.OnUserEarnedRewardListener
import com.google.android.gms.ads.ResponseInfo
import com.google.android.gms.ads.admanager.AdManagerAdRequest
import com.google.android.gms.ads.rewarded.RewardItem
import io.invertase.googlemobileads.common.ReactNativeAdView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLooper
import java.lang.reflect.Proxy

/**
 * Classic owned paid / click / reward callback wiring and GAM manual-impression
 * configuration + command routing. No Google auction/fill asserts ([GMA-AD-6]).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsOwnedCallbacksTest {
  @Test
  fun fullscreenPaidClickAndRewardEmitOwnedEventTypes() {
    val module = CapturingFullScreenModule()
    val precisePrecisionType = 3
    val adValue = AdValue.zza(precisePrecisionType, "USD", 1_500_000L)

    module.emitPaidEvent(7, "unit-id", adValue, null)
    val paid = module.events.single()
    assertEquals(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PAID, paid.type)
    assertEquals("USD", paid.data?.getString("currency"))
    assertEquals("1500000", paid.data?.getString("valueMicros"))

    module.events.clear()
    module.presentingContentCallback(7, "unit-id").onAdClicked()
    assertEquals(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLICKED,
      module.events.single().type,
    )

    module.events.clear()
    module.emitEarnedReward(7, "unit-id", "coins", 10)
    val reward = module.events.single()
    assertEquals(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD,
      reward.type,
    )
    assertEquals("coins", reward.data?.getString("type"))
    assertEquals(10, reward.data?.getInt("amount"))
  }

  @Test
  fun fullscreenLoadAndShowAttachSitesWirePaidClickAndRewardHelpers() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val module = CapturingFullScreenModule(reactContext)

    // adoptPolledAd → wirePresentingCallbacks (same attach helpers as onAdLoaded).
    module.adoptPolledAd(9, "unit-id", Any())
    assertNotNull(module.paidListener)
    assertNotNull(module.contentCallback)

    module.paidListener!!.onPaidEvent(AdValue.zza(3, "USD", 1_500_000L))
    val paid = module.events.single()
    assertEquals(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PAID, paid.type)
    assertEquals("USD", paid.data?.getString("currency"))
    assertEquals("1500000", paid.data?.getString("valueMicros"))

    module.events.clear()
    module.contentCallback!!.onAdClicked()
    assertEquals(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLICKED,
      module.events.single().type,
    )

    module.events.clear()
    module.show(9, "unit-id", JavaOnlyMap.of("immersiveModeEnabled", false), noOpPromise())
    shadowOf(activity.mainLooper).idle()
    ShadowLooper.idleMainLooper()
    assertNotNull(module.rewardListener)
    module.rewardListener!!.onUserEarnedReward(
      object : RewardItem {
        override fun getType(): String = "gems"

        override fun getAmount(): Int = 4
      },
    )
    val reward = module.events.single()
    assertEquals(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD,
      reward.type,
    )
    assertEquals("gems", reward.data?.getString("type"))
    assertEquals(4, reward.data?.getInt("amount"))
  }

  @Test
  fun bannerPaidAndClickCallbacksDispatchOwnedEventTypes() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val themed = ThemedReactContext(reactContext, activity)
    val manager = CapturingBannerManager()
    val view = manager.createViewInstance(themed)
    val adView = TrackingAdView(activity)

    manager.createPaidEventListener(view, adView).onPaidEvent(AdValue.zza(3, "EUR", 42_000L))
    assertEquals("onPaid", manager.events.single().type)
    assertEquals(
      "EUR",
      manager.events
        .single()
        .payload
        ?.getString("currency"),
    )

    manager.events.clear()
    manager.createAdListener(view, adView).onAdClicked()
    assertEquals("onAdClicked", manager.events.single().type)
  }

  @Test
  fun manualImpressionsEnabledPropMarksViewDirty() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val themed = ThemedReactContext(reactContext, activity)
    val manager = ReactNativeGoogleMobileAdsBannerAdViewManager()
    val view = manager.createViewInstance(themed)

    assertFalse(view.manualImpressionsEnabled)
    manager.setManualImpressionsEnabled(view, true)
    assertTrue(view.manualImpressionsEnabled)
    assertTrue(view.propsChanged)
  }

  @Test
  fun recordManualImpressionCommandRoutesToAdManagerPath() {
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val themed = ThemedReactContext(reactContext, activity)
    val manager = CapturingBannerManager()
    val view = manager.createViewInstance(themed)
    val adView = TrackingAdView(activity)
    view.addView(adView)

    manager.routeCommand(view, "recordManualImpression")
    assertEquals(1, manager.manualImpressionCalls)
    assertEquals(adView, manager.lastManualImpressionView)

    manager.routeCommand(view, "load")
    assertEquals(
      "load must not be counted as a manual-impression route",
      1,
      manager.manualImpressionCalls,
    )
  }

  private data class CapturedEvent(
    val type: String,
    val data: WritableMap?,
  )

  private data class CapturedBannerEvent(
    val type: String,
    val payload: WritableMap?,
  )

  private class CapturingFullScreenModule(
    reactContext: BridgeReactContext? = null,
  ) : ReactNativeGoogleMobileAdsFullScreenAdModule<Any>(
      reactContext,
      "owned-callback-test",
    ) {
    val events = mutableListOf<CapturedEvent>()
    var paidListener: OnPaidEventListener? = null
    var contentCallback: FullScreenContentCallback? = null
    var rewardListener: OnUserEarnedRewardListener? = null

    override fun getAdEventName(): String = "owned-callback-test"

    override fun loadAd(
      activity: Activity,
      adUnitId: String,
      adRequest: AdManagerAdRequest,
      adLoadCallback: AdLoadCallback<Any>,
    ) = Unit

    override fun attachPaidEventListener(
      ad: Any,
      listener: OnPaidEventListener,
    ) {
      paidListener = listener
    }

    override fun attachFullScreenContentCallback(
      ad: Any,
      callback: FullScreenContentCallback,
    ) {
      contentCallback = callback
    }

    override fun presentAd(
      ad: Any,
      activity: Activity,
      onUserEarnedRewardListener: OnUserEarnedRewardListener?,
    ) {
      rewardListener = onUserEarnedRewardListener
    }

    override fun sendAdEvent(
      type: String,
      requestId: Int,
      adUnitId: String,
      error: WritableMap?,
      data: WritableMap?,
    ) {
      events += CapturedEvent(type, data)
    }

    override fun createEventMap(): WritableMap = JavaOnlyMap()

    override fun paidEventPayload(
      adValue: AdValue,
      responseInfo: ResponseInfo?,
    ): WritableMap =
      JavaOnlyMap.of(
        "currency",
        adValue.currencyCode,
        "valueMicros",
        adValue.valueMicros.toString(),
      )
  }

  private class CapturingBannerManager : ReactNativeGoogleMobileAdsBannerAdViewManager() {
    val events = mutableListOf<CapturedBannerEvent>()
    var manualImpressionCalls = 0
    var lastManualImpressionView: BaseAdView? = null

    override fun sendEvent(
      reactViewGroup: ReactNativeAdView,
      type: String,
      payload: WritableMap?,
    ) {
      events += CapturedBannerEvent(type, payload)
    }

    override fun paidEventPayload(
      adValue: AdValue,
      responseInfo: Any?,
    ): WritableMap =
      JavaOnlyMap.of(
        "currency",
        adValue.currencyCode,
        "valueMicros",
        adValue.valueMicros.toString(),
      )

    override fun recordManualImpression(adView: BaseAdView?) {
      manualImpressionCalls++
      lastManualImpressionView = adView
    }
  }

  private class TrackingAdView(
    context: Context,
  ) : BaseAdView(context, 0) {
    override fun destroy() = Unit

    override fun onLayout(
      changed: Boolean,
      l: Int,
      t: Int,
      r: Int,
      b: Int,
    ) = Unit
  }

  private fun noOpPromise(): Promise =
    Proxy.newProxyInstance(
      Promise::class.java.classLoader,
      arrayOf(Promise::class.java),
    ) { _, _, _ -> null } as Promise
}
