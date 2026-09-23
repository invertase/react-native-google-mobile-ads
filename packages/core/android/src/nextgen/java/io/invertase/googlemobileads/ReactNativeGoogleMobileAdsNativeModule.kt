package io.invertase.googlemobileads

import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import com.facebook.fbreact.specs.NativeGoogleMobileAdsNativeModuleSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.banner.AdView
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdChoicesPlacement
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.VideoController
import com.google.android.libraries.ads.mobile.sdk.common.VideoOptions
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdLoader
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdLoaderCallback
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdRequest
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

@ReactModule(ReactNativeGoogleMobileAdsNativeModule.NAME)
class ReactNativeGoogleMobileAdsNativeModule(
  reactContext: ReactApplicationContext,
) : NativeGoogleMobileAdsNativeModuleSpec(reactContext) {
  private val nativeAds = HashMap<String, NativeAd>()
  private val multiFormatHolders = HashMap<String, MultiFormatHolder>()
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun getName() = NAME

  @ReactMethod
  override fun load(
    adUnitId: String,
    requestOptions: ReadableMap,
    promise: Promise,
  ) {
    NextGenMobileAdsGate.runWhenInitialized(
      onFailure = { rejectInitializationFailure(promise, it) },
    ) {
      loadInitialized(adUnitId, requestOptions, promise)
    }
  }

  private fun loadInitialized(
    adUnitId: String,
    requestOptions: ReadableMap,
    promise: Promise,
  ) {
    val request = buildRequest(adUnitId, requestOptions, listOf(NativeAd.NativeAdType.NATIVE))
    // Static NativeAdLoader.load — AdLoader GC N/A; still gate dual callbacks (parity w/ classic).
    val settled = ReactNativeGoogleMobileAdsNativeAdLoad.OnceOnlySettle()
    NativeAdLoader.load(
      request,
      object : NativeAdLoaderCallback {
        override fun onNativeAdLoaded(ad: NativeAd) {
          if (!settled.trySettle()) {
            ad.destroy()
            return
          }
          when (
            val outcome =
              ReactNativeGoogleMobileAdsNativeAdLoad.outcomeForLoadedResponseId(
                ad.getResponseInfo().responseId,
              )
          ) {
            is ReactNativeGoogleMobileAdsNativeAdLoad.Outcome.Reject -> {
              ad.destroy()
              val error =
                ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
                  outcome.code,
                  outcome.message,
                  "load",
                )
              promise.reject(error.getString("code"), error.getString("message"), error)
            }
            is ReactNativeGoogleMobileAdsNativeAdLoad.Outcome.Resolve -> {
              bindNativeAd(ad)
              nativeAds[outcome.responseId] = ad
              promise.resolve(nativeAdToWritableMap(ad, outcome.responseId))
            }
          }
        }

        override fun onAdFailedToLoad(error: LoadAdError) {
          if (!settled.trySettle()) {
            return
          }
          val payload = ReactNativeGoogleMobileAdsCommon.loadAdErrorToMap(error)
          promise.reject(payload.getString("code"), payload.getString("message"), payload)
        }
      },
    )
  }

  @ReactMethod
  override fun destroy(responseId: String) {
    nativeAds.remove(responseId)?.destroy()
    multiFormatHolders.entries.removeAll { (_, holder) ->
      holder is MultiFormatHolder.Native && holder.responseId == responseId
    }
  }

  @ReactMethod
  override fun loadMultiFormat(
    adUnitId: String,
    requestOptions: ReadableMap,
    promise: Promise,
  ) {
    NextGenMobileAdsGate.runWhenInitialized(
      onFailure = { rejectInitializationFailure(promise, it) },
    ) {
      loadMultiFormatInitialized(adUnitId, requestOptions, promise)
    }
  }

  private fun loadMultiFormatInitialized(
    adUnitId: String,
    requestOptions: ReadableMap,
    promise: Promise,
  ) {
    val formats = MultiFormatRequestParser.parseFormats(requestOptions)
    val wantsNative = MultiFormatRequestParser.wantsNative(formats)
    val wantsBanner = MultiFormatRequestParser.wantsBanner(formats)
    val sizes = MultiFormatRequestParser.parseBannerSizes(requestOptions)
    if (!wantsNative && !wantsBanner) {
      promise.resolve(
        noneResult(
          ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
            "invalid-request",
            "Multi-format load requires formats to include 'native' and/or 'banner'.",
            "load",
          ),
        ),
      )
      return
    }
    if (wantsBanner && sizes.isEmpty()) {
      promise.resolve(
        noneResult(
          ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
            "invalid-request",
            "Multi-format banner load requires a non-empty bannerSizes array.",
            "load",
          ),
        ),
      )
      return
    }

    val handleId = UUID.randomUUID().toString()
    val adTypes = ArrayList<NativeAd.NativeAdType>()
    if (wantsNative) adTypes.add(NativeAd.NativeAdType.NATIVE)
    if (wantsBanner) adTypes.add(NativeAd.NativeAdType.BANNER)
    val request = buildRequest(adUnitId, requestOptions, adTypes, sizes)
    val settled = AtomicBoolean(false)
    NativeAdLoader.load(
      request,
      1,
      object : NativeAdLoaderCallback {
        override fun onNativeAdLoaded(ad: NativeAd) {
          if (!settled.compareAndSet(false, true)) {
            ad.destroy()
            return
          }
          val responseId =
            ad
              .getResponseInfo()
              .responseId
              .orEmpty()
              .ifBlank { handleId }
          bindNativeAd(ad)
          nativeAds[responseId] = ad
          multiFormatHolders[handleId] = MultiFormatHolder.Native(responseId, ad)
          val data = nativeAdToWritableMap(ad, responseId)
          data.putString("format", "native")
          data.putString("handleId", handleId)
          promise.resolve(data)
        }

        override fun onBannerAdLoaded(ad: BannerAd) {
          if (!settled.compareAndSet(false, true)) {
            ad.destroy()
            return
          }
          val activity = reactApplicationContext.currentActivity
          if (activity == null) {
            ad.destroy()
            promise.resolve(
              noneResult(
                ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
                  "null-activity",
                  "Multi-format banner requires a current Activity.",
                  "load",
                ),
              ),
            )
            return
          }
          mainHandler.post {
            val adView = AdView(activity)
            adView.registerBannerAd(ad, activity)
            bindBannerAd(ad)
            multiFormatHolders[handleId] = MultiFormatHolder.Banner(adView, ad)
            val data = Arguments.createMap()
            data.putString("format", "banner")
            data.putString("handleId", handleId)
            data.putDouble("width", ad.getAdSize().width.toDouble())
            data.putDouble("height", ad.getAdSize().height.toDouble())
            ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(ad.getResponseInfo())?.let {
              data.putMap("responseInfo", it)
            }
            promise.resolve(data)
          }
        }

        override fun onAdFailedToLoad(error: LoadAdError) {
          if (settled.compareAndSet(false, true)) {
            promise.resolve(noneResult(ReactNativeGoogleMobileAdsCommon.loadAdErrorToMap(error)))
          }
        }
      },
    )
  }

  @ReactMethod
  override fun destroyHandle(handleId: String) {
    val holder = multiFormatHolders.remove(handleId) ?: return
    mainHandler.post { holder.destroy() }
    if (holder is MultiFormatHolder.Native) nativeAds.remove(holder.responseId)
  }

  fun getNativeAd(responseId: String): NativeAd? = nativeAds[responseId]

  fun getMultiFormatBannerAdView(handleId: String): AdView? = (multiFormatHolders[handleId] as? MultiFormatHolder.Banner)?.adView

  override fun invalidate() {
    val holders = multiFormatHolders.values.toList()
    mainHandler.post { holders.forEach { it.destroy() } }
    multiFormatHolders.clear()
    nativeAds.values.forEach { it.destroy() }
    nativeAds.clear()
    super.invalidate()
  }

  private fun buildRequest(
    adUnitId: String,
    options: ReadableMap,
    types: List<NativeAd.NativeAdType>,
    bannerSizes: List<AdSize> = emptyList(),
  ): NativeAdRequest {
    val builder = ReactNativeGoogleMobileAdsCommon.buildNativeAdRequestBuilder(adUnitId, types, options)
    if (bannerSizes.isNotEmpty()) builder.setAdSizes(bannerSizes)
    builder.setMediaAspectRatio(
      when (if (options.hasKey("aspectRatio")) options.getInt("aspectRatio") else 1) {
        2 -> NativeAd.NativeMediaAspectRatio.LANDSCAPE
        3 -> NativeAd.NativeMediaAspectRatio.PORTRAIT
        4 -> NativeAd.NativeMediaAspectRatio.SQUARE
        0 -> NativeAd.NativeMediaAspectRatio.UNKNOWN
        else -> NativeAd.NativeMediaAspectRatio.ANY
      },
    )
    builder.setAdChoicesPlacement(
      when (if (options.hasKey("adChoicesPlacement")) options.getInt("adChoicesPlacement") else 1) {
        0 -> AdChoicesPlacement.TOP_LEFT
        2 -> AdChoicesPlacement.BOTTOM_RIGHT
        3 -> AdChoicesPlacement.BOTTOM_LEFT
        else -> AdChoicesPlacement.TOP_RIGHT
      },
    )
    builder.setVideoOptions(
      VideoOptions
        .Builder()
        .setStartMuted(!options.hasKey("startVideoMuted") || options.getBoolean("startVideoMuted"))
        .build(),
    )
    return builder.build()
  }

  private fun bindNativeAd(ad: NativeAd) {
    ad.adEventCallback =
      object : NativeAdEventCallback {
        override fun onAdImpression() = emitNativeEvent(ad, "impression")

        override fun onAdClicked() = emitNativeEvent(ad, "clicked")

        override fun onAdShowedFullScreenContent() = emitNativeEvent(ad, "opened")

        override fun onAdDismissedFullScreenContent() = emitNativeEvent(ad, "closed")

        override fun onAdPaid(value: AdValue) =
          emitNativeEvent(
            ad,
            "paid",
            ReactNativeGoogleMobileAdsResponseInfo.paidEventPayload(value, ad.getResponseInfo()),
          )
      }
    ad.mediaContent.videoController?.videoLifecycleCallbacks =
      object : VideoController.VideoLifecycleCallbacks {
        override fun onVideoPlay() = emitNativeEvent(ad, "video_played")

        override fun onVideoPause() = emitNativeEvent(ad, "video_paused")

        override fun onVideoEnd() = emitNativeEvent(ad, "video_ended")

        override fun onVideoMute(isMuted: Boolean) = emitNativeEvent(ad, if (isMuted) "video_muted" else "video_unmuted")
      }
  }

  private fun bindBannerAd(ad: BannerAd) {
    ad.adEventCallback =
      object : BannerAdEventCallback {
        override fun onAdImpression() = emitHandleEvent(ad.getResponseInfo().responseId.orEmpty(), "impression")

        override fun onAdClicked() = emitHandleEvent(ad.getResponseInfo().responseId.orEmpty(), "clicked")

        override fun onAdPaid(value: AdValue) =
          emitHandleEvent(
            ad.getResponseInfo().responseId.orEmpty(),
            "paid",
            ReactNativeGoogleMobileAdsResponseInfo.paidEventPayload(value, ad.getResponseInfo()),
          )
      }
  }

  private fun emitNativeEvent(
    ad: NativeAd,
    type: String,
    data: ReadableMap? = null,
  ) = emitHandleEvent(ad.getResponseInfo().responseId.orEmpty(), type, data)

  private fun emitHandleEvent(
    responseId: String,
    type: String,
    data: ReadableMap? = null,
  ) {
    val payload = Arguments.createMap()
    if (data != null) payload.merge(data)
    payload.putString("responseId", responseId)
    payload.putString("type", type)
    emitOnAdEvent(payload)
  }

  private fun nativeAdToWritableMap(
    ad: NativeAd,
    responseId: String,
  ): WritableMap {
    val data = Arguments.createMap()
    data.putString("responseId", responseId)
    putNullableString(data, "advertiser", ad.advertiser)
    putNullableString(data, "body", ad.body)
    putNullableString(data, "callToAction", ad.callToAction)
    putNullableString(data, "headline", ad.headline)
    putNullableString(data, "price", ad.price)
    putNullableString(data, "store", ad.store)
    ad.starRating?.let { data.putDouble("starRating", it) } ?: data.putNull("starRating")
    ad.icon?.let {
      val icon = Arguments.createMap()
      icon.putDouble("scale", it.scale)
      putNullableString(icon, "url", it.uri?.toString())
      data.putMap("icon", icon)
    } ?: data.putNull("icon")
    ad.image?.let {
      val imageArray = Arguments.createArray()
      val row = Arguments.createMap()
      putNullableString(row, "url", it.uri?.toString())
      row.putDouble("scale", it.scale)
      imageArray.pushMap(row)
      data.putArray("images", imageArray)
    } ?: data.putNull("images")
    val media = Arguments.createMap()
    media.putDouble("aspectRatio", ad.mediaContent.aspectRatio.toDouble())
    media.putBoolean("hasVideoContent", ad.mediaContent.hasVideoContent)
    media.putDouble("duration", ad.mediaContent.duration.toDouble())
    data.putMap("mediaContent", media)
    data.putNull("extras")
    ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(ad.getResponseInfo())?.let {
      data.putMap("responseInfo", it)
    }
    return data
  }

  private fun putNullableString(
    map: WritableMap,
    key: String,
    value: String?,
  ) {
    if (value == null) {
      map.putNull(key)
    } else {
      map.putString(key, value)
    }
  }

  private fun rejectInitializationFailure(
    promise: Promise,
    failure: NextGenMobileAdsGate.Failure,
  ) {
    val error =
      ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
        failure.code,
        failure.message,
        "load",
      )
    promise.reject(failure.code, failure.message, error)
  }

  private fun noneResult(error: WritableMap): WritableMap =
    Arguments.createMap().apply {
      putString("format", "none")
      putMap("error", error)
    }

  private sealed class MultiFormatHolder {
    abstract fun destroy()

    class Native(
      val responseId: String,
      private val ad: NativeAd,
    ) : MultiFormatHolder() {
      override fun destroy() = ad.destroy()
    }

    class Banner(
      val adView: AdView,
      private val ad: BannerAd,
    ) : MultiFormatHolder() {
      override fun destroy() {
        (adView.parent as? ViewGroup)?.removeView(adView)
        adView.destroy()
        ad.destroy()
      }
    }
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsNativeModule"
  }
}
