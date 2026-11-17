package io.invertase.googlemobileads

import com.facebook.fbreact.specs.NativeSwipeableInterstitialAdModuleSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import com.google.android.libraries.ads.mobile.sdk.swipeableinterstitial.SwipeableInterstitialAd
import com.google.android.libraries.ads.mobile.sdk.swipeableinterstitial.SwipeableInterstitialAdEventCallback

@ReactModule(ReactNativeGoogleMobileAdsSwipeableInterstitialAdModule.NAME)
class ReactNativeGoogleMobileAdsSwipeableInterstitialAdModule(
  reactContext: ReactApplicationContext,
) : NativeSwipeableInterstitialAdModuleSpec(reactContext) {
  private val slots = FullscreenRequestSlotTracker<SwipeableInterstitialAd>()

  override fun getName() = NAME

  fun getSwipeableInterstitialAd(requestId: Int): SwipeableInterstitialAd? = slots.get(requestId)

  override fun swipeableInterstitialLoad(
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
      val request =
        ReactNativeGoogleMobileAdsCommon.buildSwipeableInterstitialAdRequest(
          adUnitId,
          adRequestOptions,
        )
      activity.runOnUiThread {
        SwipeableInterstitialAd.load(
          request,
          object : AdLoadCallback<SwipeableInterstitialAd> {
            override fun onAdLoaded(ad: SwipeableInterstitialAd) {
              if (!slots.tryCommit(requestIdInt, generation, ad)) {
                ad.destroy()
                return
              }
              wireCallbacks(requestIdInt, adUnitId, ad)
              val responseInfo = ad.getResponseInfo()
              val data =
                Arguments.createMap().apply {
                  putInt("minScreenHoldDuration", ad.getScreenHoldDuration())
                  putBoolean("isCustomClickGestureEnabled", ad.isCustomClickGestureEnabled())
                  responseInfo?.let {
                    putMap(
                      "responseInfo",
                      ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(it),
                    )
                  }
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

  override fun swipeableInterstitialRecordCustomClickGesture(requestId: Double) {
    val requestIdInt = requestId.toInt()
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      val ad = slots.get(requestIdInt) ?: return@runOnUiThread
      if (ad.isCustomClickGestureEnabled()) {
        ad.recordCustomClickGesture()
      }
    }
  }

  override fun swipeableInterstitialDestroy(requestId: Double) {
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
    ad: SwipeableInterstitialAd,
  ) {
    ad.adEventCallback =
      object : SwipeableInterstitialAdEventCallback {
        override fun onAdScreenHoldTimerStarted() =
          sendSimpleEvent(
            requestId,
            adUnitId,
            ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_SCREEN_HOLD_TIMER_STARTED,
          )

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
    ad: SwipeableInterstitialAd,
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
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_SWIPEABLE_INTERSTITIAL,
      requestId,
      type,
      adUnitId,
      error,
      data,
    )
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsSwipeableInterstitialAdModule"
  }
}
