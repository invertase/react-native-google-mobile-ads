package com.facebook.react.viewmanagers;

import android.view.View;
import androidx.annotation.Nullable;

public interface RNGoogleMobileAdsNativeViewManagerInterface<T extends View> {
  void setResponseId(T view, @Nullable String responseId);

  void registerAsset(T view, String assetKey, int reactTag);
}
