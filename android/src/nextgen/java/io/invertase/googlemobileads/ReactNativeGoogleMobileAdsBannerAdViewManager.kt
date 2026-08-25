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

import androidx.annotation.NonNull
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.annotations.ReactProp
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.banner.AdView
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdEventCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import io.invertase.googlemobileads.common.ReactNativeAdView
import io.invertase.googlemobileads.common.SharedUtils
import org.json.JSONException
import org.json.JSONObject

/**
 * GMA Next-Gen SDK backed equivalent of the legacy `ReactNativeGoogleMobileAdsBannerAdViewManager`.
 * There is a single `AdView` class covering both AdMob and Ad Manager unit IDs, unlike legacy's
 * `AdView`/`AdManagerAdView` split.
 */
class ReactNativeGoogleMobileAdsBannerAdViewManager : SimpleViewManager<ReactNativeAdView>() {
  private val REACT_CLASS = "RNGoogleMobileAdsBannerView"
  private val EVENT_AD_LOADED = "onAdLoaded"
  private val EVENT_AD_IMPRESSION = "onAdImpression"
  private val EVENT_AD_CLICKED = "onAdClicked"
  private val EVENT_AD_FAILED_TO_LOAD = "onAdFailedToLoad"
  private val EVENT_AD_OPENED = "onAdOpened"
  private val EVENT_AD_CLOSED = "onAdClosed"
  private val EVENT_PAID = "onPaid"
  private val EVENT_SIZE_CHANGE = "onSizeChange"
  private val EVENT_APP_EVENT = "onAppEvent"
  private val COMMAND_ID_RECORD_MANUAL_IMPRESSION = "recordManualImpression"
  private val COMMAND_ID_LOAD = "load"

  override fun getName() = REACT_CLASS

  override fun createViewInstance(themedReactContext: ThemedReactContext): ReactNativeAdView {
    return ReactNativeAdView(themedReactContext)
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
    val builder = MapBuilder.builder<String, Any>()
    builder.put(OnNativeEvent.EVENT_NAME, MapBuilder.of("registrationName", "onNativeEvent"))
    return builder.build()
  }

  override fun receiveCommand(reactViewGroup: ReactNativeAdView, commandId: String, args: ReadableArray?) {
    super.receiveCommand(reactViewGroup, commandId, args)

    when (commandId) {
      COMMAND_ID_RECORD_MANUAL_IMPRESSION -> getAdView(reactViewGroup)?.getBannerAd()?.recordManualImpression()
      COMMAND_ID_LOAD -> {
        val adView = getAdView(reactViewGroup)
        val request = reactViewGroup.request
        if (adView != null && request != null) {
          adView.loadAd(request, buildAdLoadCallback(reactViewGroup))
        }
      }
    }
  }

  @ReactProp(name = "unitId")
  fun setUnitId(reactViewGroup: ReactNativeAdView, value: String) {
    reactViewGroup.unitId = value
    reactViewGroup.propsChanged = true
  }

  @ReactProp(name = "request")
  fun setRequest(reactViewGroup: ReactNativeAdView, value: String) {
    try {
      reactViewGroup.pendingRequestOptions = SharedUtils.jsonObjectToWritableMap(JSONObject(value))
      reactViewGroup.propsChanged = true
    } catch (e: JSONException) {
      e.printStackTrace()
    }
  }

  @ReactProp(name = "sizeConfig")
  fun setSizeConfig(reactViewGroup: ReactNativeAdView, sizeConfig: ReadableMap?) {
    if (sizeConfig != null) {
      if (sizeConfig.hasKey("maxHeight") && !sizeConfig.isNull("maxHeight")) {
        reactViewGroup.maxAdHeight = sizeConfig.getDouble("maxHeight").toFloat()
      } else {
        reactViewGroup.maxAdHeight = 0f
      }

      if (sizeConfig.hasKey("width") && !sizeConfig.isNull("width")) {
        reactViewGroup.adWidth = sizeConfig.getDouble("width").toFloat()
      } else {
        reactViewGroup.adWidth = 0f
      }

      if (sizeConfig.hasKey("sizes") && !sizeConfig.isNull("sizes")) {
        val sizesArray = sizeConfig.getArray("sizes")
        if (sizesArray != null) {
          val sizeList = mutableListOf<AdSize>()
          for (i in 0 until sizesArray.size()) {
            if (sizesArray.getType(i) == ReadableType.String) {
              val sizeString = checkNotNull(sizesArray.getString(i))
              sizeList.add(ReactNativeGoogleMobileAdsCommon.getAdSize(sizeString, reactViewGroup))
            }
          }

          if (sizeList.isNotEmpty() && !sizeList.contains(AdSize.FLUID)) {
            val adSize = sizeList[0]
            val payload = Arguments.createMap()
            payload.putDouble("width", adSize.width.toDouble())
            payload.putDouble("height", adSize.height.toDouble())
            sendEvent(reactViewGroup, EVENT_SIZE_CHANGE, payload)
          }

          reactViewGroup.sizes = sizeList
        }
      }

      reactViewGroup.propsChanged = true
    }
  }

  @ReactProp(name = "manualImpressionsEnabled")
  fun setManualImpressionsEnabled(reactViewGroup: ReactNativeAdView, value: Boolean) {
    reactViewGroup.manualImpressionsEnabled = value
    reactViewGroup.propsChanged = true
  }

  override fun onAfterUpdateTransaction(reactViewGroup: ReactNativeAdView) {
    super.onAfterUpdateTransaction(reactViewGroup)
    if (reactViewGroup.propsChanged) {
      requestAd(reactViewGroup)
    }
    reactViewGroup.propsChanged = false
  }

  override fun onDropViewInstance(reactViewGroup: ReactNativeAdView) {
    val adView = getAdView(reactViewGroup)
    if (adView != null) {
      adView.getBannerAd()?.adEventCallback = null
      adView.destroy()
      reactViewGroup.removeView(adView)
    }
    super.onDropViewInstance(reactViewGroup)
  }

  private fun getAdView(reactViewGroup: ReactNativeAdView): AdView? {
    return reactViewGroup.getChildAt(0) as? AdView
  }

  private fun initAdView(reactViewGroup: ReactNativeAdView): AdView? {
    val oldAdView = getAdView(reactViewGroup)
    if (oldAdView != null) {
      oldAdView.getBannerAd()?.adEventCallback = null
      oldAdView.destroy()
      reactViewGroup.removeView(oldAdView)
    }

    val currentActivity = (reactViewGroup.context as ReactContext).currentActivity ?: return null

    val adView = AdView(currentActivity)
    reactViewGroup.addView(adView)
    return adView
  }

  private fun buildAdLoadCallback(reactViewGroup: ReactNativeAdView): AdLoadCallback<BannerAd> {
    return object : AdLoadCallback<BannerAd> {
      override fun onAdLoaded(ad: BannerAd) {
        ad.adEventCallback = object : BannerAdEventCallback, AdEventCallback {
          override fun onAdShowedFullScreenContent() {
            sendEvent(reactViewGroup, EVENT_AD_OPENED, null)
          }

          override fun onAdDismissedFullScreenContent() {
            sendEvent(reactViewGroup, EVENT_AD_CLOSED, null)
          }

          override fun onAdFailedToShowFullScreenContent(error: FullScreenContentError) {}

          override fun onAdImpression() {
            sendEvent(reactViewGroup, EVENT_AD_IMPRESSION, null)
          }

          override fun onAdClicked() {
            sendEvent(reactViewGroup, EVENT_AD_CLICKED, null)
          }

          override fun onAdPaid(adValue: AdValue) {
            val payload = Arguments.createMap()
            payload.putDouble("value", 1e-6 * adValue.valueMicros)
            payload.putDouble("precision", 1.0 * adValue.precisionType.ordinal)
            payload.putString("currency", adValue.currencyCode)
            sendEvent(reactViewGroup, EVENT_PAID, payload)
          }

          override fun onAppEvent(name: String, data: String?) {
            val payload = Arguments.createMap()
            payload.putString("name", name)
            payload.putString("data", data)
            sendEvent(reactViewGroup, EVENT_APP_EVENT, payload)
          }
        }

        val adSize = ad.getAdSize()
        val width: Int
        val height: Int
        if (reactViewGroup.isFluid) {
          width = reactViewGroup.width
          height = reactViewGroup.height
          getAdView(reactViewGroup)?.addOnLayoutChangeListener { _, left, top, right, bottom, _, _, _, _ ->
            val payload = Arguments.createMap()
            payload.putDouble("width", PixelUtil.toDIPFromPixel((right - left).toFloat()).toDouble())
            payload.putDouble("height", PixelUtil.toDIPFromPixel((bottom - top).toFloat()).toDouble())
            sendEvent(reactViewGroup, EVENT_SIZE_CHANGE, payload)
          }
        } else {
          val adViewInstance = getAdView(reactViewGroup)
          val left = adViewInstance?.left ?: 0
          val top = adViewInstance?.top ?: 0
          width = adSize.getWidthInPixels(reactViewGroup.context)
          height = adSize.getHeightInPixels(reactViewGroup.context)
          adViewInstance?.measure(width, height)
          adViewInstance?.layout(left, top, left + width, top + height)
        }

        val payload = Arguments.createMap()
        payload.putDouble("width", PixelUtil.toDIPFromPixel(width.toFloat()).toDouble())
        payload.putDouble("height", PixelUtil.toDIPFromPixel(height.toFloat()).toDouble())
        sendEvent(reactViewGroup, EVENT_AD_LOADED, payload)
      }

      override fun onAdFailedToLoad(loadAdError: LoadAdError) {
        val codeAndMessage = ReactNativeGoogleMobileAdsCommon.getCodeAndMessageFromAdError(loadAdError)
        val payload = Arguments.createMap()
        payload.putString("code", codeAndMessage[0])
        payload.putString("message", codeAndMessage[1])
        sendEvent(reactViewGroup, EVENT_AD_FAILED_TO_LOAD, payload)
      }
    }
  }

  private fun requestAd(reactViewGroup: ReactNativeAdView) {
    val unitId = reactViewGroup.unitId
    val sizes = reactViewGroup.sizes
    val requestOptions = reactViewGroup.pendingRequestOptions

    if (unitId == null || sizes == null || sizes.isEmpty() || requestOptions == null) {
      return
    }

    reactViewGroup.isFluid = sizes.contains(AdSize.FLUID)
    val adRequest = ReactNativeGoogleMobileAdsCommon.buildBannerAdRequest(
      unitId,
      sizes,
      reactViewGroup.manualImpressionsEnabled,
      requestOptions
    )
    reactViewGroup.request = adRequest

    val adView = initAdView(reactViewGroup) ?: return
    adView.loadAd(adRequest, buildAdLoadCallback(reactViewGroup))
  }

  private fun sendEvent(reactViewGroup: ReactNativeAdView, type: String, payload: WritableMap?) {
    val event = Arguments.createMap()
    event.putString("type", type)
    if (payload != null) event.merge(payload)

    val themedReactContext = reactViewGroup.context as ThemedReactContext
    val eventDispatcher =
      UIManagerHelper.getEventDispatcherForReactTag(themedReactContext, reactViewGroup.id)
    eventDispatcher?.dispatchEvent(OnNativeEvent(reactViewGroup.id, event))
  }
}
