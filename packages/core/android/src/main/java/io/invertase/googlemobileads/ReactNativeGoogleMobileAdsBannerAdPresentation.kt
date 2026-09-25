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
 * Presentation kicks for Android banner AdView wrappers
 * ([#711](https://github.com/invertase/react-native-google-mobile-ads/issues/711)).
 *
 * Hybrid image+video banner creatives render inside the GMA WebView. Tip historically
 * measured/laid out on load but never forwarded a resume / window-visible kick, so the
 * video half stayed frozen until Activity leave+return recreated the surface. That is a
 * distinct lifecycle from NativeMediaView 0×0 `mediaContent` rebind
 * ([#775](https://github.com/invertase/react-native-google-mobile-ads/issues/775)).
 *
 * Size/visibility gates match [ReactNativeGoogleMobileAdsMediaViewPresentation].
 */
object ReactNativeGoogleMobileAdsBannerAdPresentation {
  @JvmStatic
  fun canPresent(
    width: Int,
    height: Int,
    visibility: Int,
  ): Boolean = ReactNativeGoogleMobileAdsMediaViewPresentation.canPresent(width, height, visibility)

  @JvmStatic
  fun shouldRefreshAfterSizeChange(
    oldWidth: Int,
    oldHeight: Int,
    width: Int,
    height: Int,
  ): Boolean =
    ReactNativeGoogleMobileAdsMediaViewPresentation.shouldRefreshAfterSizeChange(
      oldWidth,
      oldHeight,
      width,
      height,
    )

  @JvmStatic
  fun shouldRefreshAfterWindowVisibility(
    windowVisibility: Int,
    width: Int,
    height: Int,
  ): Boolean =
    ReactNativeGoogleMobileAdsMediaViewPresentation.shouldRefreshAfterWindowVisibility(
      windowVisibility,
      width,
      height,
    )

  /**
   * True when the wrapper is presentable and [refresh] should run (load / attach / size /
   * window-VISIBLE). Callers supply the backend-specific kick (classic [BaseAdView.resume];
   * Next-Gen best-effort requestLayout/invalidate — no pause/resume API).
   */
  @JvmStatic
  fun refreshIfPresentable(
    width: Int,
    height: Int,
    visibility: Int,
    refresh: Runnable,
  ) {
    if (canPresent(width, height, visibility)) {
      refresh.run()
    }
  }
}
