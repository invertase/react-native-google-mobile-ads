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

import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdLoader
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MediaAspectRatio
import com.google.android.gms.ads.VideoController.VideoLifecycleCallbacks
import com.google.android.gms.ads.VideoOptions
import com.google.android.gms.ads.admanager.AdManagerAdView
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdOptions
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

@ReactModule(ReactNativeGoogleMobileAdsNativeModule.NAME)
class ReactNativeGoogleMobileAdsNativeModule(
  reactContext: ReactApplicationContext,
) : NativeGoogleMobileAdsNativeModuleSpec(reactContext) {
  private val adHolders = HashMap<String, NativeAdHolder>()
  private val multiFormatHolders = HashMap<String, MultiFormatHolder>()

  override fun getName() = NAME

  @ReactMethod
  override fun load(
    adUnitId: String,
    requestOptions: ReadableMap,
    promise: Promise,
  ) {
    val holder = NativeAdHolder(adUnitId, requestOptions)
    holder.loadAd(
      onLoaded = { nativeAd ->
        val responseId = nativeAd.responseInfo?.responseId
        if (responseId == null) {
          val error =
            ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
              "internal-error",
              "Failed to get a valid response ID from the loaded ad.",
              "load",
            )
          promise.reject(error.getString("code"), error.getString("message"), error)
          return@loadAd
        }
        adHolders[responseId] = holder

        promise.resolve(nativeAdToWritableMap(nativeAd, responseId))
      },
      onFailedToLoad = { loadAdError ->
        val error = ReactNativeGoogleMobileAdsCommon.adErrorToMap(loadAdError, "load")
        ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(loadAdError.responseInfo)?.let {
          error.putMap("responseInfo", it)
        }
        promise.reject(error.getString("code"), error.getString("message"), error)
      },
    )
  }

  @ReactMethod
  override fun destroy(responseId: String) {
    adHolders.remove(responseId)?.destroy()
    val orphanedHandles =
      multiFormatHolders.entries
        .filter { (_, holder) -> holder is MultiFormatHolder.Native && holder.responseId == responseId }
        .map { it.key }
    orphanedHandles.forEach { multiFormatHolders.remove(it) }
  }

  @ReactMethod
  override fun loadMultiFormat(
    adUnitId: String,
    requestOptions: ReadableMap,
    promise: Promise,
  ) {
    val handleId = UUID.randomUUID().toString()
    val formats = MultiFormatRequestParser.parseFormats(requestOptions)
    val wantsNative = MultiFormatRequestParser.wantsNative(formats)
    val wantsBanner = MultiFormatRequestParser.wantsBanner(formats)
    val bannerSizes = MultiFormatRequestParser.parseBannerSizes(requestOptions)

    if (!wantsNative && !wantsBanner) {
      promise.resolve(
        multiFormatNoneResult(
          ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
            "invalid-request",
            "Multi-format load requires formats to include 'native' and/or 'banner'.",
            "load",
          ),
        ),
      )
      return
    }

    if (wantsBanner && bannerSizes.isEmpty()) {
      promise.resolve(
        multiFormatNoneResult(
          ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
            "invalid-request",
            "Multi-format banner load requires a non-empty bannerSizes array.",
            "load",
          ),
        ),
      )
      return
    }

    val mainHandler = Handler(Looper.getMainLooper())
    mainHandler.post {
      val context = reactApplicationContext.currentActivity ?: reactApplicationContext
      val settled = AtomicBoolean(false)
      lateinit var adLoader: AdLoader

      fun settle(result: WritableMap) {
        if (adLoader.isLoading) {
          return
        }
        if (settled.compareAndSet(false, true)) {
          promise.resolve(result)
        }
      }

      fun settleFailure(loadAdError: LoadAdError) {
        if (adLoader.isLoading) {
          return
        }
        if (!settled.compareAndSet(false, true)) {
          return
        }
        val error = ReactNativeGoogleMobileAdsCommon.adErrorToMap(loadAdError, "load")
        ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(loadAdError.responseInfo)?.let {
          error.putMap("responseInfo", it)
        }
        promise.resolve(multiFormatNoneResult(error, loadAdError.responseInfo))
      }

      var activeNativeHolder: NativeAdHolder? = null
      val builder =
        AdLoader
          .Builder(context, adUnitId)
          .withAdListener(
            object : AdListener() {
              override fun onAdFailedToLoad(error: LoadAdError) {
                settleFailure(error)
              }

              override fun onAdImpression() {
                activeNativeHolder?.emitLifecycleEvent("impression")
              }

              override fun onAdClicked() {
                activeNativeHolder?.emitLifecycleEvent("clicked")
              }

              override fun onAdOpened() {
                activeNativeHolder?.emitLifecycleEvent("opened")
              }

              override fun onAdClosed() {
                activeNativeHolder?.emitLifecycleEvent("closed")
              }
            },
          )

      if (wantsNative) {
        builder.withNativeAdOptions(buildNativeAdOptions(requestOptions))
        builder.forNativeAd { nativeAd ->
          val responseId = nativeAd.responseInfo?.responseId ?: handleId
          val holder = NativeAdHolder(adUnitId, requestOptions)
          holder.bindLoadedNativeAd(nativeAd)
          activeNativeHolder = holder
          adHolders[responseId] = holder
          multiFormatHolders[handleId] = MultiFormatHolder.Native(responseId, holder)

          val data = nativeAdToWritableMap(nativeAd, responseId)
          data.putString("format", "native")
          data.putString("handleId", handleId)
          settle(data)
        }
      }

      if (wantsBanner) {
        builder.forAdManagerAdView(
          { adView ->
            multiFormatHolders[handleId] = MultiFormatHolder.Banner(adView)
            val data = Arguments.createMap()
            data.putString("format", "banner")
            data.putString("handleId", handleId)
            val adSize = adView.adSize
            if (adSize != null) {
              data.putDouble("width", adSize.width.toDouble())
              data.putDouble("height", adSize.height.toDouble())
            }
            ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(adView.responseInfo)?.let {
              data.putMap("responseInfo", it)
            }
            settle(data)
          },
          *bannerSizes.toTypedArray(),
        )
      }

      adLoader = builder.build()
      adLoader.loadAd(ReactNativeGoogleMobileAdsCommon.buildAdRequest(requestOptions))
    }
  }

  @ReactMethod
  override fun destroyHandle(handleId: String) {
    val holder = multiFormatHolders.remove(handleId) ?: return
    when (holder) {
      is MultiFormatHolder.Native -> {
        adHolders.remove(holder.responseId)?.destroy()
      }
      is MultiFormatHolder.Banner -> {
        val parent = holder.adView.parent
        if (parent is ViewGroup) {
          parent.removeView(holder.adView)
        }
        holder.adView.destroy()
      }
    }
  }

  override fun invalidate() {
    super.invalidate()
    adHolders.values.forEach { it.destroy() }
    adHolders.clear()
    multiFormatHolders.values.forEach { it.destroy() }
    multiFormatHolders.clear()
  }

  fun getNativeAd(responseId: String): NativeAd? = adHolders[responseId]?.nativeAd

  fun getMultiFormatBannerAdView(handleId: String): AdManagerAdView? {
    val holder = multiFormatHolders[handleId] as? MultiFormatHolder.Banner ?: return null
    return holder.adView
  }

  private fun nativeAdToWritableMap(
    nativeAd: NativeAd,
    responseId: String,
  ): WritableMap {
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
      mediaContent.putBoolean("hasVideoContent", it.hasVideoContent())
      mediaContent.putDouble("duration", it.duration.toDouble())
      data.putMap("mediaContent", mediaContent)
    }
    ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(nativeAd.responseInfo)?.let {
      data.putMap("responseInfo", it)
    }
    return data
  }

  private fun multiFormatNoneResult(
    error: WritableMap,
    responseInfo: com.google.android.gms.ads.ResponseInfo? = null,
  ): WritableMap {
    val data = Arguments.createMap()
    data.putString("format", "none")
    data.putMap("error", error)
    ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(responseInfo)?.let {
      data.putMap("responseInfo", it)
    }
    return data
  }

  private fun buildNativeAdOptions(requestOptions: ReadableMap): NativeAdOptions {
    val mediaAspectRatio =
      if (requestOptions.hasKey("aspectRatio")) {
        when (requestOptions.getInt("aspectRatio")) {
          1 -> MediaAspectRatio.ANY
          2 -> MediaAspectRatio.LANDSCAPE
          3 -> MediaAspectRatio.PORTRAIT
          4 -> MediaAspectRatio.SQUARE
          else -> MediaAspectRatio.UNKNOWN
        }
      } else {
        MediaAspectRatio.ANY
      }
    val adChoicesPlacement =
      if (requestOptions.hasKey("adChoicesPlacement")) {
        when (requestOptions.getInt("adChoicesPlacement")) {
          0 -> NativeAdOptions.ADCHOICES_TOP_LEFT
          1 -> NativeAdOptions.ADCHOICES_TOP_RIGHT
          2 -> NativeAdOptions.ADCHOICES_BOTTOM_RIGHT
          3 -> NativeAdOptions.ADCHOICES_BOTTOM_LEFT
          else -> NativeAdOptions.ADCHOICES_TOP_RIGHT
        }
      } else {
        NativeAdOptions.ADCHOICES_TOP_RIGHT
      }
    val startVideoMuted =
      if (requestOptions.hasKey("startVideoMuted")) {
        requestOptions.getBoolean("startVideoMuted")
      } else {
        true
      }
    val videoOptions =
      VideoOptions
        .Builder()
        .setStartMuted(startVideoMuted)
        .build()
    return NativeAdOptions
      .Builder()
      .setMediaAspectRatio(mediaAspectRatio)
      .setAdChoicesPlacement(adChoicesPlacement)
      .setVideoOptions(videoOptions)
      .build()
  }

  private sealed class MultiFormatHolder {
    class Native(
      val responseId: String,
      val holder: NativeAdHolder,
    ) : MultiFormatHolder() {
      override fun destroy() {
        holder.destroy()
      }
    }

    class Banner(
      val adView: AdManagerAdView,
    ) : MultiFormatHolder() {
      override fun destroy() {
        val parent = adView.parent
        if (parent is ViewGroup) {
          parent.removeView(adView)
        }
        adView.destroy()
      }
    }

    abstract fun destroy()
  }

  private inner class NativeAdHolder(
    private val adUnitId: String,
    private val requestOptions: ReadableMap,
  ) {
    var nativeAd: NativeAd? = null
      private set

    private val adListener: AdListener =
      object : AdListener() {
        override fun onAdImpression() {
          emitLifecycleEvent("impression")
        }

        override fun onAdClicked() {
          emitLifecycleEvent("clicked")
        }

        override fun onAdOpened() {
          emitLifecycleEvent("opened")
        }

        override fun onAdClosed() {
          emitLifecycleEvent("closed")
        }

        override fun onAdFailedToLoad(error: LoadAdError) {
          failedToLoadListener?.invoke(error)
          failedToLoadListener = null
        }
      }

    private var failedToLoadListener: ((LoadAdError) -> Unit)? = null

    private val videoLifecycleCallbacks: VideoLifecycleCallbacks =
      object : VideoLifecycleCallbacks() {
        override fun onVideoPlay() {
          emitLifecycleEvent("video_played")
        }

        override fun onVideoPause() {
          emitLifecycleEvent("video_paused")
        }

        override fun onVideoEnd() {
          emitLifecycleEvent("video_ended")
        }

        override fun onVideoMute(isMuted: Boolean) {
          emitLifecycleEvent(
            if (isMuted) {
              "video_muted"
            } else {
              "video_unmuted"
            },
          )
        }
      }

    fun loadAd(
      onLoaded: NativeAd.OnNativeAdLoadedListener,
      onFailedToLoad: (LoadAdError) -> Unit,
    ) {
      failedToLoadListener = onFailedToLoad
      val adLoader =
        AdLoader
          .Builder(reactApplicationContext, adUnitId)
          .withNativeAdOptions(buildNativeAdOptions(requestOptions))
          .withAdListener(adListener)
          .forNativeAd { loaded ->
            failedToLoadListener = null
            bindLoadedNativeAd(loaded)
            onLoaded.onNativeAdLoaded(loaded)
          }.build()
      val adRequest = ReactNativeGoogleMobileAdsCommon.buildAdRequest(requestOptions)
      adLoader.loadAd(adRequest)
    }

    fun bindLoadedNativeAd(loaded: NativeAd) {
      this.nativeAd = loaded
      loaded.mediaContent?.videoController?.videoLifecycleCallbacks = videoLifecycleCallbacks
      loaded.setOnPaidEventListener { adValue ->
        val revenueData =
          ReactNativeGoogleMobileAdsResponseInfo.paidEventPayload(
            adValue,
            loaded.responseInfo,
          )
        emitAdEvent("paid", revenueData)
      }
    }

    fun destroy() {
      nativeAd?.destroy()
      nativeAd = null
    }

    fun emitLifecycleEvent(type: String) {
      emitAdEvent(type)
    }

    private fun emitAdEvent(
      type: String,
      eventData: ReadableMap? = null,
    ) {
      val nativeAd = this.nativeAd ?: return
      val payload = Arguments.createMap()
      if (eventData != null) {
        payload.merge(eventData)
      }
      payload.putString("responseId", nativeAd.responseInfo?.responseId)
      payload.putString("type", type)
      this@ReactNativeGoogleMobileAdsNativeModule.emitOnAdEvent(payload)
    }
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsNativeModule"
  }
}
