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
import android.util.SparseArray
import com.facebook.react.bridge.*
import com.google.android.libraries.ads.mobile.sdk.common.Ad
import com.google.android.libraries.ads.mobile.sdk.common.AdEventCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardItem
import io.invertase.googlemobileads.common.ReactNativeModule

/**
 * GMA Next-Gen SDK backed equivalent of the legacy `ReactNativeGoogleMobileAdsFullScreenAdModule`.
 *
 * Unlike the legacy SDK, GMA Next-Gen SDK exposes a single shared [Ad] / [AdLoadCallback] /
 * [AdEventCallback] surface across all full-screen formats, so most of this base class is no
 * longer format-specific - only ad loading, showing, event callback attachment, and (for
 * rewarded formats) server-side verification / reward item access differ per format and are left
 * to subclasses.
 *
 * GMA Next-Gen SDK's `load()` does not require an Activity (unlike the legacy SDK), only `show()`
 * does, so the null-activity guard here only applies to show().
 */
abstract class ReactNativeGoogleMobileAdsFullScreenAdModule<T : Ad>(
  reactContext: ReactApplicationContext?,
  moduleName: String
) : ReactNativeModule(reactContext, moduleName) {
  private val adArray = SparseArray<T>()

  abstract fun getAdEventName(): String

  abstract fun loadAd(adRequest: AdRequest, adLoadCallback: AdLoadCallback<T>)

  /** Assign `ad.adEventCallback`, delegating to [callback] for the shared event methods and
   * implementing any format-specific extras (e.g. Interstitial's onAppEvent). */
  abstract fun attachAdEventCallback(ad: T, callback: SharedAdEventCallback)

  abstract fun showAd(ad: T, activity: Activity, onUserEarnedReward: (RewardItem) -> Unit)

  abstract fun setImmersiveModeOnAd(ad: T, enabled: Boolean)

  /** Only Rewarded / RewardedInterstitial override this. */
  open fun applyServerSideVerificationOptions(ad: T, options: ReadableMap) {}

  /** Only Rewarded / RewardedInterstitial override this, returning the reward payload used for
   * the "rewarded_loaded" event; other formats keep the default "loaded" event. */
  open fun getRewardedLoadedData(ad: T): WritableMap? = null

  private fun sendAdEvent(
    type: String,
    requestId: Int,
    adUnitId: String,
    error: WritableMap?,
    data: WritableMap?
  ) {
    ReactNativeGoogleMobileAdsCommon.sendAdEvent(getAdEventName(), requestId, type, adUnitId, error, data)
  }

  fun load(requestId: Int, adUnitId: String, adRequestOptions: ReadableMap) {
    val adRequest = ReactNativeGoogleMobileAdsCommon.buildAdRequest(adUnitId, adRequestOptions)
    loadAd(adRequest, SharedAdLoadCallback(requestId, adUnitId, adRequestOptions))
  }

  fun show(requestId: Int, adUnitId: String, showOptions: ReadableMap, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      rejectPromiseWithCodeAndMessage(
        promise,
        "null-activity",
        "Ad attempted to show but the current Activity was null."
      )
      return
    }
    activity.runOnUiThread {
      val ad = adArray[requestId]

      var immersiveModeEnabled = false
      if (showOptions.hasKey("immersiveModeEnabled")) {
        immersiveModeEnabled = showOptions.getBoolean("immersiveModeEnabled")
      }
      setImmersiveModeOnAd(ad, immersiveModeEnabled)

      showAd(ad, activity) { rewardItem ->
        val data = Arguments.createMap()
        data.putString("type", rewardItem.type)
        data.putInt("amount", rewardItem.amount)
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD,
          requestId,
          adUnitId,
          null,
          data
        )
      }
      promise.resolve(null)
    }
  }

  /** Shared [AdEventCallback] logic - format-specific event callback types (e.g.
   * InterstitialAdEventCallback) delegate to an instance of this via Kotlin's `by` delegation and
   * only need to implement whatever extra methods their format adds (e.g. onAppEvent, which can
   * call [onAppEvent] below to emit the event). */
  inner class SharedAdEventCallback(
    private val requestId: Int,
    private val adUnitId: String
  ) : AdEventCallback {
    override fun onAdShowedFullScreenContent() {
      sendAdEvent(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_OPENED, requestId, adUnitId, null, null)
    }

    override fun onAdDismissedFullScreenContent() {
      sendAdEvent(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLOSED, requestId, adUnitId, null, null)
    }

    override fun onAdFailedToShowFullScreenContent(error: FullScreenContentError) {
      val errorMap = Arguments.createMap()
      errorMap.putString("code", "internal")
      errorMap.putString("message", error.message)
      sendAdEvent(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR, requestId, adUnitId, errorMap, null)
    }

    override fun onAdImpression() {
      // Not implemented yet, matches legacy behaviour.
    }

    override fun onAdClicked() {
      sendAdEvent(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLICKED, requestId, adUnitId, null, null)
    }

    override fun onAdPaid(adValue: AdValue) {
      val payload = Arguments.createMap()
      payload.putDouble("value", 1e-6 * adValue.valueMicros)
      payload.putDouble("precision", 1.0 * adValue.precisionType.ordinal)
      payload.putString("currency", adValue.currencyCode)
      sendAdEvent(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PAID, requestId, adUnitId, null, payload)
    }

    fun onAppEvent(name: String, data: String) {
      val payload = Arguments.createMap()
      payload.putString("name", name)
      payload.putString("data", data)
      sendAdEvent(
        ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_APP_EVENT,
        requestId,
        adUnitId,
        null,
        payload
      )
    }
  }

  private inner class SharedAdLoadCallback(
    private val requestId: Int,
    private val adUnitId: String,
    private val adRequestOptions: ReadableMap
  ) : AdLoadCallback<T> {
    override fun onAdLoaded(ad: T) {
      try {
        attachAdEventCallback(ad, SharedAdEventCallback(requestId, adUnitId))

        var eventType = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_LOADED
        val rewardedData = getRewardedLoadedData(ad)
        if (rewardedData != null) {
          eventType = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED
          adRequestOptions.getMap("serverSideVerificationOptions")?.let {
            applyServerSideVerificationOptions(ad, it)
          }
        }

        adArray.put(requestId, ad)
        sendAdEvent(eventType, requestId, adUnitId, null, rewardedData)
      } catch (e: Exception) {
        Log.w("RNGoogleMobileAds", "Unknown error on load")
        Log.w("RNGoogleMobileAds", e)
        val error = Arguments.createMap()
        error.putString("code", "internal")
        error.putString("message", e.message)
        sendAdEvent(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR, requestId, adUnitId, error, null)
      }
    }

    override fun onAdFailedToLoad(loadAdError: LoadAdError) {
      val error = Arguments.createMap()
      val codeAndMessage = ReactNativeGoogleMobileAdsCommon.getCodeAndMessageFromAdError(loadAdError)
      error.putString("code", codeAndMessage[0])
      error.putString("message", codeAndMessage[1])
      sendAdEvent(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR, requestId, adUnitId, error, null)
    }
  }
}
