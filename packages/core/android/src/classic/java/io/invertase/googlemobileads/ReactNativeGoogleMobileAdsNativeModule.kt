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
import com.facebook.fbreact.specs.NativeGoogleMobileAdsNativeModuleSpec
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
import com.google.android.gms.ads.nativead.NativeCustomFormatAd
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

@ReactModule(ReactNativeGoogleMobileAdsNativeModule.NAME)
class ReactNativeGoogleMobileAdsNativeModule(
  reactContext: ReactApplicationContext,
) : NativeGoogleMobileAdsNativeModuleSpec(reactContext) {
  private val adHolders = HashMap<String, NativeAdHolder>()
  private val multiFormatHolders = HashMap<String, MultiFormatHolder>()

  /** In-flight single-format loads — keeps holders reachable until promise settle (#870). */
  private val pendingLoadHolders = HashSet<NativeAdHolder>()

  /** Google Ad Manager custom native ads keyed by library adId (UUID; no SDK responseInfo). */
  private val customAdHolders = ConcurrentHashMap<String, CustomNativeAdHolder>()
  private val pendingCustomLoadHolders = HashSet<CustomNativeAdHolder>()
  private val uiHandler = Handler(Looper.getMainLooper())

  /** Set by [invalidate]; a custom ad delivered afterwards is destroyed, not registered. */
  @Volatile private var invalidated = false

  override fun getName() = NAME

  @ReactMethod
  override fun load(
    adUnitId: String,
    requestOptions: ReadableMap,
    promise: Promise,
  ) {
    val holder = NativeAdHolder(adUnitId, requestOptions)
    pendingLoadHolders.add(holder)
    holder.loadAd(
      onLoaded = { nativeAd ->
        pendingLoadHolders.remove(holder)
        when (
          val outcome =
            ReactNativeGoogleMobileAdsNativeAdLoad.outcomeForLoadedResponseId(
              nativeAd.responseInfo?.responseId,
            )
        ) {
          is ReactNativeGoogleMobileAdsNativeAdLoad.Outcome.Reject -> {
            nativeAd.destroy()
            val error =
              ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
                outcome.code,
                outcome.message,
                "load",
              )
            promise.reject(error.getString("code"), error.getString("message"), error)
          }
          is ReactNativeGoogleMobileAdsNativeAdLoad.Outcome.Resolve -> {
            adHolders[outcome.responseId] = holder
            promise.resolve(nativeAdToWritableMap(nativeAd, outcome.responseId))
          }
        }
      },
      onFailedToLoad = { loadAdError ->
        pendingLoadHolders.remove(holder)
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
    customAdHolders.remove(responseId)?.let { holder ->
      uiHandler.post { holder.destroy() }
      if (multiFormatHolders[responseId] is MultiFormatHolder.Custom) {
        multiFormatHolders.remove(responseId)
      }
    }
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
    val customFormatIds =
      ReactNativeGoogleMobileAdsCustomNative.parseFormatIds(requestOptions, "customNativeFormatIds")

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
      var activeCustomHolder: CustomNativeAdHolder? = null
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
                activeCustomHolder?.emitEvent("impression")
              }

              override fun onAdClicked() {
                activeNativeHolder?.emitLifecycleEvent("clicked")
                activeCustomHolder?.emitEvent("clicked")
              }

              override fun onAdOpened() {
                activeNativeHolder?.emitLifecycleEvent("opened")
                activeCustomHolder?.emitEvent("opened")
              }

              override fun onAdClosed() {
                activeNativeHolder?.emitLifecycleEvent("closed")
                activeCustomHolder?.emitEvent("closed")
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

      if (customFormatIds.isNotEmpty()) {
        // handleId doubles as the custom ad's adId so JS can release it with destroy(adId).
        val holder =
          CustomNativeAdHolder(
            handleId,
            ReactNativeGoogleMobileAdsCustomNative.usesAppClickHandling(
              requestOptions,
              "customNativeClickHandling",
            ),
          )
        val onLoaded =
          NativeCustomFormatAd.OnCustomFormatAdLoadedListener { customAd ->
            if (invalidated) {
              customAd.destroy()
              return@OnCustomFormatAdLoadedListener
            }
            holder.bind(customAd)
            activeCustomHolder = holder
            customAdHolders[handleId] = holder
            multiFormatHolders[handleId] = MultiFormatHolder.Custom(handleId)
            val data = customNativeAdToWritableMap(customAd, handleId)
            data.putString("format", "customNative")
            data.putString("handleId", handleId)
            settle(data)
          }
        for (formatId in customFormatIds) {
          builder.forCustomFormatAd(formatId, onLoaded, holder.customClickListener())
        }
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
      is MultiFormatHolder.Custom -> {
        customAdHolders.remove(holder.adId)?.let { uiHandler.post { it.destroy() } }
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

  @ReactMethod
  override fun loadCustomNative(
    adUnitId: String,
    requestOptions: ReadableMap,
    promise: Promise,
  ) {
    val formatIds = ReactNativeGoogleMobileAdsCustomNative.parseFormatIds(requestOptions, "customFormatIds")
    if (formatIds.isEmpty()) {
      val error =
        ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
          "invalid-request",
          "Custom native load requires a non-empty customFormatIds array.",
          "load",
        )
      promise.reject(error.getString("code"), error.getString("message"), error)
      return
    }
    val holder =
      CustomNativeAdHolder(
        UUID.randomUUID().toString(),
        ReactNativeGoogleMobileAdsCustomNative.usesAppClickHandling(requestOptions, "clickHandling"),
      )
    pendingCustomLoadHolders.add(holder)
    holder.loadAd(
      adUnitId,
      requestOptions,
      formatIds,
      onLoaded = { customAd ->
        pendingCustomLoadHolders.remove(holder)
        if (invalidated) {
          holder.destroy()
          rejectCustomNative(
            promise,
            "internal-error",
            "The native module was invalidated before the custom native ad was delivered.",
            "load",
          )
        } else {
          customAdHolders[holder.adId] = holder
          promise.resolve(customNativeAdToWritableMap(customAd, holder.adId))
        }
      },
      onFailedToLoad = { loadAdError ->
        pendingCustomLoadHolders.remove(holder)
        val error = ReactNativeGoogleMobileAdsCommon.adErrorToMap(loadAdError, "load")
        ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(loadAdError.responseInfo)?.let {
          error.putMap("responseInfo", it)
        }
        promise.reject(error.getString("code"), error.getString("message"), error)
      },
    )
  }

  @ReactMethod
  override fun performCustomNativeClick(
    adId: String,
    assetName: String,
    promise: Promise,
  ) {
    uiHandler.post {
      val holder = customAdHolders[adId]
      if (holder?.ad == null) {
        rejectCustomNative(promise, "invalid-argument", "Custom native ad '$adId' was not found or has been destroyed.")
        return@post
      }
      try {
        holder.performClick(assetName)
        promise.resolve(null)
      } catch (e: Exception) {
        rejectCustomNative(promise, "internal-error", e.message ?: "performClick failed.")
      }
    }
  }

  @ReactMethod
  override fun recordCustomNativeImpression(adId: String) {
    uiHandler.post { customAdHolders[adId]?.ad?.recordImpression() }
  }

  private fun rejectCustomNative(
    promise: Promise,
    code: String,
    message: String,
    phase: String = "show",
  ) {
    val error = ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(code, message, phase)
    promise.reject(code, message, error)
  }

  private fun customNativeAdToWritableMap(
    ad: NativeCustomFormatAd,
    adId: String,
  ): WritableMap {
    val names = ad.availableAssetNames ?: emptyList()
    val assets =
      ReactNativeGoogleMobileAdsCustomNative.collectAssets(
        names,
        text = { ad.getText(it) },
        image = { name ->
          ad.getImage(name)?.let { image ->
            image.uri?.toString()?.let {
              ReactNativeGoogleMobileAdsCustomNative.Asset.Image(it, image.scale)
            }
          }
        },
      )
    val data = Arguments.createMap()
    data.putString("adId", adId)
    // Classic NativeCustomFormatAd exposes no ResponseInfo.
    data.putNull("responseId")
    data.putString("customFormatId", ad.customFormatId)
    val nameArray = Arguments.createArray()
    names.forEach { nameArray.pushString(it) }
    data.putArray("availableAssetNames", nameArray)
    data.putMap("assets", ReactNativeGoogleMobileAdsCustomNative.assetsToWritableMap(assets))
    val media = ad.mediaContent
    if (media != null) {
      val mediaContent = Arguments.createMap()
      mediaContent.putDouble("aspectRatio", media.aspectRatio.toDouble())
      mediaContent.putBoolean("hasVideoContent", media.hasVideoContent())
      mediaContent.putDouble("duration", media.duration.toDouble())
      data.putMap("mediaContent", mediaContent)
    } else {
      data.putNull("mediaContent")
    }
    data.putNull("responseInfo")
    return data
  }

  override fun invalidate() {
    invalidated = true
    super.invalidate()
    pendingCustomLoadHolders.forEach { it.destroy() }
    pendingCustomLoadHolders.clear()
    val customHolders = customAdHolders.values.toList()
    customAdHolders.clear()
    uiHandler.post { customHolders.forEach { it.destroy() } }
    pendingLoadHolders.forEach { it.destroy() }
    pendingLoadHolders.clear()
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
    putNullableString(data, "advertiser", nativeAd.advertiser)
    putNullableString(data, "body", nativeAd.body)
    putNullableString(data, "callToAction", nativeAd.callToAction)
    putNullableString(data, "headline", nativeAd.headline)
    putNullableString(data, "price", nativeAd.price)
    putNullableString(data, "store", nativeAd.store)
    nativeAd.starRating?.let {
      data.putDouble("starRating", it)
    } ?: run {
      data.putNull("starRating")
    }
    nativeAd.icon?.let {
      val icon = Arguments.createMap()
      icon.putDouble("scale", it.scale)
      putNullableString(icon, "url", it.uri?.toString())
      data.putMap("icon", icon)
    } ?: run {
      data.putNull("icon")
    }
    val images = nativeAd.images
    if (images.isNullOrEmpty()) {
      data.putNull("images")
    } else {
      val imageArray = Arguments.createArray()
      for (image in images) {
        val row = Arguments.createMap()
        putNullableString(row, "url", image.uri?.toString())
        row.putDouble("scale", image.scale)
        imageArray.pushMap(row)
      }
      data.putArray("images", imageArray)
    }
    val mediaContent = Arguments.createMap()
    nativeAd.mediaContent?.let {
      mediaContent.putDouble("aspectRatio", it.aspectRatio.toDouble())
      mediaContent.putBoolean("hasVideoContent", it.hasVideoContent())
      mediaContent.putDouble("duration", it.duration.toDouble())
    } ?: run {
      mediaContent.putDouble("aspectRatio", 0.0)
      mediaContent.putBoolean("hasVideoContent", false)
      mediaContent.putDouble("duration", 0.0)
    }
    data.putMap("mediaContent", mediaContent)
    data.putNull("extras")
    ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(nativeAd.responseInfo)?.let {
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

    /** Custom native winner; the ad itself lives in customAdHolders under the same id. */
    class Custom(
      val adId: String,
    ) : MultiFormatHolder() {
      override fun destroy() {
        // Released through customAdHolders by the owning module.
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

    private val loaderRetention = ReactNativeGoogleMobileAdsNativeAdLoad.LoaderRetention()
    private val loadSettled = AtomicBoolean(false)

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
          if (!loadSettled.compareAndSet(false, true)) {
            return
          }
          loaderRetention.clear()
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
            if (!loadSettled.compareAndSet(false, true)) {
              loaded.destroy()
              return@forNativeAd
            }
            loaderRetention.clear()
            failedToLoadListener = null
            bindLoadedNativeAd(loaded)
            onLoaded.onNativeAdLoaded(loaded)
          }.build()
      // Strongly retain until settle — local-only AdLoader was the #870 GC hang.
      loaderRetention.retain(adLoader)
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
      loaderRetention.clear()
      failedToLoadListener = null
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

  /**
   * One Google Ad Manager custom native ad. Classic delivers the custom click listener at
   * builder time, so the holder exists (with its adId) before the request is sent.
   */
  private inner class CustomNativeAdHolder(
    val adId: String,
    private val appClickHandling: Boolean,
  ) {
    var ad: NativeCustomFormatAd? = null
      private set

    private val loaderRetention = ReactNativeGoogleMobileAdsNativeAdLoad.LoaderRetention()
    private val loadSettled = AtomicBoolean(false)
    private var failedToLoadListener: ((LoadAdError) -> Unit)? = null

    private val adListener: AdListener =
      object : AdListener() {
        override fun onAdImpression() = emitEvent("impression")

        override fun onAdClicked() = emitEvent("clicked")

        override fun onAdOpened() = emitEvent("opened")

        override fun onAdClosed() = emitEvent("closed")

        override fun onAdFailedToLoad(error: LoadAdError) {
          if (!loadSettled.compareAndSet(false, true)) {
            return
          }
          loaderRetention.clear()
          failedToLoadListener?.invoke(error)
          failedToLoadListener = null
        }
      }

    /** Null for `clickHandling: 'sdk'`: the SDK then opens the creative's own click-through. */
    fun customClickListener(): NativeCustomFormatAd.OnCustomClickListener? =
      if (appClickHandling) {
        NativeCustomFormatAd.OnCustomClickListener { _, assetName -> handleCustomClick(assetName) }
      } else {
        null
      }

    fun loadAd(
      adUnitId: String,
      requestOptions: ReadableMap,
      formatIds: List<String>,
      onLoaded: (NativeCustomFormatAd) -> Unit,
      onFailedToLoad: (LoadAdError) -> Unit,
    ) {
      failedToLoadListener = onFailedToLoad
      val builder =
        AdLoader
          .Builder(reactApplicationContext, adUnitId)
          .withAdListener(adListener)
      val loadedListener =
        NativeCustomFormatAd.OnCustomFormatAdLoadedListener { loaded ->
          if (!loadSettled.compareAndSet(false, true)) {
            loaded.destroy()
            return@OnCustomFormatAdLoadedListener
          }
          loaderRetention.clear()
          failedToLoadListener = null
          bind(loaded)
          onLoaded(loaded)
        }
      val clickListener = customClickListener()
      for (formatId in formatIds) {
        builder.forCustomFormatAd(formatId, loadedListener, clickListener)
      }
      val adLoader = builder.build()
      // Strongly retain until settle (same #870 rule as NativeAdHolder).
      loaderRetention.retain(adLoader)
      adLoader.loadAd(ReactNativeGoogleMobileAdsCommon.buildAdRequest(requestOptions))
    }

    fun bind(loaded: NativeCustomFormatAd) {
      ad = loaded
    }

    /**
     * Main thread. Reports the click to the SDK. With app click handling the SDK then calls
     * [handleCustomClick] instead of navigating.
     */
    fun performClick(assetName: String) {
      ad?.performClick(assetName)
    }

    /** The SDK recorded the click and did not navigate; the app decides what happens next. */
    private fun handleCustomClick(assetName: String) {
      emitEvent(
        ReactNativeGoogleMobileAdsCustomNative.EVENT_CUSTOM_CLICK,
        ReactNativeGoogleMobileAdsCustomNative.clickEventData(assetName),
      )
    }

    fun destroy() {
      loaderRetention.clear()
      failedToLoadListener = null
      ad?.destroy()
      ad = null
    }

    fun emitEvent(
      type: String,
      eventData: ReadableMap? = null,
    ) {
      if (ad == null) {
        return
      }
      val payload = Arguments.createMap()
      if (eventData != null) {
        payload.merge(eventData)
      }
      // JS matches custom native events on adId.
      payload.putString("responseId", adId)
      payload.putString("type", type)
      this@ReactNativeGoogleMobileAdsNativeModule.emitOnAdEvent(payload)
    }
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsNativeModule"
  }
}
