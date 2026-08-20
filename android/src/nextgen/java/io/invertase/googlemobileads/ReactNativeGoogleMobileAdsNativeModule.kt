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
import com.facebook.react.module.annotations.ReactModule
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd
import com.google.android.libraries.ads.mobile.sdk.common.AdEventCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.VideoController
import com.google.android.libraries.ads.mobile.sdk.nativead.CustomNativeAd
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdLoader
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdLoaderCallback

/**
 * GMA Next-Gen SDK backed equivalent of the legacy `ReactNativeGoogleMobileAdsNativeModule`. Ad
 * Manager unit IDs (starting with "/") are rejected up front since GMA Next-Gen SDK has no Ad
 * Manager equivalent - see [ReactNativeGoogleMobileAdsCommon.isAdManagerUnit].
 */
@ReactModule(ReactNativeGoogleMobileAdsNativeModule.NAME)
class ReactNativeGoogleMobileAdsNativeModule(
  reactContext: ReactApplicationContext
) : NativeGoogleMobileAdsNativeModuleSpec(reactContext) {
  private val adHolders = HashMap<String, NativeAdHolder>()

  override fun getName() = NAME

  @ReactMethod
  override fun load(adUnitId: String, requestOptions: ReadableMap, promise: Promise) {
    if (ReactNativeGoogleMobileAdsCommon.isAdManagerUnit(adUnitId)) {
      promise.reject(
        "invalid-request",
        "Ad Manager ad unit IDs are not supported when using GMA Next-Gen SDK."
      )
      return
    }

    val holder = NativeAdHolder(adUnitId, requestOptions)
    holder.loadAd { nativeAd ->
      val responseId = nativeAd.getResponseInfo()?.responseId ?: return@loadAd
      adHolders[responseId] = holder

      val data = Arguments.createMap()
      data.putString("responseId", responseId)
      data.putString("advertiser", nativeAd.advertiser)
      data.putString("body", nativeAd.body)
      data.putString("callToAction", nativeAd.callToAction)
      data.putString("headline", nativeAd.headline)
      data.putString("price", nativeAd.price)
      data.putString("store", nativeAd.store)
      nativeAd.starRating?.let {
        data.putDouble("starRating", it)
      } ?: run {
        data.putNull("starRating")
      }
      nativeAd.icon?.let {
        val icon = Arguments.createMap()
        icon.putDouble("scale", it.scale)
        icon.putString("url", it.uri.toString())
        data.putMap("icon", icon)
      } ?: run {
        data.putNull("icon")
      }
      nativeAd.mediaContent?.let {
        val mediaContent = Arguments.createMap()
        mediaContent.putDouble("aspectRatio", it.aspectRatio.toDouble())
        mediaContent.putBoolean("hasVideoContent", it.hasVideoContent)
        mediaContent.putDouble("duration", it.duration.toDouble())
        data.putMap("mediaContent", mediaContent)
      }

      promise.resolve(data)
    }
  }

  @ReactMethod
  override fun destroy(responseId: String) {
    adHolders[responseId]?.destroy()
    adHolders.remove(responseId)
  }

  override fun invalidate() {
    super.invalidate()
    adHolders.values.forEach { it.destroy() }
    adHolders.clear()
  }

  fun getNativeAd(responseId: String): NativeAd? {
    return adHolders[responseId]?.nativeAd
  }

  private inner class NativeAdHolder(private val adUnitId: String, private val requestOptions: ReadableMap) {
    var nativeAd: NativeAd? = null
      private set

    private val adEventCallback: NativeAdEventCallback = object : NativeAdEventCallback, AdEventCallback {
      override fun onAdShowedFullScreenContent() {
        emitAdEvent("opened")
      }

      override fun onAdDismissedFullScreenContent() {
        emitAdEvent("closed")
      }

      override fun onAdFailedToShowFullScreenContent(error: FullScreenContentError) {}

      override fun onAdImpression() {
        emitAdEvent("impression")
      }

      override fun onAdClicked() {
        emitAdEvent("clicked")
      }

      override fun onAdPaid(adValue: AdValue) {
        val revenueData = Arguments.createMap()
        revenueData.putDouble("value", 1e-6 * adValue.valueMicros)
        revenueData.putInt("precision", adValue.precisionType.ordinal)
        revenueData.putString("currency", adValue.currencyCode)
        emitAdEvent("paid", revenueData)
      }
    }

    private val videoLifecycleCallbacks: VideoController.VideoLifecycleCallbacks =
      object : VideoController.VideoLifecycleCallbacks {
        override fun onVideoStart() {}

        override fun onVideoPlay() {
          emitAdEvent("video_played")
        }

        override fun onVideoPause() {
          emitAdEvent("video_paused")
        }

        override fun onVideoEnd() {
          emitAdEvent("video_ended")
        }

        override fun onVideoMute(isMuted: Boolean) {
          emitAdEvent(if (isMuted) "video_muted" else "video_unmuted")
        }
      }

    fun loadAd(loadedListener: (NativeAd) -> Unit) {
      val adRequest = ReactNativeGoogleMobileAdsCommon.buildNativeAdRequest(adUnitId, requestOptions)
      NativeAdLoader.load(
        adRequest,
        object : NativeAdLoaderCallback {
          override fun onNativeAdLoaded(ad: NativeAd) {
            nativeAd = ad
            ad.adEventCallback = adEventCallback
            ad.mediaContent?.videoController?.videoLifecycleCallbacks = videoLifecycleCallbacks
            loadedListener(ad)
          }

          override fun onCustomNativeAdLoaded(ad: CustomNativeAd) {}
          override fun onBannerAdLoaded(ad: BannerAd) {}
          override fun onAdLoadingCompleted() {}

          override fun onAdFailedToLoad(loadAdError: LoadAdError) {
            // Matches legacy behaviour, which also has no dedicated failure path here - the
            // caller's promise is only resolved from onNativeAdLoaded.
          }
        }
      )
    }

    fun destroy() {
      nativeAd?.destroy()
      nativeAd = null
    }

    private fun emitAdEvent(type: String, eventData: ReadableMap? = null) {
      val nativeAd = this.nativeAd ?: return
      val payload = Arguments.createMap()
      if (eventData != null) {
        payload.merge(eventData)
      }
      payload.putString("responseId", nativeAd.getResponseInfo()?.responseId)
      payload.putString("type", type)
      this@ReactNativeGoogleMobileAdsNativeModule.emitOnAdEvent(payload)
    }
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsNativeModule"
  }
}
