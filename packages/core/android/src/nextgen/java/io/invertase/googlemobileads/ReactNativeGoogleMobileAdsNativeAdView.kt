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
import com.facebook.react.bridge.LifecycleEventListener
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
import java.util.Collections
import java.util.WeakHashMap

@SuppressLint("ViewConstructor")
class ReactNativeGoogleMobileAdsNativeAdView(
  private val context: ReactContext,
) : FrameLayout(context),
  LifecycleEventListener {
  val viewGroup = ReactViewGroup(context)
  private var nativeAdView: NativeAdView? = null
  private var nativeAd: NativeAd? = null
  private var mediaView: MediaView? = null
  private var responseId: String? = null
  private var reloadJob: Job? = null
  private var destroyed = false
  private val sdkOwnedAssetViews: MutableSet<View> =
    Collections.newSetFromMap(WeakHashMap())
  private val pendingAssets = ArrayList<Pair<String, View>>()

  init {
    // Exclude the ad view hierarchy from instance state saving/restoring. Mediation
    // adapters (e.g. Facebook Audience Network) save view state under small view ids
    // that collide with React Native view tags, causing a crash
    // ("Wrong state class, expecting View State but received
    // com.facebook.ads.internal.util.parcelable.WrappedParcelable") when a fragment
    // (e.g. react-native-screens) restores its view hierarchy state.
    isSaveFromParentEnabled = false
    addView(viewGroup)
    context.addLifecycleEventListener(this)
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
      val uiManager = UIManagerHelper.getUIManagerForReactTag(context, reactTag)
      val assetView = uiManager?.resolveView(reactTag) ?: return@runAfterInitialization
      registerResolvedAsset(assetType, assetView)
    }
  }

  /** Test / shared path after a view has been resolved from a React tag. */
  internal fun registerResolvedAsset(
    assetType: String,
    assetView: View,
  ) {
    val sdkNativeAdView = nativeAdView
    if (sdkNativeAdView == null) {
      // NativeAsset registers once; buffer until Activity-backed NativeAdView exists (#726).
      pendingAssets.add(assetType to assetView)
      ensureSdkView()
      return
    }
    applyResolvedAsset(sdkNativeAdView, assetType, assetView)
  }

  private fun applyResolvedAsset(
    sdkNativeAdView: NativeAdView,
    assetType: String,
    assetView: View,
  ) {
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
      "image" -> {
        reloadAd()
        return
      }
      "media" -> {
        (assetView as ReactNativeGoogleMobileAdsMediaView).whenSdkViewReady {
          mediaView = it
          reloadAd()
        }
        return
      }
      else -> {
        reloadAd()
        return
      }
    }
    sdkOwnedAssetViews.add(assetView)
    ReactNativeGoogleMobileAdsNativeAdClickOverlay.prepareAssetViewForSdkOwnedClicks(assetView)
    reloadAd()
  }

  private fun flushPendingAssets(sdkNativeAdView: NativeAdView) {
    if (pendingAssets.isEmpty()) {
      return
    }
    val pending = ArrayList(pendingAssets)
    pendingAssets.clear()
    for ((assetType, assetView) in pending) {
      applyResolvedAsset(sdkNativeAdView, assetType, assetView)
    }
  }

  private fun reapplySdkOwnedClicks(sdkNativeAdView: NativeAdView) {
    for (assetView in sdkOwnedAssetViews) {
      ReactNativeGoogleMobileAdsNativeAdClickOverlay.prepareAssetViewForSdkOwnedClicks(assetView)
    }
    ReactNativeGoogleMobileAdsNativeAdClickOverlay.ensureSdkOverlayOnTop(sdkNativeAdView, viewGroup)
  }

  private fun reloadAd() {
    val sdkNativeAdView = nativeAdView ?: return
    reloadJob?.cancel()
    reloadJob =
      CoroutineScope(Dispatchers.Main).launch {
        delay(100)
        nativeAd?.let { sdkNativeAdView.registerNativeAd(it, mediaView) }
        reapplySdkOwnedClicks(sdkNativeAdView)
        // registerNativeAd can land after the MediaView's first 0×0 layout; refresh so video paints (#775).
        (mediaView?.parent as? ReactNativeGoogleMobileAdsMediaView)?.refreshPresentation()
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

  /**
   * Builds Next-Gen [NativeAdView] only with an [Activity] context (banner parity).
   * Non-Activity contexts force click launches with
   * [android.content.Intent.FLAG_ACTIVITY_NEW_TASK] and can leave a blank Recents
   * task (#726).
   */
  private fun ensureSdkView() {
    if (destroyed || nativeAdView != null) {
      return
    }
    val activity = sdkViewContext(context) ?: return
    val sdkView = NativeAdView(activity)
    (viewGroup.parent as? ViewGroup)?.removeView(viewGroup)
    sdkView.addView(viewGroup)
    removeAllViews()
    addView(sdkView)
    nativeAdView = sdkView
    ReactNativeGoogleMobileAdsNativeAdClickOverlay.ensureSdkOverlayOnTop(sdkView, viewGroup)
    flushPendingAssets(sdkView)
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  internal fun ensureClickOverlayOnTop() {
    nativeAdView?.let {
      ReactNativeGoogleMobileAdsNativeAdClickOverlay.ensureSdkOverlayOnTop(it, viewGroup)
    }
  }

  override fun onHostResume() {
    if (nativeAdView == null) {
      runAfterInitialization {
        // ensureSdkView (via runAfterInitialization) flushes pending assets (#726).
        if (nativeAd != null) {
          reloadAd()
        }
      }
    }
  }

  override fun onHostPause() = Unit

  override fun onHostDestroy() = Unit

  fun destroy() {
    if (destroyed) {
      return
    }
    destroyed = true
    context.removeLifecycleEventListener(this)
    reloadJob?.cancel()
    reloadJob = null
    pendingAssets.clear()
    sdkOwnedAssetViews.clear()
    nativeAdView?.let {
      it.removeView(viewGroup)
      it.destroy()
    }
    nativeAdView = null
    removeAllViews()
  }

  private val measureAndLayout =
    Runnable {
      measure(
        MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
      )
      layout(left, top, right, bottom)
      ensureClickOverlayOnTop()
    }

  companion object {
    /**
     * Activity-only context for NativeAdView construction (#726). Prefers
     * [ReactContext.getCurrentActivity], then walks [ContextWrapper.getBaseContext]
     * (ThemedReactContext often wraps Activity). Null when neither yields an Activity —
     * [ensureSdkView] defers until [onHostResume].
     */
    internal fun sdkViewContext(reactContext: ReactContext): Activity? {
      reactContext.currentActivity?.let {
        return it
      }
      var current: Context? = reactContext
      while (current != null) {
        if (current is Activity) {
          return current
        }
        current = (current as? ContextWrapper)?.baseContext
      }
      return null
    }
  }
}
