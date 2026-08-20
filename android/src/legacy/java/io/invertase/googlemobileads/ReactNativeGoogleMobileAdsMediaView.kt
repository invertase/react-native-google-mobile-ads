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
import android.widget.ImageView
import com.facebook.react.bridge.ReactContext
import com.google.android.gms.ads.nativead.MediaView

@SuppressLint("ViewConstructor")
class ReactNativeGoogleMobileAdsMediaView(
  private val context: ReactContext
): MediaView(context) {
  fun setResponseId(responseId: String?) {
    val nativeModule = context.getNativeModule(ReactNativeGoogleMobileAdsNativeModule::class.java)
    nativeModule?.getNativeAd(responseId ?: "")?.let {
      this.mediaContent = it.mediaContent
      requestLayout()
    }
  }

  fun setResizeMode(resizeMode: String?) {
    when (resizeMode) {
      "cover" -> setImageScaleType(ImageView.ScaleType.CENTER_CROP)
      "contain" -> setImageScaleType(ImageView.ScaleType.CENTER_INSIDE)
      "stretch" -> setImageScaleType(ImageView.ScaleType.FIT_XY)
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
  }
}
