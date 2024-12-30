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
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType
import com.facebook.react.views.view.ReactViewGroup
import com.google.android.gms.ads.nativead.MediaView
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
    val nativeModule = context.getNativeModule(ReactNativeGoogleMobileAdsNativeModule::class.java)
    nativeModule?.getNativeAd(responseId ?: "")?.let {
      if (nativeAd == it) {
        return
      }
      nativeAd = it
      reloadAd()
    }
  }

  fun registerAsset(assetType: String, reactTag: Int) {
    val uiManager = UIManagerHelper.getUIManagerForReactTag(context, reactTag)
    val assetView = uiManager?.resolveView(reactTag) ?: return
    when (assetType) {
      "advertiser" -> nativeAdView.advertiserView = assetView
      "body" -> nativeAdView.bodyView = assetView
      "callToAction" -> nativeAdView.callToActionView = assetView
      "headline" -> nativeAdView.headlineView = assetView
      "price" -> nativeAdView.priceView = assetView
      "store" -> nativeAdView.storeView = assetView
      "starRating" -> nativeAdView.starRatingView = assetView
      "icon" -> nativeAdView.iconView = assetView
      "image" -> nativeAdView.imageView = assetView
      "media" -> nativeAdView.mediaView = assetView as MediaView
    }
    reloadAd()
  }

  private fun reloadAd() {
    reloadJob?.cancel()
    reloadJob = CoroutineScope(Dispatchers.Main).launch {
      delay(100)
      nativeAd?.let { nativeAdView.setNativeAd(it) }
      nativeAdView.rootView.requestLayout()
    }
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  fun destroy() {
    reloadJob?.cancel()
    reloadJob = null
    nativeAdView.removeView(viewGroup)
    nativeAdView.destroy()
  }

  private val measureAndLayout = Runnable {
    measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
    )
    layout(left, top, right, bottom)
  }
}
