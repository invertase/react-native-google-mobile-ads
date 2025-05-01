package com.facebook.react.viewmanagers;

import android.view.View;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.facebook.react.uimanager.BaseViewManager;
import com.facebook.react.uimanager.BaseViewManagerDelegate;
import com.facebook.react.uimanager.LayoutShadowNode;

public class RNGoogleMobileAdsMediaViewManagerDelegate<
        T extends View,
        U extends
            BaseViewManager<T, ? extends LayoutShadowNode>
                & RNGoogleMobileAdsMediaViewManagerInterface<T>>
    extends BaseViewManagerDelegate<T, U> {
  public RNGoogleMobileAdsMediaViewManagerDelegate(U viewManager) {
    super(viewManager);
  }

  @Override
  public void setProperty(@NonNull T view, String propName, @Nullable Object value) {
    assert propName != null;
    switch (propName) {
      case "responseId":
        mViewManager.setResponseId(view, value == null ? null : (String) value);
        break;
      case "resizeMode":
        mViewManager.setResizeMode(view, value == null ? null : (String) value);
        break;
    }
  }
}
