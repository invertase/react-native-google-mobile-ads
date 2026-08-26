package com.facebook.react.viewmanagers;

import android.view.View;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.uimanager.BaseViewManager;
import com.facebook.react.uimanager.BaseViewManagerDelegate;
import com.facebook.react.uimanager.LayoutShadowNode;

public class RNGoogleMobileAdsNativeViewManagerDelegate<
        T extends View,
        U extends
            BaseViewManager<T, ? extends LayoutShadowNode>
                & RNGoogleMobileAdsNativeViewManagerInterface<T>>
    extends BaseViewManagerDelegate<T, U> {
  public RNGoogleMobileAdsNativeViewManagerDelegate(U viewManager) {
    super(viewManager);
  }

  @Override
  public void setProperty(@NonNull T view, String propName, @Nullable Object value) {
    assert propName != null;
    if (propName.equals("responseId")) {
      mViewManager.setResponseId(view, value == null ? null : (String) value);
    }
  }

  @Override
  public void receiveCommand(@NonNull T view, String commandName, ReadableArray args) {
    assert commandName != null;
    if (commandName.equals("registerAsset")) {
      mViewManager.registerAsset(view, args.getString(0), args.getInt(1));
    }
  }
}
