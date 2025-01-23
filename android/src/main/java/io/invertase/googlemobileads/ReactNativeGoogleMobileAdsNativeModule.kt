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
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdLoader
import com.google.android.gms.ads.MediaAspectRatio
import com.google.android.gms.ads.VideoController.VideoLifecycleCallbacks
import com.google.android.gms.ads.VideoOptions
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdOptions
import io.invertase.googlemobileads.common.ReactNativeEventEmitter
import io.invertase.googlemobileads.interfaces.NativeEvent

@ReactModule(name = ReactNativeGoogleMobileAdsNativeModule.NAME)
class ReactNativeGoogleMobileAdsNativeModule(
  reactContext: ReactApplicationContext
) : NativeGoogleMobileAdsNativeModuleSpec(reactContext) {
  private val adHolders = HashMap<String, NativeAdHolder>()

  override fun getName() = NAME

  @ReactMethod
  override fun load(adUnitId: String, requestOptions: ReadableMap, promise: Promise) {
    val holder = NativeAdHolder(adUnitId, requestOptions)
    holder.loadAd { nativeAd ->
      val responseId = nativeAd.responseInfo?.responseId ?: return@loadAd
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
      val mediaContent = Arguments.createMap()
      nativeAd.mediaContent?.let {
        mediaContent.putDouble("aspectRatio", it.aspectRatio.toDouble())
        mediaContent.putBoolean("hasVideoContent", it.hasVideoContent())
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
    adHolders.values.forEach {
      it.destroy()
    }
    adHolders.clear()
  }

  fun getNativeAd(responseId: String): NativeAd? {
    return adHolders[responseId]?.nativeAd
  }

  private inner class NativeAdHolder(private val adUnitId: String, private val requestOptions: ReadableMap) {
    var nativeAd: NativeAd? = null
      private set

    private val adListener: AdListener = object : AdListener() {
      override fun onAdImpression() {
        emitAdEvent("impression")
      }

      override fun onAdClicked() {
        emitAdEvent("clicked")
      }

      override fun onAdOpened() {
        emitAdEvent("opened")
      }

      override fun onAdClosed() {
        emitAdEvent("closed")
      }
    }

    private val videoLifecycleCallbacks: VideoLifecycleCallbacks = object : VideoLifecycleCallbacks() {
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
        emitAdEvent(if (isMuted) {
          "video_muted"
        } else {
          "video_unmuted"
        })
      }
    }

    fun loadAd(loadedListener: NativeAd.OnNativeAdLoadedListener) {
      val mediaAspectRatio = if (requestOptions.hasKey("aspectRatio")) {
        when (requestOptions.getInt("aspectRatio")) {
          1 -> MediaAspectRatio.ANY
          2 -> MediaAspectRatio.PORTRAIT
          3 -> MediaAspectRatio.LANDSCAPE
          4 -> MediaAspectRatio.SQUARE
          else -> MediaAspectRatio.UNKNOWN
        }
      } else {
        MediaAspectRatio.ANY
      }
      val adChoicesPlacement = if (requestOptions.hasKey("adChoicesPlacement")) {
        when (requestOptions.getInt("adChoicesPlacement")) {
          0 -> NativeAdOptions.ADCHOICES_TOP_RIGHT
          1 -> NativeAdOptions.ADCHOICES_TOP_LEFT
          2 -> NativeAdOptions.ADCHOICES_BOTTOM_RIGHT
          3 -> NativeAdOptions.ADCHOICES_BOTTOM_LEFT
          else -> NativeAdOptions.ADCHOICES_TOP_RIGHT
        }
      } else {
        NativeAdOptions.ADCHOICES_TOP_RIGHT
      }
      val startVideoMuted = if (requestOptions.hasKey("startVideoMuted")) {
        requestOptions.getBoolean("startVideoMuted")
      } else {
        true
      }
      val videoOptions = VideoOptions.Builder()
        .setStartMuted(startVideoMuted)
        .build()
      val nativeAdOptions = NativeAdOptions.Builder()
//      .setReturnUrlsForImageAssets(true)
        .setMediaAspectRatio(mediaAspectRatio)
        .setAdChoicesPlacement(adChoicesPlacement)
        .setVideoOptions(videoOptions)
        .build()
      val adLoader = AdLoader.Builder(reactApplicationContext, adUnitId)
        .withNativeAdOptions(nativeAdOptions)
        .withAdListener(adListener)
        .forNativeAd { nativeAd ->
          this.nativeAd = nativeAd
          nativeAd.mediaContent?.videoController?.videoLifecycleCallbacks = videoLifecycleCallbacks
          loadedListener.onNativeAdLoaded(nativeAd)
        }
        .build()
      val adRequest = ReactNativeGoogleMobileAdsCommon.buildAdRequest(requestOptions)
      adLoader.loadAd(adRequest)
    }

    fun destroy() {
      nativeAd?.destroy()
      nativeAd = null
    }

    private fun emitAdEvent(type: String) {
      val nativeAd = this.nativeAd ?: return
      val payload = Arguments.createMap()
      payload.putString("responseId", nativeAd.responseInfo?.responseId)
      payload.putString("type", type)

      val emitter = ReactNativeEventEmitter.getSharedInstance()
      emitter.sendEvent(object : NativeEvent {
        override fun getEventName() = "RNGMANativeAdEvent"
        override fun getEventBody() = payload
      })
    }
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsNativeModule"
  }
}
