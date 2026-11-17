package io.invertase.googlemobileads

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.RNGoogleMobileAdsSwipeableInterstitialAdViewManagerDelegate
import com.facebook.react.viewmanagers.RNGoogleMobileAdsSwipeableInterstitialAdViewManagerInterface

@ReactModule(name = ReactNativeGoogleMobileAdsSwipeableInterstitialAdViewManager.NAME)
class ReactNativeGoogleMobileAdsSwipeableInterstitialAdViewManager(
  reactContext: ReactApplicationContext,
) : ViewGroupManager<ReactNativeGoogleMobileAdsSwipeableInterstitialAdView>(reactContext),
  RNGoogleMobileAdsSwipeableInterstitialAdViewManagerInterface<
    ReactNativeGoogleMobileAdsSwipeableInterstitialAdView,
  > {
  private val delegate:
    ViewManagerDelegate<ReactNativeGoogleMobileAdsSwipeableInterstitialAdView> =
    RNGoogleMobileAdsSwipeableInterstitialAdViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<ReactNativeGoogleMobileAdsSwipeableInterstitialAdView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ReactNativeGoogleMobileAdsSwipeableInterstitialAdView =
    ReactNativeGoogleMobileAdsSwipeableInterstitialAdView(context)

  override fun onDropViewInstance(view: ReactNativeGoogleMobileAdsSwipeableInterstitialAdView) {
    super.onDropViewInstance(view)
    view.destroy()
  }

  override fun prepareToRecycleView(
    reactContext: ThemedReactContext,
    view: ReactNativeGoogleMobileAdsSwipeableInterstitialAdView,
  ): ReactNativeGoogleMobileAdsSwipeableInterstitialAdView? = null

  @ReactProp(name = "requestId")
  override fun setRequestId(
    view: ReactNativeGoogleMobileAdsSwipeableInterstitialAdView,
    requestId: Int,
  ) {
    view.setRequestId(requestId)
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsSwipeableInterstitialAdView"
  }
}
