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
import android.view.KeyEvent
import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.bridge.ReactContext
import com.google.android.gms.ads.admanager.AdManagerAdView

/**
 * Attach-only host for a preloaded [AdManagerAdView] from multi-format AdLoader.
 *
 * Does not call [AdManagerAdView.loadAd]. Destroy remains [ReactNativeGoogleMobileAdsNativeModule.destroyHandle].
 */
@SuppressLint("ViewConstructor")
class ReactNativeGoogleMobileAdsMultiFormatBannerView(
  private val context: ReactContext,
) : FrameLayout(context) {
  private var handleId: String? = null
  private var attachedAdView: AdManagerAdView? = null

  init {
    // Mediation adapters can collide with RN view tags when saving instance state.
    isSaveFromParentEnabled = false
    // Keep hardware BACK for React Navigation / OnBackPressedDispatcher (#813).
    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(this)
  }

  fun setHandleId(nextHandleId: String?) {
    if (handleId == nextHandleId && attachedAdView != null) {
      return
    }
    detachAdView()
    handleId = nextHandleId
    if (nextHandleId.isNullOrEmpty()) {
      return
    }
    val nativeModule = context.getNativeModule(ReactNativeGoogleMobileAdsNativeModule::class.java)
    val adView = nativeModule?.getMultiFormatBannerAdView(nextHandleId) ?: return
    val parent = adView.parent
    if (parent is ViewGroup) {
      parent.removeView(adView)
    }
    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(adView)
    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(this)
    attachedAdView = adView
    addView(
      adView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
    requestLayout()
    refreshBannerPresentation()
  }

  /** Detach the ad view from this container without destroying inventory. */
  fun detachAdView() {
    val adView = attachedAdView ?: return
    removeView(adView)
    attachedAdView = null
  }

  /**
   * Never consume hardware BACK. Banner WebViews historically stole focus and finished the Activity
   * instead of letting nested navigators pop (#813). Parity with [common.ReactNativeAdView].
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (event.keyCode == KeyEvent.KEYCODE_BACK) {
      return false
    }
    return super.dispatchKeyEvent(event)
  }

  override fun onKeyPreIme(
    keyCode: Int,
    event: KeyEvent,
  ): Boolean {
    if (keyCode == KeyEvent.KEYCODE_BACK) {
      return false
    }
    return super.onKeyPreIme(keyCode, event)
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  /**
   * Kick the attached AdManagerAdView when this host becomes presentable so hybrid image+video
   * creatives are not stuck until leave+return (#711).
   */
  internal fun refreshBannerPresentation() {
    ReactNativeGoogleMobileAdsBannerAdPresentation.refreshIfPresentable(
      width,
      height,
      visibility,
    ) {
      attachedAdView?.let { adView ->
        adView.resume()
        adView.requestLayout()
      }
    }
  }

  override fun onSizeChanged(
    w: Int,
    h: Int,
    oldw: Int,
    oldh: Int,
  ) {
    super.onSizeChanged(w, h, oldw, oldh)
    if (ReactNativeGoogleMobileAdsBannerAdPresentation.shouldRefreshAfterSizeChange(oldw, oldh, w, h)) {
      refreshBannerPresentation()
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    refreshBannerPresentation()
  }

  override fun onWindowVisibilityChanged(visibility: Int) {
    super.onWindowVisibilityChanged(visibility)
    if (ReactNativeGoogleMobileAdsBannerAdPresentation.shouldRefreshAfterWindowVisibility(
        visibility,
        width,
        height,
      )
    ) {
      refreshBannerPresentation()
    }
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
