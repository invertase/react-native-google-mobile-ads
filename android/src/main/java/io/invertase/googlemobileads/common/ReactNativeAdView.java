package io.invertase.googlemobileads.common;

import android.content.Context;
import android.widget.FrameLayout;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
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
  private AdRequest request;
  private List<AdSize> sizes;
  private float maxAdHeight;
  private float adWidth;
  private String unitId;
  private boolean manualImpressionsEnabled;
  private boolean propsChanged;
  private boolean isFluid;

  @Override
  public void requestLayout() {
    super.requestLayout();
    post(measureAndLayout);
  }

  /**
   * This ensures the adview is properly measured and laid out if its layout changed after being
   * loaded This happens everytime for fluid ads, but cannot happen for fixed size ads loading
   * additional content
   *
   * <p>See https://github.com/facebook/react-native/issues/17968 for more details
   */
  private final Runnable measureAndLayout =
      () -> {
        /**
         * For fluid ads, we usually don't specify the ad height from JS side, so mark it as
         * unspecified and let it dynamically determine its size
         *
         * <p>See
         * https://developers.google.com/ad-manager/mobile-ads-sdk/android/native/styles#fluid_size
         */
        int heightMeasureSpec =
            isFluid
                ? MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
                : MeasureSpec.makeMeasureSpec(getHeight(), MeasureSpec.EXACTLY);

        measure(MeasureSpec.makeMeasureSpec(getWidth(), MeasureSpec.EXACTLY), heightMeasureSpec);
        layout(getLeft(), getTop(), getRight(), getTop() + getHeight());
      };

  public ReactNativeAdView(final Context context) {
    super(context);
  }

  public void setRequest(AdRequest request) {
    this.request = request;
  }

  public AdRequest getRequest() {
    return this.request;
  }

  public void setSizes(List<AdSize> sizes) {
    this.sizes = sizes;
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
}
