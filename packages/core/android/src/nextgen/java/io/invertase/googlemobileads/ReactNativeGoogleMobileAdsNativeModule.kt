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
import com.google.android.libraries.ads.mobile.sdk.nativead.CustomNativeAd
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdLoader
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdLoaderCallback
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdRequest
import com.google.android.libraries.ads.mobile.sdk.nativead.OnCustomClickListener
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

@ReactModule(ReactNativeGoogleMobileAdsNativeModule.NAME)
class ReactNativeGoogleMobileAdsNativeModule(
  reactContext: ReactApplicationContext,
) : NativeGoogleMobileAdsNativeModuleSpec(reactContext) {
  private val nativeAds = HashMap<String, NativeAd>()
  private val multiFormatHolders = HashMap<String, MultiFormatHolder>()
  private val mainHandler = Handler(Looper.getMainLooper())

  /** Google Ad Manager custom native ads keyed by library adId. Registered on the main thread. */
  private val customAds = ConcurrentHashMap<String, CustomNativeHolder>()

  /** Set by [invalidate]; checked on the main thread before registering a late custom ad. */
  @Volatile private var invalidated = false

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
    customAds.remove(responseId)?.let { holder ->
      mainHandler.post { holder.destroy() }
      if (multiFormatHolders[responseId] is MultiFormatHolder.Custom) {
        multiFormatHolders.remove(responseId)
      }
    }
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
    val customFormatIds =
      ReactNativeGoogleMobileAdsCustomNative.parseFormatIds(requestOptions, "customNativeFormatIds")
    val adTypes = ArrayList<NativeAd.NativeAdType>()
    if (wantsNative) adTypes.add(NativeAd.NativeAdType.NATIVE)
    if (wantsBanner) adTypes.add(NativeAd.NativeAdType.BANNER)
    if (customFormatIds.isNotEmpty()) adTypes.add(NativeAd.NativeAdType.CUSTOM_NATIVE)
    val request = buildRequest(adUnitId, requestOptions, adTypes, sizes, customFormatIds)
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

        override fun onCustomNativeAdLoaded(ad: CustomNativeAd) {
          if (!settled.compareAndSet(false, true)) {
            // Late / duplicate ad: keep every custom-ad SDK call on the main thread.
            mainHandler.post { ad.destroy() }
            return
          }
          // Next-Gen may call back off the main thread: bind, register and settle on main
          // (same as the banner arm) so destroy / destroyHandle / invalidate cannot race it.
          mainHandler.post {
            if (invalidated) {
              ad.destroy()
              promise.resolve(noneResult(invalidatedError()))
              return@post
            }
            // handleId doubles as the custom ad's adId so JS can release it with destroy(adId).
            val holder =
              CustomNativeHolder(
                handleId,
                ad,
                ReactNativeGoogleMobileAdsCustomNative.usesAppClickHandling(
                  requestOptions,
                  "customNativeClickHandling",
                ),
              )
            holder.bind()
            customAds[handleId] = holder
            multiFormatHolders[handleId] = MultiFormatHolder.Custom(handleId)
            val data = customNativeAdToWritableMap(ad, handleId)
            data.putString("format", "customNative")
            data.putString("handleId", handleId)
            promise.resolve(data)
          }
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
    if (holder is MultiFormatHolder.Custom) {
      customAds.remove(holder.adId)?.let { mainHandler.post { it.destroy() } }
      return
    }
    mainHandler.post { holder.destroy() }
    if (holder is MultiFormatHolder.Native) nativeAds.remove(holder.responseId)
  }

  fun getNativeAd(responseId: String): NativeAd? = nativeAds[responseId]

  fun getMultiFormatBannerAdView(handleId: String): AdView? = (multiFormatHolders[handleId] as? MultiFormatHolder.Banner)?.adView

  @ReactMethod
  override fun loadCustomNative(
    adUnitId: String,
    requestOptions: ReadableMap,
    promise: Promise,
  ) {
    NextGenMobileAdsGate.runWhenInitialized(
      onFailure = { rejectInitializationFailure(promise, it) },
    ) {
      loadCustomNativeInitialized(adUnitId, requestOptions, promise)
    }
  }

  private fun loadCustomNativeInitialized(
    adUnitId: String,
    requestOptions: ReadableMap,
    promise: Promise,
  ) {
    val formatIds = ReactNativeGoogleMobileAdsCustomNative.parseFormatIds(requestOptions, "customFormatIds")
    if (formatIds.isEmpty()) {
      rejectCustomNative(promise, "invalid-request", "Custom native load requires a non-empty customFormatIds array.", "load")
      return
    }
    val appClickHandling = ReactNativeGoogleMobileAdsCustomNative.usesAppClickHandling(requestOptions, "clickHandling")
    val request =
      buildRequest(
        adUnitId,
        requestOptions,
        listOf(NativeAd.NativeAdType.CUSTOM_NATIVE),
        customFormatIds = formatIds,
      )
    val settled = ReactNativeGoogleMobileAdsNativeAdLoad.OnceOnlySettle()
    NativeAdLoader.load(
      request,
      object : NativeAdLoaderCallback {
        override fun onCustomNativeAdLoaded(ad: CustomNativeAd) {
          if (!settled.trySettle()) {
            // Late / duplicate ad: keep every custom-ad SDK call on the main thread.
            mainHandler.post { ad.destroy() }
            return
          }
          // Next-Gen may call back off the main thread: bind, register and settle on main.
          mainHandler.post {
            if (invalidated) {
              ad.destroy()
              val error = invalidatedError()
              promise.reject(error.getString("code"), error.getString("message"), error)
              return@post
            }
            val adId = UUID.randomUUID().toString()
            val holder = CustomNativeHolder(adId, ad, appClickHandling)
            holder.bind()
            customAds[adId] = holder
            promise.resolve(customNativeAdToWritableMap(ad, adId))
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
  override fun performCustomNativeClick(
    adId: String,
    assetName: String,
    promise: Promise,
  ) {
    mainHandler.post {
      val holder = customAds[adId]
      if (holder == null) {
        rejectCustomNative(promise, "invalid-argument", "Custom native ad '$adId' was not found or has been destroyed.", "show")
        return@post
      }
      try {
        holder.performClick(assetName)
        promise.resolve(null)
      } catch (e: Exception) {
        rejectCustomNative(promise, "internal-error", e.message ?: "performClick failed.", "show")
      }
    }
  }

  @ReactMethod
  override fun recordCustomNativeImpression(adId: String) {
    mainHandler.post { customAds[adId]?.ad?.recordImpression() }
  }

  private fun invalidatedError(): WritableMap =
    ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
      "internal-error",
      "The native module was invalidated before the custom native ad was delivered.",
      "load",
    )

  private fun rejectCustomNative(
    promise: Promise,
    code: String,
    message: String,
    phase: String,
  ) {
    val error = ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(code, message, phase)
    promise.reject(code, message, error)
  }

  private fun customNativeAdToWritableMap(
    ad: CustomNativeAd,
    adId: String,
  ): WritableMap {
    val names = ad.assetNameSet
    val assets =
      ReactNativeGoogleMobileAdsCustomNative.collectAssets(
        names,
        text = { ad.getText(it) },
        image = { name ->
          ad.getImage(name)?.let {
            ReactNativeGoogleMobileAdsCustomNative.Asset.Image(it.uri.toString(), it.scale)
          }
        },
      )
    val data = Arguments.createMap()
    data.putString("adId", adId)
    putNullableString(data, "responseId", ad.getResponseInfo().responseId)
    data.putString("customFormatId", ad.customFormatId.orEmpty())
    val nameArray = Arguments.createArray()
    names.forEach { nameArray.pushString(it) }
    data.putArray("availableAssetNames", nameArray)
    data.putMap("assets", ReactNativeGoogleMobileAdsCustomNative.assetsToWritableMap(assets))
    val media = ad.mediaContent
    if (media != null) {
      val mediaContent = Arguments.createMap()
      mediaContent.putDouble("aspectRatio", media.aspectRatio.toDouble())
      mediaContent.putBoolean("hasVideoContent", media.hasVideoContent)
      mediaContent.putDouble("duration", media.duration.toDouble())
      data.putMap("mediaContent", mediaContent)
    } else {
      data.putNull("mediaContent")
    }
    ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(ad.getResponseInfo())?.let {
      data.putMap("responseInfo", it)
    } ?: data.putNull("responseInfo")
    return data
  }

  override fun invalidate() {
    invalidated = true
    // Custom ads are registered on the main thread; clean up there too so a registration already
    // queued runs first and is then destroyed, and later ones see [invalidated].
    mainHandler.post {
      customAds.values.forEach { it.destroy() }
      customAds.clear()
    }
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
    customFormatIds: List<String> = emptyList(),
  ): NativeAdRequest {
    val builder = ReactNativeGoogleMobileAdsCommon.buildNativeAdRequestBuilder(adUnitId, types, options)
    if (bannerSizes.isNotEmpty()) builder.setAdSizes(bannerSizes)
    if (customFormatIds.isNotEmpty()) builder.setCustomFormatIds(customFormatIds)
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

  /**
   * One Google Ad Manager custom native ad. Next-Gen may call back off the main thread, so the
   * click handler hops to [mainHandler] before emitting, like the other custom-ad callbacks.
   */
  private inner class CustomNativeHolder(
    val adId: String,
    ad: CustomNativeAd,
    private val appClickHandling: Boolean,
  ) {
    var ad: CustomNativeAd? = ad
      private set

    fun bind() {
      val current = ad ?: return
      current.adEventCallback =
        object : NativeAdEventCallback {
          override fun onAdImpression() = emitEvent("impression")

          override fun onAdClicked() = emitEvent("clicked")

          override fun onAdShowedFullScreenContent() = emitEvent("opened")

          override fun onAdDismissedFullScreenContent() = emitEvent("closed")

          override fun onAdPaid(value: AdValue) =
            emitEvent(
              "paid",
              ReactNativeGoogleMobileAdsResponseInfo.paidEventPayload(value, current.getResponseInfo()),
            )
        }
      // Without a listener (clickHandling 'sdk') the SDK opens the creative's own click-through.
      current.onCustomClickListener =
        if (appClickHandling) {
          object : OnCustomClickListener {
            override fun onCustomClick(assetName: String) {
              mainHandler.post { handleCustomClick(assetName) }
            }
          }
        } else {
          null
        }
    }

    /**
     * Main thread. Reports the click to the SDK. With app click handling the SDK then calls the
     * custom click listener instead of navigating.
     */
    fun performClick(assetName: String) {
      ad?.performClick(assetName)
    }

    /** The SDK recorded the click and did not navigate; the app decides what happens next. */
    private fun handleCustomClick(assetName: String) {
      if (ad == null) {
        return
      }
      emitEvent(
        ReactNativeGoogleMobileAdsCustomNative.EVENT_CUSTOM_CLICK,
        ReactNativeGoogleMobileAdsCustomNative.clickEventData(assetName),
      )
    }

    fun destroy() {
      ad?.let {
        it.onCustomClickListener = null
        it.adEventCallback = null
        it.destroy()
      }
      ad = null
    }

    // JS matches custom native events on adId.
    private fun emitEvent(
      type: String,
      data: ReadableMap? = null,
    ) = emitHandleEvent(adId, type, data)
  }

  private sealed class MultiFormatHolder {
    abstract fun destroy()

    /** Custom native winner; the ad itself lives in customAds under the same id. */
    class Custom(
      val adId: String,
    ) : MultiFormatHolder() {
      override fun destroy() {
        // Released through customAds by the owning module.
      }
    }

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
