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
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.views.view.ReactViewGroup
import com.google.android.libraries.ads.mobile.sdk.nativead.MediaView
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@SuppressLint("ViewConstructor")
class ReactNativeGoogleMobileAdsNativeAdView(
  private val context: ReactContext,
) : FrameLayout(context) {
  val viewGroup = ReactViewGroup(context)
  private var nativeAdView: NativeAdView? = null
  private var nativeAd: NativeAd? = null
  private var mediaView: MediaView? = null
  private var responseId: String? = null
  private var reloadJob: Job? = null
  private var destroyed = false

  init {
    // Exclude the ad view hierarchy from instance state saving/restoring. Mediation
    // adapters (e.g. Facebook Audience Network) save view state under small view ids
    // that collide with React Native view tags, causing a crash
    // ("Wrong state class, expecting View State but received
    // com.facebook.ads.internal.util.parcelable.WrappedParcelable") when a fragment
    // (e.g. react-native-screens) restores its view hierarchy state.
    isSaveFromParentEnabled = false
    addView(viewGroup)
    runAfterInitialization {}
  }

  fun setResponseId(responseId: String?) {
    check(Looper.myLooper() == Looper.getMainLooper()) { "Native views must mutate on the main thread" }
    this.responseId = responseId
    runAfterInitialization {
      val nativeModule = context.getNativeModule(ReactNativeGoogleMobileAdsNativeModule::class.java)
      nativeModule?.getNativeAd(this.responseId ?: "")?.let {
        if (nativeAd == it) {
          return@runAfterInitialization
        }
        nativeAd = it
        reloadAd()
      }
    }
  }

  fun registerAsset(
    assetType: String,
    reactTag: Int,
  ) {
    check(Looper.myLooper() == Looper.getMainLooper()) { "Native views must mutate on the main thread" }
    runAfterInitialization {
      val sdkNativeAdView = nativeAdView ?: return@runAfterInitialization
      val uiManager = UIManagerHelper.getUIManagerForReactTag(context, reactTag)
      val assetView = uiManager?.resolveView(reactTag) ?: return@runAfterInitialization
      when (assetType) {
        "advertiser" -> sdkNativeAdView.advertiserView = assetView
        "body" -> sdkNativeAdView.bodyView = assetView
        "callToAction" -> sdkNativeAdView.callToActionView = assetView
        "headline" -> sdkNativeAdView.headlineView = assetView
        "price" -> sdkNativeAdView.priceView = assetView
        "store" -> sdkNativeAdView.storeView = assetView
        "starRating" -> sdkNativeAdView.starRatingView = assetView
        "icon" -> sdkNativeAdView.iconView = assetView
        // Next-Gen renders the main image through MediaView; it has no imageView asset.
        "image" -> Unit
        "media" ->
          (assetView as ReactNativeGoogleMobileAdsMediaView).whenSdkViewReady {
            mediaView = it
            reloadAd()
          }
      }
      reloadAd()
    }
  }

  private fun reloadAd() {
    val sdkNativeAdView = nativeAdView ?: return
    reloadJob?.cancel()
    reloadJob =
      CoroutineScope(Dispatchers.Main).launch {
        delay(100)
        nativeAd?.let { sdkNativeAdView.registerNativeAd(it, mediaView) }
        sdkNativeAdView.rootView.requestLayout()
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
    if (nativeAdView != null) {
      return
    }
    val sdkView = NativeAdView(context)
    (viewGroup.parent as? android.view.ViewGroup)?.removeView(viewGroup)
    sdkView.addView(viewGroup)
    removeAllViews()
    addView(sdkView)
    nativeAdView = sdkView
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  fun destroy() {
    destroyed = true
    reloadJob?.cancel()
    reloadJob = null
    nativeAdView?.let {
      it.removeView(viewGroup)
      it.destroy()
    }
    removeAllViews()
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
