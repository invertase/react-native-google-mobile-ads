package com.facebook.react.viewmanagers;

import android.view.View;
import androidx.annotation.Nullable;

public interface RNGoogleMobileAdsMediaViewManagerInterface<T extends View> {
  void setResponseId(T view, @Nullable String responseId);

  void setResizeMode(T view, @Nullable String resizeMode);
}
