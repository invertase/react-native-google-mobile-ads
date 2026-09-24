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
import android.view.KeyEvent
import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.bridge.ReactContext
import com.google.android.libraries.ads.mobile.sdk.banner.AdView

/**
 * Attach-only host for a preloaded [AdView] from a multi-format native request.
 *
 * Does not call [AdView.loadAd]. Destroy remains [ReactNativeGoogleMobileAdsNativeModule.destroyHandle].
 */
@SuppressLint("ViewConstructor")
class ReactNativeGoogleMobileAdsMultiFormatBannerView(
  private val context: ReactContext,
) : FrameLayout(context) {
  private var handleId: String? = null
  private var attachedAdView: AdView? = null
  private var destroyed = false

  init {
    // Mediation adapters can collide with RN view tags when saving instance state.
    isSaveFromParentEnabled = false
    // Keep hardware BACK for React Navigation / OnBackPressedDispatcher (#813).
    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(this)
  }

  fun setHandleId(nextHandleId: String?) {
    check(Looper.myLooper() == Looper.getMainLooper()) { "Banner views must mutate on the main thread" }
    if (handleId == nextHandleId && attachedAdView != null) {
      return
    }
    detachAdView()
    handleId = nextHandleId
    if (nextHandleId.isNullOrEmpty()) {
      return
    }
    NextGenMobileAdsGate.runWhenInitialized {
      post {
        if (!destroyed) {
          attachCurrentHandle()
        }
      }
    }
  }

  private fun attachCurrentHandle() {
    val nextHandleId = handleId
    if (nextHandleId.isNullOrEmpty() || attachedAdView != null) {
      return
    }
    val nativeModule = context.getNativeModule(ReactNativeGoogleMobileAdsNativeModule::class.java)
    val adView = nativeModule?.getMultiFormatBannerAdView(nextHandleId) ?: return
    val parent = adView.parent
    if (parent is ViewGroup) {
      parent.removeView(adView)
    }
    attachedAdView = adView
    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(adView)
    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(this)
    addView(
      adView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
    requestLayout()
    refreshBannerPresentation()
  }

  /** Detach the ad view from this container without destroying inventory. */
  fun detachAdView() {
    check(Looper.myLooper() == Looper.getMainLooper()) { "Banner views must mutate on the main thread" }
    val adView = attachedAdView ?: return
    removeView(adView)
    attachedAdView = null
  }

  fun destroyHost() {
    destroyed = true
    detachAdView()
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
   * Best-effort surface kick when this host becomes presentable (#711). Next-Gen AdView has no
   * pause/resume — layout/invalidate only; not equivalent to classic leave+return / resume.
   */
  internal fun refreshBannerPresentation() {
    ReactNativeGoogleMobileAdsBannerAdPresentation.refreshIfPresentable(
      width,
      height,
      visibility,
    ) {
      attachedAdView?.let { adView ->
        adView.requestLayout()
        adView.invalidate()
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
