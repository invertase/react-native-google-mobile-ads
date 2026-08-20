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
import android.widget.ImageView
import com.facebook.react.bridge.ReactContext
import com.google.android.libraries.ads.mobile.sdk.nativead.MediaView as SdkMediaView

/**
 * GMA Next-Gen SDK backed equivalent of the legacy `ReactNativeGoogleMobileAdsMediaView`. Unlike
 * the legacy SDK's `MediaView`, GMA Next-Gen SDK's `MediaView` is a final class, so it cannot be
 * subclassed - it is wrapped as a child view instead. [sdkMediaView] is what actually gets passed
 * to `NativeAdView.registerNativeAd()`.
 */
@SuppressLint("ViewConstructor")
class ReactNativeGoogleMobileAdsMediaView(
  private val context: ReactContext
) : FrameLayout(context) {
  val sdkMediaView = SdkMediaView(context)

  init {
    isSaveFromParentEnabled = false
    addView(sdkMediaView)
  }

  fun setResponseId(responseId: String?) {
    val nativeModule = context.getNativeModule(ReactNativeGoogleMobileAdsNativeModule::class.java)
    nativeModule?.getNativeAd(responseId ?: "")?.mediaContent?.let {
      sdkMediaView.mediaContent = it
      requestLayout()
    }
  }

  fun setResizeMode(resizeMode: String?) {
    when (resizeMode) {
      "cover" -> sdkMediaView.imageScaleType = ImageView.ScaleType.CENTER_CROP
      "contain" -> sdkMediaView.imageScaleType = ImageView.ScaleType.CENTER_INSIDE
      "stretch" -> sdkMediaView.imageScaleType = ImageView.ScaleType.FIT_XY
    }
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  private val measureAndLayout = Runnable {
    measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
    )
    layout(left, top, right, bottom)
    sdkMediaView.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
    )
    sdkMediaView.layout(0, 0, width, height)
  }
}
