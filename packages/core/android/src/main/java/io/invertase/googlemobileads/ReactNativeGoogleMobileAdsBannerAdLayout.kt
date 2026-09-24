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

/**
 * Banner layout / reload gates for Android FLUID ads ([#801](https://github.com/invertase/react-native-google-mobile-ads/issues/801)).
 *
 * Re-delivering an identical sizeConfig previously always set `propsChanged`, which destroyed
 * and reloaded the AdView on every JS dimension update. Fluid measure/layout must also adopt
 * [android.view.View.getMeasuredHeight] after an UNSPECIFIED measure — using stale
 * [android.view.View.getHeight] leaves the view at Yoga's prior height and fights onSizeChange.
 */
object ReactNativeGoogleMobileAdsBannerAdLayout {
  /**
   * Whether a newly received sizeConfig should schedule a full ad reload.
   *
   * @param previousSizeNames null when sizeConfig has never been applied
   */
  @JvmStatic
  fun sizeConfigRequiresReload(
    previousSizeNames: List<String>?,
    previousMaxHeight: Float,
    previousWidth: Float,
    nextSizeNames: List<String>,
    nextMaxHeight: Float,
    nextWidth: Float,
  ): Boolean {
    if (previousSizeNames == null) {
      return true
    }
    if (previousSizeNames != nextSizeNames) {
      return true
    }
    if (previousMaxHeight != nextMaxHeight) {
      return true
    }
    return previousWidth != nextWidth
  }

  /** Forward onSizeChange only when the ad view's pixel size actually changed. */
  @JvmStatic
  fun shouldEmitSizeChange(
    oldWidthPx: Int,
    oldHeightPx: Int,
    newWidthPx: Int,
    newHeightPx: Int,
  ): Boolean = oldWidthPx != newWidthPx || oldHeightPx != newHeightPx

  /** Bottom edge after a fluid UNSPECIFIED measure — always use measured height, not Yoga height. */
  @JvmStatic
  fun fluidLayoutBottom(
    top: Int,
    measuredHeight: Int,
  ): Int = top + measuredHeight
}
