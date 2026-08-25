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

import android.content.Context
import android.os.Bundle
import android.util.DisplayMetrics
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.google.android.gms.ads.mediation.admob.AdMobAdapter
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.common.BaseAdRequestBuilder
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import io.invertase.googlemobileads.common.ReactNativeAdView
import io.invertase.googlemobileads.common.ReactNativeEventEmitter
import java.util.regex.Pattern

/**
 * GMA Next-Gen SDK backed equivalent of the legacy `ReactNativeGoogleMobileAdsCommon`. Unlike
 * legacy, there is no separate AdManagerAdRequest/AdManagerAdView - Ad Manager and AdMob unit IDs
 * both load through the same request builders, with Ad Manager-only fields (customTargeting,
 * publisherProvidedId) applied unconditionally below.
 */
object ReactNativeGoogleMobileAdsCommon {

  private fun <T : BaseAdRequestBuilder<T>> applyCommonRequestOptions(
    builder: BaseAdRequestBuilder<T>,
    adRequestOptions: ReadableMap
  ) {
    val extras = Bundle()

    if (adRequestOptions.hasKey("requestNonPersonalizedAdsOnly") &&
      adRequestOptions.getBoolean("requestNonPersonalizedAdsOnly")
    ) {
      extras.putString("npa", "1")
    }

    if (adRequestOptions.hasKey("networkExtras")) {
      val networkExtras = checkNotNull(adRequestOptions.getMap("networkExtras")).toHashMap()
      for ((key, value) in networkExtras) {
        extras.putString(key, value as String)
      }
    }

    builder.putAdSourceExtrasBundle(AdMobAdapter::class.java, extras)

    if (adRequestOptions.hasKey("keywords")) {
      val keywords = checkNotNull(adRequestOptions.getArray("keywords")).toArrayList()
      for (keyword in keywords) {
        builder.addKeyword(keyword as String)
      }
    }

    if (adRequestOptions.hasKey("contentUrl")) {
      builder.setContentUrl(checkNotNull(adRequestOptions.getString("contentUrl")))
    }

    if (adRequestOptions.hasKey("neighboringContentUrls")) {
      val neighboringContentUrls = checkNotNull(adRequestOptions.getArray("neighboringContentUrls"))
      val urls = LinkedHashSet<String>()
      for (i in 0 until neighboringContentUrls.size()) {
        urls.add(checkNotNull(neighboringContentUrls.getString(i)))
      }
      builder.setNeighboringContentUrls(urls)
    }

    if (adRequestOptions.hasKey("requestAgent")) {
      builder.setRequestAgent(checkNotNull(adRequestOptions.getString("requestAgent")))
    }

    if (adRequestOptions.hasKey("customTargeting")) {
      val customTargeting = checkNotNull(adRequestOptions.getMap("customTargeting")).toHashMap()
      for ((key, value) in customTargeting) {
        if (value is String) {
          builder.putCustomTargeting(key, value)
        } else {
          @Suppress("UNCHECKED_CAST")
          builder.putCustomTargeting(key, value as ArrayList<String>)
        }
      }
    }

    if (adRequestOptions.hasKey("publisherProvidedId")) {
      builder.setPublisherProvidedId(checkNotNull(adRequestOptions.getString("publisherProvidedId")))
    }
  }

  fun buildAdRequest(adUnitId: String, adRequestOptions: ReadableMap): AdRequest {
    val builder = AdRequest.Builder(adUnitId)
    applyCommonRequestOptions(builder, adRequestOptions)
    return builder.build()
  }

  fun buildBannerAdRequest(
    adUnitId: String,
    sizes: List<AdSize>,
    manualImpressionsEnabled: Boolean,
    adRequestOptions: ReadableMap
  ): BannerAdRequest {
    val builder = BannerAdRequest.Builder(adUnitId, sizes)
    applyCommonRequestOptions(builder, adRequestOptions)
    if (manualImpressionsEnabled) {
      builder.setManualImpressionEnabled(true)
    }
    return builder.build()
  }

  fun buildNativeAdRequest(adUnitId: String, adRequestOptions: ReadableMap): com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdRequest {
    val builder = com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdRequest.Builder(
      adUnitId,
      listOf(com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd.NativeAdType.NATIVE)
    )
    applyCommonRequestOptions(builder, adRequestOptions)

    val mediaAspectRatio = if (adRequestOptions.hasKey("aspectRatio")) {
      when (adRequestOptions.getInt("aspectRatio")) {
        1 -> com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd.NativeMediaAspectRatio.ANY
        2 -> com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd.NativeMediaAspectRatio.LANDSCAPE
        3 -> com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd.NativeMediaAspectRatio.PORTRAIT
        4 -> com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd.NativeMediaAspectRatio.SQUARE
        else -> com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd.NativeMediaAspectRatio.UNKNOWN
      }
    } else {
      com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd.NativeMediaAspectRatio.ANY
    }
    builder.setMediaAspectRatio(mediaAspectRatio)

    val adChoicesPlacement = if (adRequestOptions.hasKey("adChoicesPlacement")) {
      when (adRequestOptions.getInt("adChoicesPlacement")) {
        0 -> com.google.android.libraries.ads.mobile.sdk.common.AdChoicesPlacement.TOP_LEFT
        1 -> com.google.android.libraries.ads.mobile.sdk.common.AdChoicesPlacement.TOP_RIGHT
        2 -> com.google.android.libraries.ads.mobile.sdk.common.AdChoicesPlacement.BOTTOM_RIGHT
        3 -> com.google.android.libraries.ads.mobile.sdk.common.AdChoicesPlacement.BOTTOM_LEFT
        else -> com.google.android.libraries.ads.mobile.sdk.common.AdChoicesPlacement.TOP_RIGHT
      }
    } else {
      com.google.android.libraries.ads.mobile.sdk.common.AdChoicesPlacement.TOP_RIGHT
    }
    builder.setAdChoicesPlacement(adChoicesPlacement)

    val startVideoMuted = if (adRequestOptions.hasKey("startVideoMuted")) {
      adRequestOptions.getBoolean("startVideoMuted")
    } else {
      true
    }
    builder.setVideoOptions(
      com.google.android.libraries.ads.mobile.sdk.common.VideoOptions.Builder().setStartMuted(startVideoMuted).build()
    )

    return builder.build()
  }

  fun getAdSizeForAdaptiveBanner(preDefinedAdSize: String, reactViewGroup: ReactNativeAdView): AdSize {
    return try {
      val display =
        checkNotNull((reactViewGroup.context as ReactContext).currentActivity).windowManager.defaultDisplay

      val outMetrics = DisplayMetrics()
      display.getMetrics(outMetrics)

      val customWidth = reactViewGroup.adWidth
      val screenWidth = (outMetrics.widthPixels / outMetrics.density).toInt()
      val adWidth = if (customWidth > 0) minOf(Math.round(customWidth), screenWidth) else screenWidth

      val maxAdHeight = reactViewGroup.maxAdHeight
      if (preDefinedAdSize == "INLINE_ADAPTIVE_BANNER") {
        if (maxAdHeight > 0) {
          return AdSize.getInlineAdaptiveBannerAdSize(adWidth, Math.round(maxOf(maxAdHeight, 32f)))
        }
        return AdSize.getCurrentOrientationInlineAdaptiveBannerAdSize(reactViewGroup.context, adWidth)
      }
      if (preDefinedAdSize == "LARGE_ANCHORED_ADAPTIVE_BANNER") {
        return AdSize.getLargeAnchoredAdaptiveBannerAdSize(reactViewGroup.context, adWidth)
      }
      AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(reactViewGroup.context, adWidth)
    } catch (e: Exception) {
      AdSize.BANNER
    }
  }

  fun getAdSize(preDefinedAdSize: String, reactViewGroup: ReactNativeAdView): AdSize {
    return if (preDefinedAdSize.matches(
        Regex("ANCHORED_ADAPTIVE_BANNER|LARGE_ANCHORED_ADAPTIVE_BANNER|INLINE_ADAPTIVE_BANNER")
      )
    ) {
      getAdSizeForAdaptiveBanner(preDefinedAdSize, reactViewGroup)
    } else {
      stringToAdSize(preDefinedAdSize)
    }
  }

  fun stringToAdSize(value: String): AdSize {
    val pattern = Pattern.compile("([0-9]+)x([0-9]+)")
    val matcher = pattern.matcher(value)

    if (matcher.find()) {
      val width = matcher.group(1)!!.toInt()
      val height = matcher.group(2)!!.toInt()
      return AdSize(width, height)
    }

    return when (value.uppercase()) {
      "FLUID" -> AdSize.FLUID
      "LARGE_BANNER" -> AdSize.LARGE_BANNER
      "MEDIUM_RECTANGLE" -> AdSize.MEDIUM_RECTANGLE
      "FULL_BANNER" -> AdSize.FULL_BANNER
      "LEADERBOARD" -> AdSize.LEADERBOARD
      // GMA Next-Gen SDK's AdSize has no WIDE_SKYSCRAPER constant (unlike the legacy SDK) - the
      // dimensions (160x600) are the same standard IAB size, just built explicitly.
      "WIDE_SKYSCRAPER" -> AdSize(160, 600)
      else -> AdSize.BANNER
    }
  }

  fun sendAdEvent(
    event: String,
    requestId: Int,
    type: String,
    adUnitId: String,
    error: WritableMap?,
    data: WritableMap? = null
  ) {
    val emitter = ReactNativeEventEmitter.getSharedInstance()

    val eventBody = Arguments.createMap()
    eventBody.putString("type", type)
    if (error != null) eventBody.putMap("error", error)
    if (data != null) eventBody.putMap("data", data)

    emitter.sendEvent(ReactNativeGoogleMobileAdsEvent(event, requestId, adUnitId, eventBody))
  }

  fun getCodeAndMessageFromAdError(adError: LoadAdError): Array<String> {
    val code = when (adError.code) {
      LoadAdError.ErrorCode.APP_ID_MISSING -> "app-id-missing"
      LoadAdError.ErrorCode.INTERNAL_ERROR -> "internal-error"
      LoadAdError.ErrorCode.INVALID_REQUEST -> "invalid-request"
      LoadAdError.ErrorCode.NETWORK_ERROR -> "network-error"
      LoadAdError.ErrorCode.NO_FILL -> "no-fill"
      LoadAdError.ErrorCode.REQUEST_ID_MISMATCH -> "request-id-mismatch"
      // Error codes with no legacy SDK equivalent.
      LoadAdError.ErrorCode.TIMEOUT -> "timeout"
      LoadAdError.ErrorCode.CANCELLED -> "cancelled"
      LoadAdError.ErrorCode.NOT_FOUND -> "not-found"
      LoadAdError.ErrorCode.INVALID_AD_RESPONSE -> "invalid-ad-response"
      LoadAdError.ErrorCode.AD_RESPONSE_ALREADY_USED -> "ad-response-already-used"
      else -> "unknown"
    }
    return arrayOf(code, adError.message)
  }
}
