package io.invertase.googlemobileads

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAd

class ReactNativeGoogleMobileAdsRewardedModule(
  reactContext: ReactApplicationContext?,
) : ReactNativeGoogleMobileAdsFullScreenAdModule<RewardedAd>(reactContext, NAME) {
  override fun getAdEventName(): String = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED

  @ReactMethod
  fun rewardedLoad(
    requestId: Int,
    adUnitId: String,
    adRequestOptions: ReadableMap,
  ) = load(requestId, adUnitId, adRequestOptions)

  @ReactMethod
  fun rewardedShow(
    requestId: Int,
    adUnitId: String,
    showOptions: ReadableMap,
    promise: Promise,
  ) = show(requestId, adUnitId, showOptions, promise)

  @ReactMethod
  fun rewardedDestroy(requestId: Int) = destroy(requestId)

  override fun loadAd(
    adRequest: AdRequest,
    adLoadCallback: AdLoadCallback<RewardedAd>,
  ) {
    RewardedAd.load(adRequest, adLoadCallback)
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsRewardedModule"
  }
}
