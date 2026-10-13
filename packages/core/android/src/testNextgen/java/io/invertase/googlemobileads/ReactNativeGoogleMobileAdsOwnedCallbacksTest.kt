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
import android.os.Bundle
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.PrecisionType
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import com.google.android.libraries.ads.mobile.sdk.rewarded.OnUserEarnedRewardListener
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardItem
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAd
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAdEventCallback
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
 * Next-Gen owned paid / click / reward callback wiring and GAM manual-impression
 * request configuration + command routing. No Google auction/fill asserts ([GMA-AD-6]).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactNativeGoogleMobileAdsOwnedCallbacksTest {
  @Test
  fun fullscreenPaidClickAndRewardEmitOwnedEventTypesViaWiredCallbacks() {
    val module = CapturingFullScreenModule()
    val holder = FakeRewardedAdHolder()
    module.adoptPolledAd(9, "unit-id", holder.proxy)

    assertNotNull(holder.eventCallback)
    holder.eventCallback!!.onAdClicked()
    assertEquals(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLICKED,
      module.events.single().type,
    )

    module.events.clear()
    holder.eventCallback!!.onAdPaid(AdValue(PrecisionType.PRECISE, 1_500_000, "USD"))
    val paid = module.events.single()
    assertEquals(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PAID, paid.type)
    assertEquals("USD", paid.data?.getString("currency"))
    assertEquals("1500000", paid.data?.getString("valueMicros"))

    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val rewardModule = CapturingRewardedShowModule(reactContext)
    rewardModule.adoptPolledAd(3, "reward-unit", holder.proxy)
    rewardModule.show(3, "reward-unit", JavaOnlyMap.of("immersiveModeEnabled", false), noOpPromise())
    shadowOf(activity.mainLooper).idle()
    ShadowLooper.idleMainLooper()
    assertNotNull(holder.rewardListener)
    holder.rewardListener!!.onUserEarnedReward(
      object : RewardItem {
        override val type: String = "gems"
        override val amount: Int = 4
      },
    )
    val reward =
      rewardModule.events.single {
        it.type == ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD
      }
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
    activity.setContentView(view)
    val banner = FakeBannerAd()

    val callback = manager.buildEventCallback(view, banner.proxy)
    callback.onAdClicked()
    shadowOf(activity.mainLooper).idle()
    ShadowLooper.idleMainLooper()
    assertEquals("onAdClicked", manager.events.single().type)

    manager.events.clear()
    callback.onAdPaid(AdValue(PrecisionType.PRECISE, 99_000, "JPY"))
    shadowOf(activity.mainLooper).idle()
    ShadowLooper.idleMainLooper()
    assertEquals("onPaid", manager.events.single().type)
    assertEquals(
      "JPY",
      manager.events
        .single()
        .payload
        ?.getString("currency"),
    )
  }

  @Test
  fun manualImpressionRequestConfigurationAndCommandRouting() {
    val request =
      ReactNativeGoogleMobileAdsCommon.buildBannerAdRequest(
        "/21775744923/example/banner",
        listOf(com.google.android.libraries.ads.mobile.sdk.banner.AdSize.BANNER),
        JavaOnlyMap.of("keywords", JavaOnlyArray.of("sports")),
        true,
      )
    assertTrue(request.manualImpressionRequested)

    val disabled =
      ReactNativeGoogleMobileAdsCommon.buildBannerAdRequest(
        "/21775744923/example/banner",
        listOf(com.google.android.libraries.ads.mobile.sdk.banner.AdSize.BANNER),
        JavaOnlyMap(),
        false,
      )
    assertFalse(disabled.manualImpressionRequested)

    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    val reactContext = BridgeReactContext(activity)
    reactContext.onHostResume(activity)
    val themed = ThemedReactContext(reactContext, activity)
    val manager = CapturingBannerManager()
    val view = manager.createViewInstance(themed)

    assertFalse(view.manualImpressionsEnabled)
    manager.setManualImpressionsEnabled(view, true)
    assertTrue(view.manualImpressionsEnabled)
    assertTrue(view.propsChanged)

    val banner = FakeBannerAd()
    manager.recordManualImpression(banner.proxy)
    assertEquals(1, banner.recordManualImpressionCount)

    manager.routeCommand(view, "recordManualImpression")
    assertEquals(
      "routeCommand without an AdView child must not call BannerAd.recordManualImpression",
      1,
      banner.recordManualImpressionCount,
    )
    manager.recordManualImpression(null)
    assertEquals(1, banner.recordManualImpressionCount)
  }

  private data class CapturedEvent(
    val type: String,
    val data: WritableMap?,
  )

  private data class CapturedBannerEvent(
    val type: String,
    val payload: WritableMap?,
  )

  private class CapturingFullScreenModule :
    ReactNativeGoogleMobileAdsFullScreenAdModule<RewardedAd>(
      null,
      "owned-callback-test",
    ) {
    val events = mutableListOf<CapturedEvent>()

    override fun getAdEventName(): String = "owned-callback-test"

    override fun loadAd(
      adRequest: AdRequest,
      adLoadCallback: AdLoadCallback<RewardedAd>,
    ) = Unit

    override fun sendAdEvent(
      type: String,
      requestId: Int,
      adUnitId: String,
      error: WritableMap?,
      data: WritableMap?,
    ) {
      events += CapturedEvent(type, data)
    }

    override fun responseInfoMap(responseInfo: ResponseInfo): WritableMap =
      JavaOnlyMap.of(
        "responseId",
        responseInfo.responseId,
        "adapterClassName",
        responseInfo.adapterClassName,
        "adapterResponses",
        JavaOnlyArray(),
      )

    override fun createEventMap(): WritableMap = JavaOnlyMap()

    override fun paidEventPayload(
      value: AdValue,
      responseInfo: ResponseInfo,
    ): WritableMap =
      JavaOnlyMap.of(
        "currency",
        value.currencyCode,
        "precision",
        3.0,
        "value",
        value.valueMicros * 1e-6,
        "valueMicros",
        value.valueMicros.toString(),
        "responseInfo",
        JavaOnlyMap.of(
          "responseId",
          responseInfo.responseId,
          "adapterClassName",
          responseInfo.adapterClassName,
        ),
      )
  }

  private class CapturingRewardedShowModule(
    reactContext: BridgeReactContext,
  ) : ReactNativeGoogleMobileAdsFullScreenAdModule<RewardedAd>(
      reactContext,
      "owned-reward-show-test",
    ) {
    val events = mutableListOf<CapturedEvent>()

    override fun getAdEventName(): String = "owned-reward-show-test"

    override fun loadAd(
      adRequest: AdRequest,
      adLoadCallback: AdLoadCallback<RewardedAd>,
    ) = Unit

    override fun sendAdEvent(
      type: String,
      requestId: Int,
      adUnitId: String,
      error: WritableMap?,
      data: WritableMap?,
    ) {
      events += CapturedEvent(type, data)
    }

    override fun responseInfoMap(responseInfo: ResponseInfo): WritableMap =
      JavaOnlyMap.of(
        "responseId",
        responseInfo.responseId,
      )

    override fun createEventMap(): WritableMap = JavaOnlyMap()

    override fun paidEventPayload(
      value: AdValue,
      responseInfo: ResponseInfo,
    ): WritableMap =
      JavaOnlyMap.of(
        "currency",
        value.currencyCode,
      )
  }

  private class CapturingBannerManager : ReactNativeGoogleMobileAdsBannerAdViewManager() {
    val events = mutableListOf<CapturedBannerEvent>()

    override fun sendEvent(
      view: ReactNativeAdView,
      type: String,
      payload: WritableMap?,
    ) {
      events += CapturedBannerEvent(type, payload)
    }

    override fun paidEventPayload(
      value: AdValue,
      responseInfo: ResponseInfo,
    ): WritableMap =
      JavaOnlyMap.of(
        "currency",
        value.currencyCode,
        "valueMicros",
        value.valueMicros.toString(),
      )
  }

  private class FakeRewardedAdHolder {
    var eventCallback: RewardedAdEventCallback? = null
    var rewardListener: OnUserEarnedRewardListener? = null
    private val responseInfo =
      ResponseInfo(
        "adapter.class",
        "response-id",
        Bundle(),
        null,
        emptyList(),
      )

    val proxy: RewardedAd =
      Proxy.newProxyInstance(
        RewardedAd::class.java.classLoader,
        arrayOf(RewardedAd::class.java),
      ) { proxy, method, args ->
        when (method.name) {
          "getPlacementId" -> 0L
          "setPlacementId", "destroy", "setImmersiveMode", "setServerSideVerificationOptions" -> null
          "getAdUnitId" -> "unit-id"
          "getResponseInfo" -> responseInfo
          "getRewardItem" ->
            object : RewardItem {
              override val type: String = "coins"
              override val amount: Int = 1
            }
          "getAdEventCallback" -> eventCallback
          "setAdEventCallback" -> {
            eventCallback = args?.get(0) as RewardedAdEventCallback?
            null
          }
          "show" -> {
            rewardListener = args?.get(1) as OnUserEarnedRewardListener?
            null
          }
          "toString" -> "FakeRewardedAd"
          "hashCode" -> System.identityHashCode(proxy)
          "equals" -> proxy === args?.firstOrNull()
          else -> null
        }
      } as RewardedAd
  }

  private class FakeBannerAd {
    var recordManualImpressionCount = 0
    private val responseInfo =
      ResponseInfo(
        "adapter.class",
        "banner-response",
        Bundle(),
        null,
        emptyList(),
      )

    val proxy: BannerAd =
      Proxy.newProxyInstance(
        BannerAd::class.java.classLoader,
        arrayOf(BannerAd::class.java),
      ) { proxy, method, args ->
        when (method.name) {
          "getPlacementId" -> 0L
          "setPlacementId", "destroy" -> null
          "getAdUnitId" -> "/21775744923/example/banner"
          "getResponseInfo" -> responseInfo
          "recordManualImpression" -> {
            recordManualImpressionCount++
            null
          }
          "isCollapsible" -> false
          "toString" -> "FakeBannerAd"
          "hashCode" -> System.identityHashCode(proxy)
          "equals" -> proxy === args?.firstOrNull()
          else -> null
        }
      } as BannerAd
  }

  private fun noOpPromise(): Promise =
    Proxy.newProxyInstance(
      Promise::class.java.classLoader,
      arrayOf(Promise::class.java),
    ) { _, _, _ -> null } as Promise
}
