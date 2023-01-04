package io.invertase.googlemobileads;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.google.android.gms.ads.MobileAds;

import io.invertase.googlemobileads.common.ReactNativeModule;

class ReactNativeGoogleMobileAdsDebugModule extends ReactNativeModule {
  public static final String SERVICE = "RNGoogleMobileAdsDebugModule";

  public ReactNativeGoogleMobileAdsDebugModule(ReactApplicationContext reactContext) {
    super(reactContext, SERVICE);
  }

  @ReactMethod
  public void openDebugMenu(final String adUnit) {
    new Handler(Looper.getMainLooper()).post(new Runnable() {
      @Override
      public void run () {
        try {
          MobileAds.initialize(getReactApplicationContext());
          MobileAds.openDebugMenu(getActivity(), adUnit);
        } catch (Exception e) {
          Log.e(this.getClass().getName(), "openDebugMenu Failed", e);
        }
      }
    });
  }
}
