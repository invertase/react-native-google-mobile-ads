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

import android.annotation.SuppressLint
import android.widget.FrameLayout
import com.facebook.react.bridge.ReactContext
import com.facebook.react.views.view.ReactViewGroup
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@SuppressLint("ViewConstructor")
class ReactNativeGoogleMobileAdsNativeAdView(
  private val context: ReactContext
): FrameLayout(context) {
  val viewGroup = ReactViewGroup(context)
  private val nativeAdView = NativeAdView(context)
  private var nativeAd: NativeAd? = null
  private var reloadJob: Job? = null

  init {
    nativeAdView.addView(viewGroup)
    addView(nativeAdView)
  }

  fun setResponseId(responseId: String?) {
    val nativeModule = context.getNativeModule(ReactNativeGoogleMobileAdsNativeModule.NAME) as ReactNativeGoogleMobileAdsNativeModule?
    nativeModule?.getNativeAd(responseId ?: "")?.let {
      if (nativeAd == it) {
        return
      }
      nativeAd = it
      reloadAd()
    }
  }

  fun registerAsset(assetKey: String, reactTag: Int) {
    val assetView = context.fabricUIManager?.resolveView(reactTag) ?: return
    when (assetKey) {
      "advertiser" -> nativeAdView.advertiserView = assetView
      "body" -> nativeAdView.bodyView = assetView
      "cta" -> nativeAdView.callToActionView = assetView
      "headline" -> nativeAdView.headlineView = assetView
      "price" -> nativeAdView.priceView = assetView
      "store" -> nativeAdView.storeView = assetView
      "ratings" -> nativeAdView.starRatingView = assetView
      "icon" -> nativeAdView.iconView = assetView
      "images" -> nativeAdView.imageView = assetView
    }
    reloadAd()
  }

  private fun reloadAd() {
    reloadJob?.cancel()
    reloadJob = CoroutineScope(Dispatchers.Main).launch {
      delay(100)
      nativeAd?.let { nativeAdView.setNativeAd(it) }
    }
  }
}
