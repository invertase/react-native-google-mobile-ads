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

/**
 * Presentation gates for Android [NativeMediaView] / GMA MediaView
 * ([#775](https://github.com/invertase/react-native-google-mobile-ads/issues/775)).
 *
 * Binding [com.google.android.gms.ads.MediaContent] while the MediaView still has a 0×0
 * layout (common in fullscreen pagers / recycled lists) leaves native video black until a
 * later leave+return recreates the surface. Refresh only when the view first becomes
 * presentable: non-zero size, and visible to the window.
 */
object ReactNativeGoogleMobileAdsMediaViewPresentation {
  @JvmStatic
  fun canPresent(
    width: Int,
    height: Int,
    visibility: Int,
  ): Boolean = width > 0 && height > 0 && visibility == View.VISIBLE

  /**
   * True when layout grows from a zero axis to a positive box (first real Yoga/RN layout).
   */
  @JvmStatic
  fun shouldRefreshAfterSizeChange(
    oldWidth: Int,
    oldHeight: Int,
    width: Int,
    height: Int,
  ): Boolean = width > 0 && height > 0 && (oldWidth == 0 || oldHeight == 0)

  @JvmStatic
  fun shouldRefreshAfterWindowVisibility(
    windowVisibility: Int,
    width: Int,
    height: Int,
  ): Boolean = canPresent(width, height, windowVisibility)
}
