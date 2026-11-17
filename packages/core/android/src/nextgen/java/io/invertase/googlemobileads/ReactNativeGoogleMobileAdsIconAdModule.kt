package io.invertase.googlemobileads

import com.facebook.fbreact.specs.NativeIconAdModuleSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.google.android.libraries.ads.mobile.sdk.common.AdChoicesInfo
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.Image
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import com.google.android.libraries.ads.mobile.sdk.iconad.IconAd
import com.google.android.libraries.ads.mobile.sdk.iconad.IconAdEventCallback

@ReactModule(ReactNativeGoogleMobileAdsIconAdModule.NAME)
class ReactNativeGoogleMobileAdsIconAdModule(
  reactContext: ReactApplicationContext,
) : NativeIconAdModuleSpec(reactContext) {
  private val slots = FullscreenRequestSlotTracker<IconAd>()

  override fun getName() = NAME

  fun getIconAd(requestId: Int): IconAd? = slots.get(requestId)

  override fun iconAdLoad(
    requestId: Double,
    adUnitId: String,
    adRequestOptions: ReadableMap,
  ) {
    val requestIdInt = requestId.toInt()
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      sendAdEvent(
        ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
        requestIdInt,
        adUnitId,
        ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
          "null-activity",
          "Ad attempted to load but the current Activity was null.",
          "load",
        ),
      )
      return
    }

    val generation = slots.beginLoad(requestIdInt)
    NextGenMobileAdsGate.runWhenInitialized(
      onFailure = {
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
          requestIdInt,
          adUnitId,
          ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(it.code, it.message, "load"),
        )
      },
    ) {
      if (slots.generation(requestIdInt) != generation) return@runWhenInitialized
      val request = ReactNativeGoogleMobileAdsCommon.buildIconAdRequest(adUnitId, adRequestOptions)
      activity.runOnUiThread {
        IconAd.load(
          request,
          object : AdLoadCallback<IconAd> {
            override fun onAdLoaded(ad: IconAd) {
              if (!slots.tryCommit(requestIdInt, generation, ad)) {
                ad.destroy()
                return
              }
              wireCallbacks(requestIdInt, adUnitId, ad)
              val data = iconAdAssetsToMap(ad)
              val responseInfo = ad.getResponseInfo()
              if (responseInfo != null) {
                data.putMap(
                  "responseInfo",
                  ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(responseInfo),
                )
              }
              sendAdEvent(
                ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_LOADED,
                requestIdInt,
                adUnitId,
                data = data,
              )
            }

            override fun onAdFailedToLoad(adError: LoadAdError) {
              if (slots.generation(requestIdInt) != generation) return
              sendAdEvent(
                ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
                requestIdInt,
                adUnitId,
                ReactNativeGoogleMobileAdsCommon.loadAdErrorToMap(adError),
              )
            }
          },
        )
      }
    }
  }

  override fun iconAdDestroy(requestId: Double) {
    val requestIdInt = requestId.toInt()
    val ad = slots.get(requestIdInt)
    slots.destroy(requestIdInt)
    ad?.destroy()
  }

  override fun invalidate() {
    slots.clear()
    super.invalidate()
  }

  private fun wireCallbacks(
    requestId: Int,
    adUnitId: String,
    ad: IconAd,
  ) {
    ad.adEventCallback =
      object : IconAdEventCallback {
        override fun onAdClicked() = sendSimpleEvent(requestId, adUnitId, ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLICKED)

        override fun onAdImpression() =
          sendSimpleEvent(
            requestId,
            adUnitId,
            ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_IMPRESSION,
          )

        override fun onAdPaid(value: AdValue) = sendPaidEvent(requestId, adUnitId, ad, value)

        override fun onAdShowedFullScreenContent() =
          sendSimpleEvent(
            requestId,
            adUnitId,
            ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_OPENED,
          )

        override fun onAdDismissedFullScreenContent() =
          sendSimpleEvent(
            requestId,
            adUnitId,
            ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLOSED,
          )

        override fun onAdFailedToShowFullScreenContent(error: FullScreenContentError) {
          sendAdEvent(
            ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
            requestId,
            adUnitId,
            ReactNativeGoogleMobileAdsCommon.fullScreenContentErrorToMap(error),
          )
        }
      }
  }

  private fun sendPaidEvent(
    requestId: Int,
    adUnitId: String,
    ad: IconAd,
    value: AdValue,
  ) {
    val responseInfo: ResponseInfo = ad.getResponseInfo()
    sendAdEvent(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PAID,
      requestId,
      adUnitId,
      data = ReactNativeGoogleMobileAdsResponseInfo.paidEventPayload(value, responseInfo),
    )
  }

  private fun sendSimpleEvent(
    requestId: Int,
    adUnitId: String,
    type: String,
  ) {
    sendAdEvent(type, requestId, adUnitId)
  }

  private fun sendAdEvent(
    type: String,
    requestId: Int,
    adUnitId: String,
    error: WritableMap? = null,
    data: WritableMap? = null,
  ) {
    ReactNativeGoogleMobileAdsCommon.sendAdEvent(
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ICON_AD,
      requestId,
      type,
      adUnitId,
      error,
      data,
    )
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsIconAdModule"

    fun iconAdAssetsToMap(ad: IconAd): WritableMap {
      val data = Arguments.createMap()
      data.putString("headline", ad.headline)
      data.putString("callToAction", ad.callToAction)
      data.putString("packageName", ad.packageName)
      ad.starRating?.let { data.putDouble("starRating", it) } ?: data.putNull("starRating")
      ad.icon?.let { data.putMap("icon", imageToMap(it)) } ?: data.putNull("icon")
      ad.adChoicesInfo?.let { data.putMap("adChoicesInfo", adChoicesToMap(it)) }
        ?: data.putNull("adChoicesInfo")
      return data
    }

    private fun imageToMap(image: Image): WritableMap {
      val map = Arguments.createMap()
      map.putDouble("scale", image.scale)
      map.putString("url", image.uri?.toString())
      return map
    }

    private fun adChoicesToMap(info: AdChoicesInfo): WritableMap {
      val map = Arguments.createMap()
      map.putString("text", info.text)
      val images = Arguments.createArray()
      for (image in info.images) {
        images.pushMap(imageToMap(image))
      }
      map.putArray("images", images)
      return map
    }
  }
}
