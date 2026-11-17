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
import android.widget.FrameLayout
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.views.view.ReactViewGroup
import com.google.android.libraries.ads.mobile.sdk.common.AdChoicesView
import com.google.android.libraries.ads.mobile.sdk.iconad.IconAd
import com.google.android.libraries.ads.mobile.sdk.iconad.IconAdView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Collections
import java.util.WeakHashMap

@SuppressLint("ViewConstructor")
class ReactNativeGoogleMobileAdsIconAdView(
  private val context: ReactContext,
) : FrameLayout(context) {
  val viewGroup = ReactViewGroup(context)
  private var iconAdView: IconAdView? = null
  private var iconAd: IconAd? = null
  private var requestId: Int? = null
  private var reloadJob: Job? = null
  private var destroyed = false
  private val sdkOwnedAssetViews: MutableSet<View> =
    Collections.newSetFromMap(WeakHashMap())
  private val pendingAssets = ArrayList<Pair<String, View>>()

  init {
    isSaveFromParentEnabled = false
    addView(viewGroup)
  }

  fun setRequestId(requestId: Int?) {
    check(Looper.myLooper() == Looper.getMainLooper()) { "Icon views must mutate on the main thread" }
    this.requestId = requestId
    if (requestId == null) {
      return
    }
    val module = context.getNativeModule(ReactNativeGoogleMobileAdsIconAdModule::class.java)
    val ad = module?.getIconAd(requestId)
    if (iconAd != ad) {
      iconAd = ad
      reloadAd()
    }
  }

  fun registerAsset(
    assetType: String,
    reactTag: Int,
  ) {
    check(Looper.myLooper() == Looper.getMainLooper()) { "Icon views must mutate on the main thread" }
    val uiManager = UIManagerHelper.getUIManagerForReactTag(context, reactTag)
    val assetView = uiManager?.resolveView(reactTag) ?: return
    registerResolvedAsset(assetType, assetView)
  }

  internal fun registerResolvedAsset(
    assetType: String,
    assetView: View,
  ) {
    val sdkView = iconAdView
    if (sdkView == null) {
      pendingAssets.add(assetType to assetView)
      ensureSdkView()
      return
    }
    applyResolvedAsset(sdkView, assetType, assetView)
  }

  private fun applyResolvedAsset(
    sdkView: IconAdView,
    assetType: String,
    assetView: View,
  ) {
    when (assetType) {
      "headline" -> sdkView.headlineView = assetView
      "callToAction" -> sdkView.callToActionView = assetView
      "icon" -> sdkView.iconView = assetView
      "starRating" -> sdkView.starRatingView = assetView
      "adChoices" ->
        if (assetView is AdChoicesView) {
          sdkView.adChoicesView = assetView
        } else {
          reloadAd()
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

  private fun flushPendingAssets(sdkView: IconAdView) {
    if (pendingAssets.isEmpty()) {
      return
    }
    val pending = ArrayList(pendingAssets)
    pendingAssets.clear()
    for ((assetType, assetView) in pending) {
      applyResolvedAsset(sdkView, assetType, assetView)
    }
  }

  private fun reloadAd() {
    iconAdView ?: return
    reloadJob?.cancel()
    reloadJob =
      CoroutineScope(Dispatchers.Main).launch {
        delay(100)
        if (destroyed || parent == null) {
          return@launch
        }
        val liveView = iconAdView ?: return@launch
        val ad = iconAd ?: return@launch
        if (
          liveView.headlineView == null &&
          liveView.callToActionView == null &&
          liveView.iconView == null &&
          liveView.starRatingView == null
        ) {
          return@launch
        }
        ad.let { liveView.registerIconAd(it) }
      }
  }

  private fun ensureSdkView() {
    if (iconAdView != null) {
      return
    }
    val activity = findActivity(context) ?: return
    iconAdView =
      IconAdView(activity).also {
        addView(it, 0)
        flushPendingAssets(it)
        reloadAd()
      }
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
    reloadJob?.cancel()
    iconAdView?.destroy()
    iconAdView = null
    iconAd = null
    removeAllViews()
    addView(viewGroup)
  }
}
