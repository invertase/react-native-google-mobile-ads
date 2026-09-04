package com.facebook.react.viewmanagers;

import android.view.View;
import androidx.annotation.Nullable;

public interface RNGoogleMobileAdsMultiFormatBannerViewManagerInterface<T extends View> {
  void setHandleId(T view, @Nullable String handleId);
}
