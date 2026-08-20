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

import android.app.Activity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.google.android.libraries.ads.mobile.sdk.common.AdEventCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.rewarded.OnUserEarnedRewardListener
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardItem
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAd
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.rewarded.ServerSideVerificationOptions

class ReactNativeGoogleMobileAdsRewardedModule(reactContext: ReactApplicationContext?) :
  ReactNativeGoogleMobileAdsFullScreenAdModule<RewardedAd>(reactContext, NAME) {

  override fun getAdEventName() = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED

  @ReactMethod
  fun rewardedLoad(requestId: Int, adUnitId: String, adRequestOptions: ReadableMap) {
    load(requestId, adUnitId, adRequestOptions)
  }

  @ReactMethod
  fun rewardedShow(requestId: Int, adUnitId: String, showOptions: ReadableMap, promise: Promise) {
    show(requestId, adUnitId, showOptions, promise)
  }

  override fun loadAd(adRequest: AdRequest, adLoadCallback: AdLoadCallback<RewardedAd>) {
    RewardedAd.load(adRequest, adLoadCallback)
  }

  override fun attachAdEventCallback(ad: RewardedAd, callback: SharedAdEventCallback) {
    ad.adEventCallback = object : RewardedAdEventCallback, AdEventCallback by callback {}
  }

  override fun showAd(ad: RewardedAd, activity: Activity, onUserEarnedReward: (RewardItem) -> Unit) {
    ad.show(
      activity,
      object : OnUserEarnedRewardListener {
        override fun onUserEarnedReward(rewardItem: RewardItem) {
          onUserEarnedReward(rewardItem)
        }
      }
    )
  }

  override fun setImmersiveModeOnAd(ad: RewardedAd, enabled: Boolean) {
    ad.setImmersiveMode(enabled)
  }

  override fun applyServerSideVerificationOptions(ad: RewardedAd, options: ReadableMap) {
    ad.setServerSideVerificationOptions(
      ServerSideVerificationOptions(options.getString("userId") ?: "", options.getString("customData") ?: "")
    )
  }

  override fun getRewardedLoadedData(ad: RewardedAd): WritableMap {
    val rewardItem = ad.getRewardItem()
    val data = Arguments.createMap()
    data.putString("type", rewardItem.type)
    data.putInt("amount", rewardItem.amount)
    return data
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsRewardedModule"
  }
}
