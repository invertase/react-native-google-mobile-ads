package io.invertase.googlemobileads.common;

import android.content.Context;
import android.widget.FrameLayout;
import com.facebook.react.bridge.ReadableMap;
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize;
import io.invertase.googlemobileads.ReactNativeGoogleMobileAdsBannerAdLayout;
import java.util.List;

/**
 * Using FrameLayout instead of ReactViewGroup
 *
 * <p>This is because in the case of fluid ads, - JS side will usually not specify the ad height -
 * Also, after loading the fluid ad, we need to measure the ad height and update the layout Which
 * isn't possible with ReactViewGroup since it overrides requestLayout by a noop
 *
 * <p>See https://github.com/facebook/react-native/issues/17968 for more details
 */
public class ReactNativeAdView extends FrameLayout {
  private ReadableMap requestOptions;
  private List<String> sizeNames;
  private List<AdSize> sizes;
  private float maxAdHeight;
  private float adWidth;
  private String unitId;
  private boolean manualImpressionsEnabled;
  private boolean propsChanged;
  private boolean isFluid;
  private boolean isCollapsible;

  @Override
  public void requestLayout() {
    super.requestLayout();
    post(measureAndLayout);
  }

  /**
   * This ensures the adview is properly measured and laid out if its layout changed after being
   * loaded. Required for FLUID ads and for collapsible banners whose height changes after load
   * (#594). Fixed-size ads stay on the Yoga EXACTLY path.
   *
   * <p>See https://github.com/facebook/react-native/issues/17968 for more details
   */
  private final Runnable measureAndLayout =
      () -> {
        /**
         * For fluid / collapsible ads, mark height as unspecified and let the AdView determine its
         * size, then layout to {@link #getMeasuredHeight()} — not stale Yoga {@link #getHeight()} —
         * otherwise dynamic ads fight onSizeChange (#801 / #594).
         *
         * <p>See
         * https://developers.google.com/ad-manager/mobile-ads-sdk/android/native/styles#fluid_size
         */
        boolean dynamicHeight =
            ReactNativeGoogleMobileAdsBannerAdLayout.usesDynamicHeight(isFluid, isCollapsible);
        int heightMeasureSpec =
            dynamicHeight
                ? MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
                : MeasureSpec.makeMeasureSpec(getHeight(), MeasureSpec.EXACTLY);

        measure(MeasureSpec.makeMeasureSpec(getWidth(), MeasureSpec.EXACTLY), heightMeasureSpec);
        int bottom =
            dynamicHeight
                ? ReactNativeGoogleMobileAdsBannerAdLayout.fluidLayoutBottom(
                    getTop(), getMeasuredHeight())
                : getTop() + getHeight();
        layout(getLeft(), getTop(), getRight(), bottom);
      };

  public ReactNativeAdView(final Context context) {
    super(context);
    // Exclude the ad view hierarchy from instance state saving/restoring. Mediation
    // adapters (e.g. Facebook Audience Network) save view state under small view ids
    // that collide with React Native view tags, causing a crash
    // ("Wrong state class, expecting View State but received
    // com.facebook.ads.internal.util.parcelable.WrappedParcelable") when a fragment
    // (e.g. react-native-screens) restores its view hierarchy state.
    setSaveFromParentEnabled(false);
  }

  public void setRequestOptions(ReadableMap requestOptions) {
    this.requestOptions = requestOptions;
  }

  public ReadableMap getRequestOptions() {
    return this.requestOptions;
  }

  public void setSizes(List<AdSize> sizes) {
    this.sizes = sizes;
  }

  public void setSizeNames(List<String> sizeNames) {
    this.sizeNames = sizeNames;
  }

  public List<String> getSizeNames() {
    return this.sizeNames;
  }

  public List<AdSize> getSizes() {
    return this.sizes;
  }

  public void setMaxAdHeight(float maxAdHeight) {
    this.maxAdHeight = maxAdHeight;
  }

  public float getMaxAdHeight() {
    return this.maxAdHeight;
  }

  public void setAdWidth(float adWidth) {
    this.adWidth = adWidth;
  }

  public float getAdWidth() {
    return this.adWidth;
  }

  public void setUnitId(String unitId) {
    this.unitId = unitId;
  }

  public String getUnitId() {
    return this.unitId;
  }

  public void setManualImpressionsEnabled(boolean manualImpressionsEnabled) {
    this.manualImpressionsEnabled = manualImpressionsEnabled;
  }

  public boolean getManualImpressionsEnabled() {
    return this.manualImpressionsEnabled;
  }

  public void setPropsChanged(boolean propsChanged) {
    this.propsChanged = propsChanged;
  }

  public boolean getPropsChanged() {
    return this.propsChanged;
  }

  public void setIsFluid(boolean isFluid) {
    this.isFluid = isFluid;
  }

  public boolean getIsFluid() {
    return this.isFluid;
  }

  public void setIsCollapsible(boolean isCollapsible) {
    this.isCollapsible = isCollapsible;
  }

  public boolean getIsCollapsible() {
    return this.isCollapsible;
  }
}
