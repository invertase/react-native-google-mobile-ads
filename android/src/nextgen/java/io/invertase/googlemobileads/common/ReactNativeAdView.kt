package io.invertase.googlemobileads.common

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

import android.content.Context
import android.view.View.MeasureSpec
import android.widget.FrameLayout
import com.facebook.react.bridge.ReadableMap
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdRequest

/**
 * GMA Next-Gen SDK backed equivalent of the legacy `common.ReactNativeAdView`. See the legacy
 * class for why FrameLayout is used instead of ReactViewGroup.
 */
class ReactNativeAdView(context: Context) : FrameLayout(context) {
  var request: BannerAdRequest? = null
  var sizes: List<AdSize>? = null
  var maxAdHeight: Float = 0f
  var adWidth: Float = 0f
  var unitId: String? = null
  var manualImpressionsEnabled: Boolean = false
  var propsChanged: Boolean = false
  var isFluid: Boolean = false

  /** Raw `request` prop options, converted from JSON to a ReadableMap by the view manager. The
   * actual GMA Next-Gen SDK BannerAdRequest is built lazily once sizes/manualImpressionsEnabled
   * are also known, since all three props can arrive in any order. */
  var pendingRequestOptions: ReadableMap? = null

  init {
    // See the legacy class for why instance state saving is disabled here.
    isSaveFromParentEnabled = false
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  private val measureAndLayout = Runnable {
    val heightMeasureSpec =
      if (isFluid) {
        MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
      } else {
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
      }
    measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), heightMeasureSpec)
    layout(left, top, right, top + height)
  }
}
