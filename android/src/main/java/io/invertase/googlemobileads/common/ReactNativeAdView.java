package io.invertase.googlemobileads.common;

import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.views.view.ReactViewGroup;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import java.util.List;

public class ReactNativeAdView extends ReactViewGroup {
  private AdRequest request;
  private List<AdSize> sizes;
  private String unitId;
  private boolean manualImpressionsEnabled;
  private boolean propsChanged;
  private boolean isFluid;
  private ThemedReactContext reactContext;

  public ReactNativeAdView(final ThemedReactContext context) {
    super(context.getCurrentActivity());
    setReactContext(context);
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

  public ThemedReactContext getReactContext() {
    return reactContext;
  }

  public void setReactContext(ThemedReactContext reactContext) {
    this.reactContext = reactContext;
  }
}
