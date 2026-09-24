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
import android.content.Context
import android.view.View
import android.widget.FrameLayout
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.views.view.ReactViewGroup
import com.google.android.gms.ads.nativead.MediaView
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdView
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
) : FrameLayout(context) {
  val viewGroup = ReactViewGroup(context)
  private val nativeAdView = NativeAdView(sdkViewContext(context))
  private var nativeAd: NativeAd? = null
  private var reloadJob: Job? = null
  private val sdkOwnedAssetViews: MutableSet<View> =
    Collections.newSetFromMap(WeakHashMap())

  init {
    // Exclude the ad view hierarchy from instance state saving/restoring. Mediation
    // adapters (e.g. Facebook Audience Network) save view state under small view ids
    // that collide with React Native view tags, causing a crash
    // ("Wrong state class, expecting View State but received
    // com.facebook.ads.internal.util.parcelable.WrappedParcelable") when a fragment
    // (e.g. react-native-screens) restores its view hierarchy state.
    isSaveFromParentEnabled = false
    nativeAdView.addView(viewGroup)
    addView(nativeAdView)
    ReactNativeGoogleMobileAdsNativeAdClickOverlay.ensureSdkOverlayOnTop(nativeAdView, viewGroup)
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

  fun registerAsset(
    assetType: String,
    reactTag: Int,
  ) {
    val uiManager = UIManagerHelper.getUIManagerForReactTag(context, reactTag)
    val assetView = uiManager?.resolveView(reactTag) ?: return
    registerResolvedAsset(assetType, assetView)
  }

  /** Test / shared path after a view has been resolved from a React tag. */
  internal fun registerResolvedAsset(
    assetType: String,
    assetView: View,
  ) {
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
      "media" -> {
        nativeAdView.mediaView = assetView as MediaView
        reloadAd()
        return
      }
      else -> {
        reloadAd()
        return
      }
    }
    // NativeAdView asset setters can mark the view clickable; clear after assign (#893 / iOS parity).
    sdkOwnedAssetViews.add(assetView)
    ReactNativeGoogleMobileAdsNativeAdClickOverlay.prepareAssetViewForSdkOwnedClicks(assetView)
    reloadAd()
  }

  private fun reapplySdkOwnedClicks() {
    for (assetView in sdkOwnedAssetViews) {
      ReactNativeGoogleMobileAdsNativeAdClickOverlay.prepareAssetViewForSdkOwnedClicks(assetView)
    }
    ReactNativeGoogleMobileAdsNativeAdClickOverlay.ensureSdkOverlayOnTop(nativeAdView, viewGroup)
  }

  private fun reloadAd() {
    reloadJob?.cancel()
    reloadJob =
      CoroutineScope(Dispatchers.Main).launch {
        delay(100)
        nativeAd?.let { nativeAdView.setNativeAd(it) }
        // setNativeAd may re-enable clickable on assets; restore SDK click ownership (#893).
        reapplySdkOwnedClicks()
        // setNativeAd can land after the MediaView's first 0×0 layout; refresh so video paints (#775).
        (nativeAdView.mediaView as? ReactNativeGoogleMobileAdsMediaView)?.refreshPresentation()
        nativeAdView.rootView.requestLayout()
      }
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  /** Visible for tests / layout: keep GMA overlay above React content. */
  internal fun ensureClickOverlayOnTop() {
    ReactNativeGoogleMobileAdsNativeAdClickOverlay.ensureSdkOverlayOnTop(nativeAdView, viewGroup)
  }

  fun destroy() {
    reloadJob?.cancel()
    reloadJob = null
    sdkOwnedAssetViews.clear()
    nativeAdView.removeView(viewGroup)
    nativeAdView.destroy()
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
     * Prefer the current Activity when constructing [NativeAdView] so click intents can start
     * (same rationale as banner AdView construction).
     */
    internal fun sdkViewContext(reactContext: ReactContext): Context = reactContext.currentActivity ?: reactContext
  }
}
