package io.invertase.googlemobileads.adapters.facebook;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.facebook.ads.AdSettings;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.module.annotations.ReactModule;

/**
 * Meta Audience Network privacy hooks for GAM mediation.
 *
 * <p>{@code setAdvertiserTrackingEnabled} is an iOS-only Meta API. Android
 * {@link AdSettings} (audience-network-sdk 6.22.0) exposes {@code setDataProcessingOptions}
 * instead — verified from the local AAR.
 */
@ReactModule(name = RNGoogleMobileAdsAdapterFacebookModule.NAME)
public class RNGoogleMobileAdsAdapterFacebookModule extends ReactContextBaseJavaModule {
  public static final String NAME = "RNGoogleMobileAdsAdapterFacebook";

  public RNGoogleMobileAdsAdapterFacebookModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return NAME;
  }

  /**
   * No-op on Android: Meta Audience Network Android SDK has no advertiser-tracking setter.
   * Kept so a single JS call site works on both platforms before GMA initialize.
   */
  @ReactMethod
  public void setAdvertiserTrackingEnabled(boolean enabled) {
    // Intentionally empty — see class javadoc.
  }

  @ReactMethod
  public void setDataProcessingOptions(@Nullable ReadableArray options) {
    AdSettings.setDataProcessingOptions(toStringArray(options));
  }

  @ReactMethod
  public void setDataProcessingOptionsWithLocation(
      @Nullable ReadableArray options, int country, int state) {
    AdSettings.setDataProcessingOptions(toStringArray(options), country, state);
  }

  @NonNull
  private static String[] toStringArray(@Nullable ReadableArray options) {
    if (options == null || options.size() == 0) {
      return new String[0];
    }
    String[] result = new String[options.size()];
    for (int i = 0; i < options.size(); i++) {
      String value = options.getString(i);
      result[i] = value != null ? value : "";
    }
    return result;
  }
}
