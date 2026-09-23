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

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.google.android.libraries.ads.mobile.sdk.appopen.AppOpenAd
import com.google.android.libraries.ads.mobile.sdk.appopen.AppOpenAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.common.Ad
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAd
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAd
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.rewarded.ServerSideVerificationOptions
import com.google.android.libraries.ads.mobile.sdk.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.libraries.ads.mobile.sdk.rewardedinterstitial.RewardedInterstitialAdEventCallback
import io.invertase.googlemobileads.common.ReactNativeModule

abstract class ReactNativeGoogleMobileAdsFullScreenAdModule<T : Ad>(
  reactContext: ReactApplicationContext?,
  moduleName: String,
) : ReactNativeModule(reactContext, moduleName) {
  init {
    FullscreenAdModuleRefs.register(this)
  }

  private val slots = FullscreenRequestSlotTracker<T>()

  abstract fun getAdEventName(): String

  abstract fun loadAd(
    adRequest: AdRequest,
    adLoadCallback: AdLoadCallback<T>,
  )

  protected open fun sendAdEvent(
    type: String,
    requestId: Int,
    adUnitId: String,
    error: WritableMap? = null,
    data: WritableMap? = null,
  ) {
    // ReactNativeEventEmitter posts onto the main looper before touching the RN bridge.
    ReactNativeGoogleMobileAdsCommon.sendAdEvent(
      getAdEventName(),
      requestId,
      type,
      adUnitId,
      error,
      data,
    )
  }

  fun load(
    requestId: Int,
    adUnitId: String,
    adRequestOptions: ReadableMap,
  ) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      val error =
        ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
          "null-activity",
          "Ad attempted to load but the current Activity was null.",
          "load",
        )
      sendAdEvent(
        ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
        requestId,
        adUnitId,
        error,
      )
      return
    }

    val generation = slots.beginLoad(requestId)
    NextGenMobileAdsGate.runWhenInitialized(
      onFailure = {
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
          requestId,
          adUnitId,
          ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
            it.code,
            it.message,
            "load",
          ),
        )
      },
    ) {
      if (slots.generation(requestId) != generation) return@runWhenInitialized
      val adRequest =
        ReactNativeGoogleMobileAdsCommon.buildAdRequest(adUnitId, adRequestOptions)
      val callback = ReactNativeGoogleMobileAdsAdLoadCallback(requestId, generation, adUnitId, adRequestOptions)
      activity.runOnUiThread {
        loadAd(adRequest, callback)
      }
    }
  }

  fun show(
    requestId: Int,
    adUnitId: String,
    showOptions: ReadableMap,
    promise: Promise,
  ) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      rejectPromiseWithCodeAndMessage(
        promise,
        "null-activity",
        "Ad attempted to show but the current Activity was null.",
      )
      return
    }

    activity.runOnUiThread {
      val ad = slots.get(requestId)
      if (ad == null) {
        rejectPromiseWithCodeAndMessage(
          promise,
          "not-ready",
          "Ad attempted to show but was not ready.",
        )
        return@runOnUiThread
      }

      val immersiveModeEnabled =
        showOptions.hasKey("immersiveModeEnabled") &&
          showOptions.getBoolean("immersiveModeEnabled")
      when (ad) {
        is RewardedAd -> {
          ad.setImmersiveMode(immersiveModeEnabled)
          ad.show(activity) { rewardItem ->
            sendRewardEvent(requestId, adUnitId, rewardItem.type, rewardItem.amount)
          }
        }
        is RewardedInterstitialAd -> {
          ad.setImmersiveMode(immersiveModeEnabled)
          ad.show(activity) { rewardItem ->
            sendRewardEvent(requestId, adUnitId, rewardItem.type, rewardItem.amount)
          }
        }
        is InterstitialAd -> {
          ad.setImmersiveMode(immersiveModeEnabled)
          ad.show(activity)
        }
        is AppOpenAd -> {
          ad.setImmersiveMode(immersiveModeEnabled)
          ad.show(activity)
        }
      }
      promise.resolve(null)
    }
  }

  fun destroy(requestId: Int) {
    slots.get(requestId)?.destroy()
    slots.destroy(requestId)
  }

  fun adoptPolledAd(
    requestId: Int,
    adUnitId: String,
    ad: T,
  ) {
    val generation = slots.beginLoad(requestId)
    if (!slots.tryCommit(requestId, generation, ad)) {
      ad.destroy()
      return
    }
    wireCallbacks(requestId, adUnitId, ad, null)
  }

  @Suppress("UNCHECKED_CAST")
  internal fun adoptPolledAdAny(
    requestId: Int,
    adUnitId: String,
    ad: Any,
  ) {
    adoptPolledAd(requestId, adUnitId, ad as T)
  }

  private fun sendRewardEvent(
    requestId: Int,
    adUnitId: String,
    type: String,
    amount: Int,
  ) {
    val data = createEventMap()
    data.putString("type", type)
    data.putInt("amount", amount)
    sendAdEvent(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD,
      requestId,
      adUnitId,
      data = data,
    )
  }

  internal fun sendLoadedEvent(
    requestId: Int,
    adUnitId: String,
    ad: T,
  ) {
    val responseInfo = responseInfoMap(ad.getResponseInfo())
    if (ad is RewardedAd || ad is RewardedInterstitialAd) {
      val rewardItem =
        when (ad) {
          is RewardedAd -> ad.getRewardItem()
          is RewardedInterstitialAd -> ad.getRewardItem()
          else -> error("unreachable")
        }
      val data = createEventMap()
      data.putString("type", rewardItem.type)
      data.putInt("amount", rewardItem.amount)
      if (responseInfo != null) {
        data.putMap("responseInfo", responseInfo)
      }
      sendAdEvent(
        ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED,
        requestId,
        adUnitId,
        data = data,
      )
      return
    }
    val data =
      if (responseInfo == null) {
        null
      } else {
        createEventMap().apply {
          putMap("responseInfo", responseInfo)
        }
      }
    sendAdEvent(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_LOADED,
      requestId,
      adUnitId,
      data = data,
    )
  }

  private fun wireCallbacks(
    requestId: Int,
    adUnitId: String,
    ad: T,
    adRequestOptions: ReadableMap?,
  ) {
    configureServerSideVerification(ad, adRequestOptions)

    when (ad) {
      is AppOpenAd ->
        ad.adEventCallback =
          object : AppOpenAdEventCallback {
            override fun onAdShowedFullScreenContent() = sendSimpleEvent(requestId, adUnitId, "opened")

            override fun onAdDismissedFullScreenContent() = handleDismissed(requestId, adUnitId, ad)

            override fun onAdClicked() = sendSimpleEvent(requestId, adUnitId, "clicked")

            override fun onAdImpression() = sendSimpleEvent(requestId, adUnitId, "impression")

            override fun onAdPaid(value: AdValue) = sendPaidEvent(requestId, adUnitId, ad, value)

            override fun onAdFailedToShowFullScreenContent(error: FullScreenContentError) =
              handleShowFailure(requestId, adUnitId, ad, error)
          }
      is InterstitialAd ->
        ad.adEventCallback =
          object : InterstitialAdEventCallback {
            override fun onAdShowedFullScreenContent() = sendSimpleEvent(requestId, adUnitId, "opened")

            override fun onAdDismissedFullScreenContent() = handleDismissed(requestId, adUnitId, ad)

            override fun onAdClicked() = sendSimpleEvent(requestId, adUnitId, "clicked")

            override fun onAdImpression() = sendSimpleEvent(requestId, adUnitId, "impression")

            override fun onAdPaid(value: AdValue) = sendPaidEvent(requestId, adUnitId, ad, value)

            override fun onAppEvent(
              name: String,
              data: String?,
            ) {
              val payload = createEventMap()
              payload.putString("name", name)
              payload.putString("data", data)
              sendAdEvent(
                ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_APP_EVENT,
                requestId,
                adUnitId,
                data = payload,
              )
            }

            override fun onAdFailedToShowFullScreenContent(error: FullScreenContentError) =
              handleShowFailure(requestId, adUnitId, ad, error)
          }
      is RewardedAd ->
        ad.adEventCallback =
          object : RewardedAdEventCallback {
            override fun onAdShowedFullScreenContent() = sendSimpleEvent(requestId, adUnitId, "opened")

            override fun onAdDismissedFullScreenContent() = handleDismissed(requestId, adUnitId, ad)

            override fun onAdClicked() = sendSimpleEvent(requestId, adUnitId, "clicked")

            override fun onAdImpression() = sendSimpleEvent(requestId, adUnitId, "impression")

            override fun onAdPaid(value: AdValue) = sendPaidEvent(requestId, adUnitId, ad, value)

            override fun onAdFailedToShowFullScreenContent(error: FullScreenContentError) =
              handleShowFailure(requestId, adUnitId, ad, error)
          }
      is RewardedInterstitialAd ->
        ad.adEventCallback =
          object : RewardedInterstitialAdEventCallback {
            override fun onAdShowedFullScreenContent() = sendSimpleEvent(requestId, adUnitId, "opened")

            override fun onAdDismissedFullScreenContent() = handleDismissed(requestId, adUnitId, ad)

            override fun onAdClicked() = sendSimpleEvent(requestId, adUnitId, "clicked")

            override fun onAdImpression() = sendSimpleEvent(requestId, adUnitId, "impression")

            override fun onAdPaid(value: AdValue) = sendPaidEvent(requestId, adUnitId, ad, value)

            override fun onAdFailedToShowFullScreenContent(error: FullScreenContentError) =
              handleShowFailure(requestId, adUnitId, ad, error)
          }
    }
  }

  private fun configureServerSideVerification(
    ad: T,
    adRequestOptions: ReadableMap?,
  ) {
    val readableOptions = adRequestOptions?.getMap("serverSideVerificationOptions") ?: return
    val options =
      ServerSideVerificationOptions(
        readableOptions.getString("userId").orEmpty(),
        readableOptions.getString("customData").orEmpty(),
      )
    when (ad) {
      is RewardedAd -> ad.setServerSideVerificationOptions(options)
      is RewardedInterstitialAd -> ad.setServerSideVerificationOptions(options)
    }
  }

  private fun sendSimpleEvent(
    requestId: Int,
    adUnitId: String,
    type: String,
  ) {
    sendAdEvent(type, requestId, adUnitId)
  }

  private fun handleDismissed(
    requestId: Int,
    adUnitId: String,
    ad: Ad,
  ) {
    slots.evict(requestId)
    ad.destroy()
    sendSimpleEvent(requestId, adUnitId, ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLOSED)
  }

  private fun handleShowFailure(
    requestId: Int,
    adUnitId: String,
    ad: Ad,
    error: FullScreenContentError,
  ) {
    slots.evict(requestId)
    ad.destroy()
    sendAdEvent(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
      requestId,
      adUnitId,
      ReactNativeGoogleMobileAdsCommon.fullScreenContentErrorToMap(error),
    )
  }

  internal fun sendPaidEvent(
    requestId: Int,
    adUnitId: String,
    ad: Ad,
    value: AdValue,
  ) {
    sendAdEvent(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PAID,
      requestId,
      adUnitId,
      data = paidEventPayload(value, ad.getResponseInfo()),
    )
  }

  protected open fun responseInfoMap(responseInfo: ResponseInfo): WritableMap? =
    ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(responseInfo)

  protected open fun paidEventPayload(
    value: AdValue,
    responseInfo: ResponseInfo,
  ): WritableMap = ReactNativeGoogleMobileAdsResponseInfo.paidEventPayload(value, responseInfo)

  protected open fun createEventMap(): WritableMap = Arguments.createMap()

  override fun invalidate() {
    FullscreenAdModuleRefs.unregister(name)
    slots.clear()
    super.invalidate()
  }

  inner class ReactNativeGoogleMobileAdsAdLoadCallback(
    private val requestId: Int,
    private val generation: Int,
    private val adUnitId: String,
    private val adRequestOptions: ReadableMap,
  ) : AdLoadCallback<T> {
    override fun onAdLoaded(ad: T) {
      try {
        if (!slots.tryCommit(requestId, generation, ad)) {
          ad.destroy()
          return
        }
        wireCallbacks(requestId, adUnitId, ad, adRequestOptions)
        sendLoadedEvent(requestId, adUnitId, ad)
      } catch (exception: Exception) {
        Log.w("RNGoogleMobileAds", "Unknown error on full-screen ad load", exception)
        slots.evict(requestId)
        ad.destroy()
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
          requestId,
          adUnitId,
          ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
            "internal-error",
            exception.message,
            "load",
          ),
        )
      }
    }

    override fun onAdFailedToLoad(adError: LoadAdError) {
      if (slots.generation(requestId) != generation) {
        return
      }
      sendAdEvent(
        ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
        requestId,
        adUnitId,
        ReactNativeGoogleMobileAdsCommon.loadAdErrorToMap(adError),
      )
    }
  }
}
