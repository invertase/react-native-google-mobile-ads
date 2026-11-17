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
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.bridge.ReactContext

@SuppressLint("ViewConstructor")
class ReactNativeGoogleMobileAdsSwipeableInterstitialAdView(
  private val context: ReactContext,
) : FrameLayout(context) {
  private var requestId: Int? = null
  private var sdkView: View? = null
  private var destroyed = false

  init {
    isSaveFromParentEnabled = false
  }

  fun setRequestId(requestId: Int?) {
    check(Looper.myLooper() == Looper.getMainLooper()) {
      "Swipeable interstitial views must mutate on the main thread"
    }
    this.requestId = requestId
    attachSdkViewIfReady()
  }

  private fun attachSdkViewIfReady() {
    val id = requestId ?: return
    val module =
      context.getNativeModule(ReactNativeGoogleMobileAdsSwipeableInterstitialAdModule::class.java)
    val ad = module?.getSwipeableInterstitialAd(id) ?: return
    val activity = findActivity(context) ?: return
    val nextView = ad.getView(activity)
    if (sdkView === nextView) {
      return
    }
    removeAllViews()
    sdkView = nextView
    addView(
      nextView,
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      ),
    )
  }

  private fun findActivity(context: Context): Activity? {
    var current = context
    while (current is ContextWrapper) {
      if (current is Activity) {
        return current
      }
      current = current.baseContext
    }
    return null
  }

  fun destroy() {
    destroyed = true
    sdkView = null
    removeAllViews()
  }
}
