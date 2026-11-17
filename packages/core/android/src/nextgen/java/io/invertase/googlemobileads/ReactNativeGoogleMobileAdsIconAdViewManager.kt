package io.invertase.googlemobileads

import android.view.View
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.RNGoogleMobileAdsIconAdViewManagerDelegate
import com.facebook.react.viewmanagers.RNGoogleMobileAdsIconAdViewManagerInterface

@ReactModule(name = ReactNativeGoogleMobileAdsIconAdViewManager.NAME)
class ReactNativeGoogleMobileAdsIconAdViewManager(
  reactContext: ReactApplicationContext,
) : ViewGroupManager<ReactNativeGoogleMobileAdsIconAdView>(reactContext),
  RNGoogleMobileAdsIconAdViewManagerInterface<ReactNativeGoogleMobileAdsIconAdView> {
  private val delegate: ViewManagerDelegate<ReactNativeGoogleMobileAdsIconAdView> =
    RNGoogleMobileAdsIconAdViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<ReactNativeGoogleMobileAdsIconAdView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ReactNativeGoogleMobileAdsIconAdView =
    ReactNativeGoogleMobileAdsIconAdView(context)

  override fun onDropViewInstance(adView: ReactNativeGoogleMobileAdsIconAdView) {
    super.onDropViewInstance(adView)
    adView.destroy()
  }

  override fun prepareToRecycleView(
    reactContext: ThemedReactContext,
    view: ReactNativeGoogleMobileAdsIconAdView,
  ): ReactNativeGoogleMobileAdsIconAdView? = null

  @ReactProp(name = "requestId")
  override fun setRequestId(
    view: ReactNativeGoogleMobileAdsIconAdView,
    requestId: Int,
  ) {
    view.setRequestId(requestId)
  }

  @ReactMethod
  override fun registerAsset(
    view: ReactNativeGoogleMobileAdsIconAdView,
    assetKey: String,
    reactTag: Int,
  ) {
    view.registerAsset(assetKey, reactTag)
  }

  override fun addView(
    parent: ReactNativeGoogleMobileAdsIconAdView,
    child: View,
    index: Int,
  ) {
    parent.viewGroup.addView(child, index)
  }

  override fun getChildCount(parent: ReactNativeGoogleMobileAdsIconAdView): Int = parent.viewGroup.childCount

  override fun getChildAt(
    parent: ReactNativeGoogleMobileAdsIconAdView,
    index: Int,
  ): View? = parent.viewGroup.getChildAt(index)

  override fun removeViewAt(
    parent: ReactNativeGoogleMobileAdsIconAdView,
    index: Int,
  ) {
    parent.viewGroup.removeViewAt(index)
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsIconAdView"
  }
}
