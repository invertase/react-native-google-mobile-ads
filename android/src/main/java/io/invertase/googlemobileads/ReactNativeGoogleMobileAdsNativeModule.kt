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

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.google.android.gms.ads.AdLoader
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdOptions

class ReactNativeGoogleMobileAdsNativeModule(
  reactContext: ReactApplicationContext
) : NativeGoogleMobileAdsNativeModuleSpec(reactContext) {
  private val loadedAds = HashMap<String, NativeAd>()

  override fun getName() = NAME

  override fun load(adUnitId: String, requestOptions: ReadableMap, promise: Promise) {
    val nativeAdOptions = NativeAdOptions.Builder()
      .setReturnUrlsForImageAssets(true)
      .build()
    val adLoader = AdLoader.Builder(reactApplicationContext, adUnitId)
      .withNativeAdOptions(nativeAdOptions)
      .forNativeAd { nativeAd ->
        val responseId = nativeAd.responseInfo?.responseId ?: return@forNativeAd
        loadedAds[responseId] = nativeAd

        val data = Arguments.createMap()
        data.putString("responseId", responseId)
        data.putString("advertiser", nativeAd.advertiser)
        data.putString("body", nativeAd.body)
        data.putString("callToAction", nativeAd.callToAction)
        data.putString("headline", nativeAd.headline)
        data.putString("price", nativeAd.price)
        data.putString("store", nativeAd.store)
        nativeAd.starRating?.let {
          data.putDouble("starRating", it)
        } ?: run {
          data.putNull("starRating")
        }
        nativeAd.icon?.let {
          val icon = Arguments.createMap()
          icon.putDouble("scale", it.scale)
          icon.putString("url", it.uri.toString())
          data.putMap("icon", icon)
        } ?: run {
          data.putNull("icon")
        }

        promise.resolve(data)
      }
      .build()
    val adRequest = ReactNativeGoogleMobileAdsCommon.buildAdRequest(requestOptions)
    adLoader.loadAd(adRequest)
  }

  fun getNativeAd(responseId: String): NativeAd? {
    return loadedAds[responseId]
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsNativeModule"
  }
}
