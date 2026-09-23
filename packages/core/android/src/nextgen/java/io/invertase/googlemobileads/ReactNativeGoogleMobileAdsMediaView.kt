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
import android.os.Looper
import android.widget.FrameLayout
import android.widget.ImageView
import com.facebook.react.bridge.ReactContext
import com.google.android.libraries.ads.mobile.sdk.nativead.MediaView

@SuppressLint("ViewConstructor")
class ReactNativeGoogleMobileAdsMediaView(
  private val context: ReactContext,
) : FrameLayout(context) {
  private var sdkView: MediaView? = null
  private var responseId: String? = null
  private var resizeMode: String? = null
  private var destroyed = false

  init {
    runAfterInitialization {}
  }

  fun setResponseId(responseId: String?) {
    check(Looper.myLooper() == Looper.getMainLooper()) { "Media views must mutate on the main thread" }
    this.responseId = responseId
    runAfterInitialization {
      val nativeModule = context.getNativeModule(ReactNativeGoogleMobileAdsNativeModule::class.java)
      nativeModule?.getNativeAd(this.responseId ?: "")?.let {
        sdkView?.mediaContent = it.mediaContent
        requestLayout()
      }
    }
  }

  fun setResizeMode(resizeMode: String?) {
    check(Looper.myLooper() == Looper.getMainLooper()) { "Media views must mutate on the main thread" }
    this.resizeMode = resizeMode
    runAfterInitialization {
      applyResizeMode()
    }
  }

  fun whenSdkViewReady(action: (MediaView) -> Unit) {
    runAfterInitialization {
      sdkView?.let(action)
    }
  }

  private fun runAfterInitialization(action: () -> Unit) {
    NextGenMobileAdsGate.runWhenInitialized {
      post {
        if (destroyed) {
          return@post
        }
        ensureSdkView()
        action()
      }
    }
  }

  private fun ensureSdkView() {
    if (sdkView != null) {
      return
    }
    val initializedView = MediaView(context)
    sdkView = initializedView
    addView(
      initializedView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
    applyResizeMode()
  }

  private fun applyResizeMode() {
    val initializedView = sdkView ?: return
    when (resizeMode) {
      "cover" -> initializedView.imageScaleType = ImageView.ScaleType.CENTER_CROP
      "contain" -> initializedView.imageScaleType = ImageView.ScaleType.CENTER_INSIDE
      "stretch" -> initializedView.imageScaleType = ImageView.ScaleType.FIT_XY
    }
  }

  fun destroy() {
    destroyed = true
    removeAllViews()
    sdkView = null
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  private val measureAndLayout =
    Runnable {
      measure(
        MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
      )
      layout(left, top, right, bottom)
    }
}
