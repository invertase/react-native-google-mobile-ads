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

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.google.android.gms.ads.AdFormat
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.appopen.AppOpenAd
import com.google.android.gms.ads.appopen.AppOpenAdPreloader
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdPreloader
import com.google.android.gms.ads.preload.PreloadCallbackV2
import com.google.android.gms.ads.preload.PreloadConfiguration
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdPreloader
import io.invertase.googlemobileads.common.ReactNativeModule

@ReactModule(ReactNativeGoogleMobileAdsPoolModule.NAME)
class ReactNativeGoogleMobileAdsPoolModule(
  reactContext: ReactApplicationContext,
) : NativeGoogleMobileAdsPoolModuleSpec(reactContext) {
  private val callbacks = HashMap<String, PreloadCallbackV2>()

  override fun getName() = NAME

  private fun callbackKey(
    format: String,
    preloadId: String,
  ): String = "$format::$preloadId"

  private fun sendPoolEvent(
    poolId: String,
    type: String,
    data: WritableMap? = null,
    error: WritableMap? = null,
  ) {
    ReactNativeGoogleMobileAdsCommon.sendAdEvent(
      GOOGLE_MOBILE_ADS_EVENT_POOL,
      0,
      type,
      poolId,
      error,
      data,
    )
  }

  private fun buildCallback(poolId: String): PreloadCallbackV2 =
    object : PreloadCallbackV2() {
      override fun onAdPreloaded(
        preloadId: String,
        responseInfo: com.google.android.gms.ads.ResponseInfo?,
      ) {
        val data = Arguments.createMap()
        val responseId = responseInfo?.responseId
        if (responseId != null) {
          data.putString("responseId", responseId)
        }
        sendPoolEvent(poolId, "available", data)
      }

      override fun onAdsExhausted(preloadId: String) {
        sendPoolEvent(poolId, "exhausted")
      }

      override fun onAdFailedToPreload(
        preloadId: String,
        adError: com.google.android.gms.ads.AdError,
      ) {
        sendPoolEvent(
          poolId,
          "error",
          error = ReactNativeGoogleMobileAdsCommon.adErrorToMap(adError, "load"),
        )
      }
    }

  private fun adFormatFor(format: String): AdFormat? =
    when (format) {
      "appOpen" -> AdFormat.APP_OPEN_AD
      "interstitial" -> AdFormat.INTERSTITIAL
      "rewarded" -> AdFormat.REWARDED
      else -> null
    }

  private fun buildConfiguration(
    format: String,
    adUnitId: String,
    bufferSize: Int,
    requestOptions: ReadableMap,
  ): PreloadConfiguration? {
    if (adFormatFor(format) == null) {
      return null
    }
    val adRequest: AdRequest = ReactNativeGoogleMobileAdsCommon.buildAdRequest(requestOptions)
    val builder = PreloadConfiguration.Builder(adUnitId).setAdRequest(adRequest)
    if (bufferSize >= 1) {
      builder.setBufferSize(bufferSize)
    }
    return builder.build()
  }

  @ReactMethod
  override fun poolStart(
    preloadId: String,
    format: String,
    adUnitId: String,
    bufferSize: Double,
    requestOptions: ReadableMap,
    promise: Promise,
  ) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      ReactNativeModule.rejectPromiseWithCodeAndMessage(
        promise,
        "null-activity",
        "Pool start requires a current Activity.",
      )
      return
    }
    val size = bufferSize.toInt().coerceAtLeast(1)
    val configuration = buildConfiguration(format, adUnitId, size, requestOptions)
    if (configuration == null) {
      ReactNativeModule.rejectPromiseWithCodeAndMessage(
        promise,
        "pool/format-preload-unsupported",
        "Format '$format' is not supported by the Android classic preloader",
      )
      return
    }

    activity.runOnUiThread {
      try {
        val key = callbackKey(format, preloadId)
        val callback = buildCallback(preloadId)
        callbacks[key] = callback
        val started =
          when (format) {
            "appOpen" -> AppOpenAdPreloader.start(preloadId, configuration, callback)
            "interstitial" -> InterstitialAdPreloader.start(preloadId, configuration, callback)
            "rewarded" -> RewardedAdPreloader.start(preloadId, configuration, callback)
            else -> false
          }
        val result = Arguments.createMap()
        result.putBoolean("started", started)
        result.putInt("effectiveBufferSize", size)
        promise.resolve(result)
      } catch (e: Exception) {
        ReactNativeModule.rejectPromiseWithCodeAndMessage(
          promise,
          "internal-error",
          e.message ?: "poolStart failed",
        )
      }
    }
  }

  @ReactMethod
  override fun poolGetAvailability(
    preloadId: String,
    format: String,
    promise: Promise,
  ) {
    val activity = reactApplicationContext.currentActivity
    val runner =
      activity ?: return run {
        val result = Arguments.createMap()
        result.putBoolean("available", false)
        result.putInt("observedCount", 0)
        promise.resolve(result)
      }
    runner.runOnUiThread {
      val count =
        when (format) {
          "appOpen" -> AppOpenAdPreloader.getNumAdsAvailable(preloadId)
          "interstitial" -> InterstitialAdPreloader.getNumAdsAvailable(preloadId)
          "rewarded" -> RewardedAdPreloader.getNumAdsAvailable(preloadId)
          else -> 0
        }
      val result = Arguments.createMap()
      result.putBoolean("available", count > 0)
      result.putInt("observedCount", count)
      promise.resolve(result)
    }
  }

  @ReactMethod
  override fun poolPeekResponseInfo(
    preloadId: String,
    format: String,
    promise: Promise,
  ) {
    ReactNativeModule.rejectPromiseWithCodeAndMessage(
      promise,
      "pool/peek-unsupported",
      "Classic Android has no pool ResponseInfo peek API",
    )
  }

  @ReactMethod
  override fun poolPoll(
    preloadId: String,
    format: String,
    requestId: Double,
    adUnitId: String,
    promise: Promise,
  ) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      ReactNativeModule.rejectPromiseWithCodeAndMessage(
        promise,
        "null-activity",
        "Pool poll requires a current Activity.",
      )
      return
    }
    val reqId = requestId.toInt()
    activity.runOnUiThread {
      try {
        when (format) {
          "appOpen" -> {
            val ad: AppOpenAd? = AppOpenAdPreloader.pollAd(preloadId)
            if (ad == null) {
              resolveEmptyPoll(promise)
              return@runOnUiThread
            }
            val module =
              reactApplicationContext.getNativeModule(
                ReactNativeGoogleMobileAdsAppOpenModule::class.java,
              )
            module?.adoptPolledAd(reqId, adUnitId, ad)
            resolveFilledPoll(promise, reqId, ad.responseInfo)
          }
          "interstitial" -> {
            val ad: InterstitialAd? = InterstitialAdPreloader.pollAd(preloadId)
            if (ad == null) {
              resolveEmptyPoll(promise)
              return@runOnUiThread
            }
            val module =
              reactApplicationContext.getNativeModule(
                ReactNativeGoogleMobileAdsInterstitialModule::class.java,
              )
            module?.adoptPolledAd(reqId, adUnitId, ad)
            resolveFilledPoll(promise, reqId, ad.responseInfo)
          }
          "rewarded" -> {
            val ad: RewardedAd? = RewardedAdPreloader.pollAd(preloadId)
            if (ad == null) {
              resolveEmptyPoll(promise)
              return@runOnUiThread
            }
            val module =
              reactApplicationContext.getNativeModule(
                ReactNativeGoogleMobileAdsRewardedModule::class.java,
              )
            module?.adoptPolledAd(reqId, adUnitId, ad)
            resolveFilledPoll(promise, reqId, ad.responseInfo)
          }
          else -> {
            ReactNativeModule.rejectPromiseWithCodeAndMessage(
              promise,
              "pool/format-preload-unsupported",
              "Format '$format' cannot be polled on Android classic",
            )
          }
        }
      } catch (e: Exception) {
        ReactNativeModule.rejectPromiseWithCodeAndMessage(
          promise,
          "internal-error",
          e.message ?: "poolPoll failed",
        )
      }
    }
  }

  private fun resolveEmptyPoll(promise: Promise) {
    val result = Arguments.createMap()
    result.putBoolean("filled", false)
    promise.resolve(result)
  }

  private fun resolveFilledPoll(
    promise: Promise,
    requestId: Int,
    responseInfo: com.google.android.gms.ads.ResponseInfo?,
  ) {
    val result = Arguments.createMap()
    result.putBoolean("filled", true)
    result.putInt("requestId", requestId)
    val responseId = responseInfo?.responseId
    if (responseId != null) {
      result.putString("responseId", responseId)
    }
    ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(responseInfo)?.let {
      result.putMap("responseInfo", it)
    }
    promise.resolve(result)
  }

  @ReactMethod
  override fun poolDestroy(
    preloadId: String,
    format: String,
  ) {
    val activity = reactApplicationContext.currentActivity
    val destroy = {
      callbacks.remove(callbackKey(format, preloadId))
      when (format) {
        "appOpen" -> AppOpenAdPreloader.destroy(preloadId)
        "interstitial" -> InterstitialAdPreloader.destroy(preloadId)
        "rewarded" -> RewardedAdPreloader.destroy(preloadId)
      }
    }
    if (activity != null) {
      activity.runOnUiThread { destroy() }
    } else {
      destroy()
    }
  }

  @ReactMethod
  override fun addListener(eventName: String) {
    // Required for RN built-in EventEmitter.
  }

  @ReactMethod
  override fun removeListeners(count: Double) {
    // Required for RN built-in EventEmitter.
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsPoolModule"
    const val GOOGLE_MOBILE_ADS_EVENT_POOL = "google_mobile_ads_pool_event"
  }
}
