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

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.RNGoogleMobileAdsMultiFormatBannerViewManagerDelegate
import com.facebook.react.viewmanagers.RNGoogleMobileAdsMultiFormatBannerViewManagerInterface

@ReactModule(name = ReactNativeGoogleMobileAdsMultiFormatBannerViewManager.NAME)
class ReactNativeGoogleMobileAdsMultiFormatBannerViewManager(
  reactContext: ReactApplicationContext,
) : ViewGroupManager<ReactNativeGoogleMobileAdsMultiFormatBannerView>(reactContext),
  RNGoogleMobileAdsMultiFormatBannerViewManagerInterface<ReactNativeGoogleMobileAdsMultiFormatBannerView> {
  private val delegate: ViewManagerDelegate<ReactNativeGoogleMobileAdsMultiFormatBannerView> =
    RNGoogleMobileAdsMultiFormatBannerViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<ReactNativeGoogleMobileAdsMultiFormatBannerView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ReactNativeGoogleMobileAdsMultiFormatBannerView =
    ReactNativeGoogleMobileAdsMultiFormatBannerView(context)

  override fun onDropViewInstance(view: ReactNativeGoogleMobileAdsMultiFormatBannerView) {
    super.onDropViewInstance(view)
    // Detach only — destroyHandle owns AdManagerAdView lifetime.
    view.detachAdView()
  }

  override fun prepareToRecycleView(
    reactContext: ThemedReactContext,
    view: ReactNativeGoogleMobileAdsMultiFormatBannerView,
  ): ReactNativeGoogleMobileAdsMultiFormatBannerView? = null

  @ReactProp(name = "handleId")
  override fun setHandleId(
    view: ReactNativeGoogleMobileAdsMultiFormatBannerView,
    handleId: String?,
  ) {
    view.setHandleId(handleId)
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsMultiFormatBannerView"
  }
}
