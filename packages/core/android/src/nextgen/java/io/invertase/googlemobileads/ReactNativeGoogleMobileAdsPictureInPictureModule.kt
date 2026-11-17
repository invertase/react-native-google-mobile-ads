package io.invertase.googlemobileads

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import com.google.android.libraries.ads.mobile.sdk.pip.PictureInPictureAd
import com.google.android.libraries.ads.mobile.sdk.pip.PictureInPictureAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.pip.PictureInPictureAdOptions
import com.google.android.libraries.ads.mobile.sdk.pip.PictureInPictureAdPosition
import com.google.android.libraries.ads.mobile.sdk.pip.PictureInPictureAdPresentationScope
import io.invertase.googlemobileads.common.ReactNativeModule

class ReactNativeGoogleMobileAdsPictureInPictureModule(
  reactContext: ReactApplicationContext?,
) : ReactNativeModule(reactContext, NAME) {
  private val slots = FullscreenRequestSlotTracker<PictureInPictureAd>()

  @ReactMethod
  fun pictureInPictureLoad(
    requestId: Int,
    adUnitId: String,
    adRequestOptions: ReadableMap,
  ) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      sendAdEvent(
        ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
        requestId,
        adUnitId,
        ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
          "null-activity",
          "Ad attempted to load but the current Activity was null.",
          "load",
        ),
      )
      return
    }

    val generation = slots.beginLoad(requestId)
    NextGenMobileAdsGate.runWhenInitialized(
      onFailure = {
        sendAdEvent(
          ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
          requestId,
          adUnitId,
          ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(it.code, it.message, "load"),
        )
      },
    ) {
      if (slots.generation(requestId) != generation) return@runWhenInitialized
      val request =
        ReactNativeGoogleMobileAdsCommon.buildPictureInPictureAdRequest(adUnitId, adRequestOptions)
      activity.runOnUiThread {
        PictureInPictureAd.load(
          request,
          object : AdLoadCallback<PictureInPictureAd> {
            override fun onAdLoaded(ad: PictureInPictureAd) {
              if (!slots.tryCommit(requestId, generation, ad)) {
                ad.destroy()
                return
              }
              wireCallbacks(requestId, adUnitId, ad)
              val responseInfo = ad.getResponseInfo()
              val data =
                if (responseInfo == null) {
                  null
                } else {
                  Arguments.createMap().apply {
                    putMap(
                      "responseInfo",
                      ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(responseInfo),
                    )
                  }
                }
              sendAdEvent(
                ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_LOADED,
                requestId,
                adUnitId,
                data = data,
              )
            }

            override fun onAdFailedToLoad(adError: LoadAdError) {
              if (slots.generation(requestId) != generation) return
              sendAdEvent(
                ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR,
                requestId,
                adUnitId,
                ReactNativeGoogleMobileAdsCommon.loadAdErrorToMap(adError),
              )
            }
          },
        )
      }
    }
  }

  @ReactMethod
  fun pictureInPictureShow(
    requestId: Int,
    adUnitId: String,
    showOptions: ReadableMap?,
    promise: Promise,
  ) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      rejectPromiseWithCodeAndMessage(
        promise,
        "null-activity",
        "Ad attempted to show but the current Activity was null.",
      )
      return
    }

    activity.runOnUiThread {
      val ad = slots.get(requestId)
      if (ad == null) {
        rejectPromiseWithCodeAndMessage(
          promise,
          "not-ready",
          "Ad attempted to show but was not ready.",
        )
        return@runOnUiThread
      }
      try {
        ad.show(activity, buildShowOptions(showOptions))
        promise.resolve(null)
      } catch (e: Exception) {
        rejectPromiseWithCodeAndMessage(promise, "show-failed", e.message ?: "show-failed")
      }
    }
  }

  @ReactMethod
  fun pictureInPictureHide(requestId: Int) {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      slots.get(requestId)?.hide()
    }
  }

  @ReactMethod
  fun pictureInPictureDestroy(requestId: Int) {
    val ad = slots.get(requestId)
    slots.destroy(requestId)
    ad?.destroy()
  }

  override fun invalidate() {
    slots.clear()
    super.invalidate()
  }

  private fun buildShowOptions(showOptions: ReadableMap?): PictureInPictureAdOptions {
    val builder = PictureInPictureAdOptions.Builder()
    if (showOptions != null && showOptions.hasKey("position")) {
      builder.setPosition(parsePosition(showOptions.getString("position")))
    }
    if (showOptions != null && showOptions.hasKey("presentationScope")) {
      builder.setPresentationScope(parseScope(showOptions.getString("presentationScope")))
    }
    return builder.build()
  }

  private fun parsePosition(value: String?): PictureInPictureAdPosition =
    when (value) {
      "topLeft" -> PictureInPictureAdPosition.TOP_LEFT
      "topRight" -> PictureInPictureAdPosition.TOP_RIGHT
      "bottomLeft" -> PictureInPictureAdPosition.BOTTOM_LEFT
      "bottomRight" -> PictureInPictureAdPosition.BOTTOM_RIGHT
      else -> PictureInPictureAdPosition.DEFAULT
    }

  private fun parseScope(value: String?): PictureInPictureAdPresentationScope =
    when (value) {
      "application" -> PictureInPictureAdPresentationScope.APPLICATION
      else -> PictureInPictureAdPresentationScope.SCREEN
    }

  private fun wireCallbacks(
    requestId: Int,
    adUnitId: String,
    ad: PictureInPictureAd,
  ) {
    ad.adEventCallback =
      object : PictureInPictureAdEventCallback {
        override fun onAdShown() = sendSimpleEvent(requestId, adUnitId, ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_SHOWN)

        override fun onAdHidden() = sendSimpleEvent(requestId, adUnitId, ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_HIDDEN)

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

        override fun onAppEvent(
          name: String,
          data: String?,
        ) {
          val payload = Arguments.createMap()
          payload.putString("name", name)
          payload.putString("data", data)
          sendAdEvent(
            ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_APP_EVENT,
            requestId,
            adUnitId,
            data = payload,
          )
        }
      }
  }

  private fun sendPaidEvent(
    requestId: Int,
    adUnitId: String,
    ad: PictureInPictureAd,
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
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PICTURE_IN_PICTURE,
      requestId,
      type,
      adUnitId,
      error,
      data,
    )
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsPictureInPictureModule"
  }
}
