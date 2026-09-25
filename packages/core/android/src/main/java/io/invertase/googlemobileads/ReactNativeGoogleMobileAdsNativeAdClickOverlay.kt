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

import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import kotlin.math.max

/**
 * Android counterpart to iOS [RNGoogleMobileAdsNativeAssetInteraction]: keep GMA's NativeAdView
 * click/AdChoices overlay hittable under React Native Fabric nesting (#893).
 *
 * GMA [NativeAdView] / Next-Gen [BaseAdAssetViewContainer] insert a MATCH_PARENT overlay
 * FrameLayout and re-bring it to front on [ViewGroup.addView] / [ViewGroup.bringChildToFront].
 * React content (and elevation from shadows/zIndex) can still outrank that overlay for hit
 * testing, which matches device reports where AdChoices and all asset clicks are dead while
 * impressions still record.
 */
object ReactNativeGoogleMobileAdsNativeAdClickOverlay {
  /**
   * Ensures the SDK overlay FrameLayout remains the topmost, highest-elevation child so
   * AdChoices and overlay-driven click handling stay hittable above [reactContent].
   */
  @JvmStatic
  fun ensureSdkOverlayOnTop(
    nativeAdView: ViewGroup,
    reactContent: View,
  ) {
    if (reactContent.parent !== nativeAdView) {
      return
    }
    // NativeAdView overrides bringChildToFront to keep its overlay on top of [reactContent].
    nativeAdView.bringChildToFront(reactContent)
    val overlay = findSdkOverlay(nativeAdView, reactContent) ?: return
    val needed = max(reactContent.elevation, reactContent.translationZ) + 1f
    // Always assign: RN layout can raise content elevation after a prior ensure pass.
    overlay.elevation = needed
  }

  /**
   * Mirrors iOS `userInteractionEnabled = NO` on registered NativeAsset views: stop the RN
   * view from consuming the gesture so the SDK/NativeAdView owns the click.
   */
  @JvmStatic
  fun prepareAssetViewForSdkOwnedClicks(assetView: View) {
    assetView.isClickable = false
    assetView.isFocusable = false
  }

  @JvmStatic
  fun findSdkOverlay(
    nativeAdView: ViewGroup,
    reactContent: View,
  ): FrameLayout? {
    for (i in 0 until nativeAdView.childCount) {
      val child = nativeAdView.getChildAt(i)
      if (child is FrameLayout && child !== reactContent) {
        return child
      }
    }
    return null
  }
}
