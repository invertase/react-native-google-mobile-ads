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
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.RNGoogleMobileAdsNativeViewManagerDelegate
import com.facebook.react.viewmanagers.RNGoogleMobileAdsNativeViewManagerInterface

@ReactModule(name = ReactNativeGoogleMobileAdsNativeAdViewManager.NAME)
class ReactNativeGoogleMobileAdsNativeAdViewManager : ViewGroupManager<ReactNativeGoogleMobileAdsNativeAdView>(),
  RNGoogleMobileAdsNativeViewManagerInterface<ReactNativeGoogleMobileAdsNativeAdView> {
  private val delegate: ViewManagerDelegate<ReactNativeGoogleMobileAdsNativeAdView> = RNGoogleMobileAdsNativeViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<ReactNativeGoogleMobileAdsNativeAdView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ReactNativeGoogleMobileAdsNativeAdView = ReactNativeGoogleMobileAdsNativeAdView(context)

  override fun onDropViewInstance(adView: ReactNativeGoogleMobileAdsNativeAdView) {
    super.onDropViewInstance(adView)
    adView.destroy()
  }

  override fun prepareToRecycleView(
    reactContext: ThemedReactContext,
    view: ReactNativeGoogleMobileAdsNativeAdView
  ): ReactNativeGoogleMobileAdsNativeAdView? {
    return null
  }

  @ReactProp(name = "responseId")
  override fun setResponseId(view: ReactNativeGoogleMobileAdsNativeAdView, responseId: String?) {
    view.setResponseId(responseId)
  }

  @ReactMethod
  override fun registerAsset(view: ReactNativeGoogleMobileAdsNativeAdView, assetKey: String, reactTag: Int) {
    view.registerAsset(assetKey, reactTag)
  }

  override fun addView(parent: ReactNativeGoogleMobileAdsNativeAdView, child: View, index: Int) {
    parent.viewGroup.addView(child, index)
  }

  override fun getChildCount(parent: ReactNativeGoogleMobileAdsNativeAdView): Int {
    return parent.viewGroup.childCount
  }

  override fun getChildAt(parent: ReactNativeGoogleMobileAdsNativeAdView, index: Int): View? {
    return parent.viewGroup.getChildAt(index)
  }

  override fun removeViewAt(parent: ReactNativeGoogleMobileAdsNativeAdView, index: Int) {
    parent.viewGroup.removeViewAt(index)
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsNativeView"
  }
}
