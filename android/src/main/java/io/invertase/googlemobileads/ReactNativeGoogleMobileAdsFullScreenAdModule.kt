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
import com.google.android.gms.ads.AdLoadCallback
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.OnPaidEventListener;
import com.google.android.gms.ads.admanager.AdManagerAdRequest
import com.google.android.gms.ads.admanager.AdManagerInterstitialAd
import com.google.android.gms.ads.appopen.AppOpenAd
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_APP_EVENT
import io.invertase.googlemobileads.common.ReactNativeModule

abstract class ReactNativeGoogleMobileAdsFullScreenAdModule<T>(
  reactContext: ReactApplicationContext?,
  moduleName: String
) : ReactNativeModule(reactContext, moduleName) {
  private val adArray = SparseArray<T>()

  abstract fun getAdEventName(): String

  abstract fun loadAd(
    activity: Activity,
    adUnitId: String,
    adRequest: AdManagerAdRequest,
    adLoadCallback: AdLoadCallback<T>
  )

  private fun sendAdEvent(
    type: String,
    requestId: Int,
    adUnitId: String,
    error: WritableMap?,
    data: WritableMap?
  ) {
    ReactNativeGoogleMobileAdsCommon.sendAdEvent(
      getAdEventName(),
      requestId,
      type,
      adUnitId,
      error,
      data
    )
  }

  fun load(
    requestId: Int, adUnitId: String, adRequestOptions: ReadableMap
  ) {
    val activity = currentActivity
    if (activity == null) {
      val error = Arguments.createMap()
      error.putString("code", "null-activity")
      error.putString(
        "message",
        "Ad attempted to load but the current Activity was null."
      )
      sendAdEvent(
        ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
        requestId,
        adUnitId,
        error,
        null
      )
      return
    }
    val adRequest = ReactNativeGoogleMobileAdsCommon.buildAdRequest(adRequestOptions)
    val adLoadCallback = ReactNativeGoogleMobileAdsAdLoadCallback(
      requestId,
      adUnitId,
      adRequestOptions
    )
    activity.runOnUiThread {
      loadAd(
        activity,
        adUnitId,
        adRequest,
        adLoadCallback
      )
    }
  }

  fun show(
    requestId: Int, adUnitId: String, showOptions: ReadableMap, promise: Promise
  ) {
    val activity = currentActivity
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
      val adHelper = ReactNativeGoogleMobileAdsAdHelper(ad)

      var immersiveModeEnabled = false
      if (showOptions.hasKey("immersiveModeEnabled")) {
        immersiveModeEnabled = showOptions.getBoolean("immersiveModeEnabled")
      }
      adHelper.setImmersiveMode(immersiveModeEnabled)

      adHelper.show(activity) { rewardItem ->
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

  inner class ReactNativeGoogleMobileAdsAdLoadCallback(
    private val requestId: Int,
    private val adUnitId: String,
    private val adRequestOptions: ReadableMap
  ) : AdLoadCallback<T>() {
    override fun onAdLoaded(ad: T) {
      try {
        val adHelper = ReactNativeGoogleMobileAdsAdHelper(ad)
        var eventType = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_LOADED
        var data: WritableMap? = null

        var paidEventListener = OnPaidEventListener { adValue ->
          val payload = Arguments.createMap()
          payload.putDouble("value", 1e-6 * adValue.getValueMicros());
          payload.putDouble("precision", 1.0 * adValue.getPrecisionType());
          payload.putString("currency", adValue.getCurrencyCode());
          sendAdEvent(
            ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PAID,
            requestId,
            adUnitId,
            null,
            payload
          )
        }

        when (ad) {
          is AdManagerInterstitialAd -> ad.onPaidEventListener = paidEventListener
          is AppOpenAd -> ad.onPaidEventListener = paidEventListener
          is RewardedAd -> ad.onPaidEventListener = paidEventListener
          is RewardedInterstitialAd -> ad.onPaidEventListener = paidEventListener
        }

        if (ad is RewardedAd || ad is RewardedInterstitialAd) {
          eventType = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED

          val rewardItem = adHelper.rewardItem
          data = Arguments.createMap()
          data.putString("type", rewardItem.type)
          data.putInt("amount", rewardItem.amount)

          adRequestOptions.getMap("serverSideVerificationOptions")
            ?.let { serverSideVerificationOptions ->
              val options =
                ServerSideVerificationOptions.Builder()
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
              payload
            )
          }
        }

        val fullScreenContentCallback: FullScreenContentCallback =
          object : FullScreenContentCallback() {
            override fun onAdShowedFullScreenContent() {
              sendAdEvent(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_OPENED)
            }

            override fun onAdDismissedFullScreenContent() {
              sendAdEvent(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLOSED)
            }

            override fun onAdClicked() {
              sendAdEvent(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLICKED)
            }

            override fun onAdImpression() {
              // Not Implemented Yet
            }

            private fun sendAdEvent(type: String) {
              sendAdEvent(
                type,
                requestId,
                adUnitId,
                null,
                null
              )
            }
          }
        adHelper.setFullScreenContentCallback(fullScreenContentCallback)

        adArray.put(
          requestId,
          ad
        )
        sendAdEvent(
          eventType,
          requestId,
          adUnitId,
          null,
          data
        )
      } catch (e: Exception) {
          Log.w("RNGoogleMobileAds", "Unknown error on load")
          Log.w("RNGoogleMobileAds", e)
        val error = Arguments.createMap()
        error.putString("code", "internal")
        error.putString("message", e.message)
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
          requestId,
          adUnitId,
          error,
          null
        )

      }
    }

    override fun onAdFailedToLoad(loadAdError: LoadAdError) {
      val error = Arguments.createMap()
      val codeAndMessage =
        ReactNativeGoogleMobileAdsCommon.getCodeAndMessageFromAdError(loadAdError)
      error.putString("code", codeAndMessage[0])
      error.putString("message", codeAndMessage[1])
      sendAdEvent(
        ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
        requestId,
        adUnitId,
        error,
        null
      )
    }
  }
}
