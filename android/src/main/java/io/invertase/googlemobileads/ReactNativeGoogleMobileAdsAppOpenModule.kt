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
import com.google.android.gms.ads.AdLoadCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.admanager.AdManagerAdRequest
import com.google.android.gms.ads.appopen.AppOpenAd

class ReactNativeGoogleMobileAdsAppOpenModule(reactContext: ReactApplicationContext?) :
  ReactNativeGoogleMobileAdsFullScreenAdModule<AppOpenAd>(reactContext, NAME) {

  override fun getAdEventName(): String {
    return ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_APP_OPEN
  }

  @ReactMethod
  fun appOpenLoad(requestId: Int, adUnitId: String, adRequestOptions: ReadableMap) {
    load(requestId, adUnitId, adRequestOptions)
  }

  @ReactMethod
  fun appOpenShow(
    requestId: Int, adUnitId: String, showOptions: ReadableMap, promise: Promise
  ) {
    show(requestId, adUnitId, showOptions, promise)
  }

  override fun loadAd(
    activity: Activity,
    adUnitId: String,
    adRequest: AdManagerAdRequest,
    adLoadCallback: AdLoadCallback<AppOpenAd>
  ) {
    AppOpenAd.load(
      activity,
      adUnitId,
      adRequest,
      object :
        AppOpenAd.AppOpenAdLoadCallback() {
        override fun onAdLoaded(ad: AppOpenAd) {
          adLoadCallback.onAdLoaded(ad)
        }
        override fun onAdFailedToLoad(error: LoadAdError) {
          adLoadCallback.onAdFailedToLoad(error)
        }
      })
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsAppOpenModule"
  }
}
