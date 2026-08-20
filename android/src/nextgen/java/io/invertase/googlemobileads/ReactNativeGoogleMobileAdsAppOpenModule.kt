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
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.google.android.libraries.ads.mobile.sdk.appopen.AppOpenAd
import com.google.android.libraries.ads.mobile.sdk.appopen.AppOpenAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdEventCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardItem

class ReactNativeGoogleMobileAdsAppOpenModule(reactContext: ReactApplicationContext?) :
  ReactNativeGoogleMobileAdsFullScreenAdModule<AppOpenAd>(reactContext, NAME) {

  override fun getAdEventName() = ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_APP_OPEN

  @ReactMethod
  fun appOpenLoad(requestId: Int, adUnitId: String, adRequestOptions: ReadableMap) {
    load(requestId, adUnitId, adRequestOptions)
  }

  @ReactMethod
  fun appOpenShow(requestId: Int, adUnitId: String, showOptions: ReadableMap, promise: Promise) {
    show(requestId, adUnitId, showOptions, promise)
  }

  override fun loadAd(adRequest: AdRequest, adLoadCallback: AdLoadCallback<AppOpenAd>) {
    AppOpenAd.load(adRequest, adLoadCallback)
  }

  override fun attachAdEventCallback(ad: AppOpenAd, callback: SharedAdEventCallback) {
    ad.adEventCallback = object : AppOpenAdEventCallback, AdEventCallback by callback {}
  }

  override fun showAd(ad: AppOpenAd, activity: Activity, onUserEarnedReward: (RewardItem) -> Unit) {
    ad.show(activity)
  }

  override fun setImmersiveModeOnAd(ad: AppOpenAd, enabled: Boolean) {
    ad.setImmersiveMode(enabled)
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsAppOpenModule"
  }
}
