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
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdLoadCallback
import com.google.android.gms.ads.AdValue
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.OnPaidEventListener
import com.google.android.gms.ads.OnUserEarnedRewardListener
import com.google.android.gms.ads.ResponseInfo
import com.google.android.gms.ads.admanager.AdManagerAdRequest
import com.google.android.gms.ads.admanager.AdManagerInterstitialAd
import com.google.android.gms.ads.appopen.AppOpenAd
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_APP_EVENT
import io.invertase.googlemobileads.common.ReactNativeModule

abstract class ReactNativeGoogleMobileAdsFullScreenAdModule<T : Any>(
  reactContext: ReactApplicationContext?,
  moduleName: String,
) : ReactNativeModule(reactContext, moduleName) {
  init {
    FullscreenAdModuleRefs.register(this)
  }

  private val slots = FullscreenRequestSlotTracker<T>()

  abstract fun getAdEventName(): String

  abstract fun loadAd(
    activity: Activity,
    adUnitId: String,
    adRequest: AdManagerAdRequest,
    adLoadCallback: AdLoadCallback<T>,
  )

  /** Spy-friendly seam for owned JVM tests (parity with Next-Gen). */
  protected open fun sendAdEvent(
    type: String,
    requestId: Int,
    adUnitId: String,
    error: WritableMap?,
    data: WritableMap?,
  ) {
    ReactNativeGoogleMobileAdsCommon.sendAdEvent(
      getAdEventName(),
      requestId,
      type,
      adUnitId,
      error,
      data,
    )
  }

  protected open fun createEventMap(): WritableMap = Arguments.createMap()

  protected open fun paidEventPayload(
    adValue: AdValue,
    responseInfo: ResponseInfo?,
  ): WritableMap = ReactNativeGoogleMobileAdsResponseInfo.paidEventPayload(adValue, responseInfo)

  /** Spy-friendly seam: load / adopt attach paid listeners through here. */
  protected open fun attachPaidEventListener(
    ad: T,
    listener: OnPaidEventListener,
  ) {
    when (ad) {
      is InterstitialAd -> ad.onPaidEventListener = listener
      is AppOpenAd -> ad.onPaidEventListener = listener
      is RewardedAd -> ad.onPaidEventListener = listener
      is RewardedInterstitialAd -> ad.onPaidEventListener = listener
    }
  }

  /** Spy-friendly seam: load / adopt attach fullscreen content callbacks through here. */
  protected open fun attachFullScreenContentCallback(
    ad: T,
    callback: FullScreenContentCallback,
  ) {
    ReactNativeGoogleMobileAdsAdHelper(ad).setFullScreenContentCallback(callback)
  }

  /** Spy-friendly seam: show wires the earned-reward listener through here. */
  protected open fun presentAd(
    ad: T,
    activity: Activity,
    onUserEarnedRewardListener: OnUserEarnedRewardListener?,
  ) {
    ReactNativeGoogleMobileAdsAdHelper(ad).show(activity, onUserEarnedRewardListener)
  }

  internal fun emitPaidEvent(
    requestId: Int,
    adUnitId: String,
    adValue: AdValue,
    responseInfo: ResponseInfo?,
  ) {
    sendAdEvent(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PAID,
      requestId,
      adUnitId,
      null,
      paidEventPayload(adValue, responseInfo),
    )
  }

  internal fun emitEarnedReward(
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
      null,
      data,
    )
  }

  internal fun presentingContentCallback(
    requestId: Int,
    adUnitId: String,
  ): FullScreenContentCallback =
    object : FullScreenContentCallback() {
      override fun onAdShowedFullScreenContent() {
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_OPENED,
          requestId,
          adUnitId,
          null,
          null,
        )
      }

      override fun onAdDismissedFullScreenContent() {
        slots.evict(requestId)
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLOSED,
          requestId,
          adUnitId,
          null,
          null,
        )
      }

      override fun onAdClicked() {
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLICKED,
          requestId,
          adUnitId,
          null,
          null,
        )
      }

      override fun onAdImpression() {
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_IMPRESSION,
          requestId,
          adUnitId,
          null,
          null,
        )
      }

      override fun onAdFailedToShowFullScreenContent(adError: AdError) {
        slots.evict(requestId)
        val error = ReactNativeGoogleMobileAdsCommon.adErrorToMap(adError, "show")
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
          requestId,
          adUnitId,
          error,
          null,
        )
      }
    }

  fun load(
    requestId: Int,
    adUnitId: String,
    adRequestOptions: ReadableMap,
  ) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      val error = Arguments.createMap()
      error.putString("code", "null-activity")
      error.putString(
        "message",
        "Ad attempted to load but the current Activity was null.",
      )
      sendAdEvent(
        ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
        requestId,
        adUnitId,
        error,
        null,
      )
      return
    }
    val adRequest = ReactNativeGoogleMobileAdsCommon.buildAdRequest(adRequestOptions)
    val generation = slots.beginLoad(requestId)
    val adLoadCallback =
      ReactNativeGoogleMobileAdsAdLoadCallback(
        requestId,
        generation,
        adUnitId,
        adRequestOptions,
      )
    activity.runOnUiThread {
      loadAd(
        activity,
        adUnitId,
        adRequest,
        adLoadCallback,
      )
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
      val adHelper = ReactNativeGoogleMobileAdsAdHelper(ad)

      var immersiveModeEnabled = false
      if (showOptions.hasKey("immersiveModeEnabled")) {
        immersiveModeEnabled = showOptions.getBoolean("immersiveModeEnabled")
      }
      adHelper.setImmersiveMode(immersiveModeEnabled)

      presentAd(ad, activity) { rewardItem ->
        emitEarnedReward(requestId, adUnitId, rewardItem.type, rewardItem.amount)
      }
      promise.resolve(null)
    }
  }

  fun destroy(requestId: Int) {
    // Same thread affinity as beginLoad (module/JS bridge thread): SparseArray
    // mutations must not race an async UI hop against in-flight loads.
    slots.destroy(requestId)
  }

  /**
   * Adopt a preloader-polled ad into this module's requestId map and wire
   * fullscreen / paid callbacks. Does not emit LOADED — the JS pooled ad is
   * already considered ready.
   */
  fun adoptPolledAd(
    requestId: Int,
    adUnitId: String,
    ad: T,
  ) {
    slots.adopt(requestId, ad)
    // createEventMap() is the spy-friendly WritableMap seam (avoids Arguments/JNI in JVM tests).
    wirePresentingCallbacks(requestId, adUnitId, ad, createEventMap())
  }

  /** Pool poll passes a concrete preloader ad; star-projection entry for shared helpers. */
  @Suppress("UNCHECKED_CAST")
  internal fun adoptPolledAdAny(
    requestId: Int,
    adUnitId: String,
    ad: Any,
  ) {
    val typed = ad as T
    slots.adopt(requestId, typed)
    wirePresentingCallbacks(requestId, adUnitId, typed, createEventMap())
  }

  private fun wirePresentingCallbacks(
    requestId: Int,
    adUnitId: String,
    ad: T,
    adRequestOptions: ReadableMap,
  ) {
    val adHelper = ReactNativeGoogleMobileAdsAdHelper(ad)

    attachPaidEventListener(ad) { adValue ->
      emitPaidEvent(requestId, adUnitId, adValue, adHelper.responseInfo)
    }

    if (ad is RewardedAd || ad is RewardedInterstitialAd) {
      adRequestOptions
        .getMap("serverSideVerificationOptions")
        ?.let { serverSideVerificationOptions ->
          val options = ServerSideVerificationOptions.Builder()
          serverSideVerificationOptions.getString("userId")?.let {
            options.setUserId(it)
          }
          serverSideVerificationOptions.getString("customData")?.let {
            options.setCustomData(it)
          }
          adHelper.setServerSideVerificationOptions(options.build())
        }
    }

    if (ad is AdManagerInterstitialAd) {
      adHelper.setAppEventListener { name, eventData ->
        val payload = Arguments.createMap()
        payload.putString("name", name)
        payload.putString("data", eventData)
        sendAdEvent(
          GOOGLE_MOBILE_ADS_EVENT_APP_EVENT,
          requestId,
          adUnitId,
          null,
          payload,
        )
      }
    }

    attachFullScreenContentCallback(ad, presentingContentCallback(requestId, adUnitId))
  }

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
  ) : AdLoadCallback<T>() {
    override fun onAdLoaded(ad: T) {
      try {
        if (!slots.tryCommit(requestId, generation, ad)) {
          // Destroyed or superseded while loading — drop without emitting LOADED.
          return
        }

        val adHelper = ReactNativeGoogleMobileAdsAdHelper(ad)
        var eventType = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_LOADED
        var data: WritableMap? = null

        val responseInfoMap =
          ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(adHelper.responseInfo)

        if (ad is RewardedAd || ad is RewardedInterstitialAd) {
          eventType = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED

          val rewardItem = adHelper.rewardItem
          data = Arguments.createMap()
          data.putString("type", rewardItem.type)
          data.putInt("amount", rewardItem.amount)
          if (responseInfoMap != null) {
            data.putMap("responseInfo", responseInfoMap)
          }
        } else if (responseInfoMap != null) {
          data = Arguments.createMap()
          data.putMap("responseInfo", responseInfoMap)
        }

        // Shared attach site with adoptPolledAd (paid / click / SSV / app-event / fullscreen).
        wirePresentingCallbacks(requestId, adUnitId, ad, adRequestOptions)

        sendAdEvent(
          eventType,
          requestId,
          adUnitId,
          null,
          data,
        )
      } catch (e: Exception) {
        Log.w("RNGoogleMobileAds", "Unknown error on load")
        Log.w("RNGoogleMobileAds", e)
        slots.evict(requestId)
        val error =
          ReactNativeGoogleMobileAdsCommon.buildAdErrorMap("internal-error", e.message, "load")
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
          requestId,
          adUnitId,
          error,
          null,
        )
      }
    }

    override fun onAdFailedToLoad(loadAdError: LoadAdError) {
      if (slots.generation(requestId) != generation) {
        return
      }
      val error = ReactNativeGoogleMobileAdsCommon.adErrorToMap(loadAdError, "load")
      ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(loadAdError.responseInfo)?.let {
        error.putMap("responseInfo", it)
      }
      sendAdEvent(
        ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
        requestId,
        adUnitId,
        error,
        null,
      )
    }
  }
}
