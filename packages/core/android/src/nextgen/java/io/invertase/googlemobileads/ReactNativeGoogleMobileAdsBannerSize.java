package io.invertase.googlemobileads;

import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;
import android.view.ViewGroup;
import com.facebook.react.bridge.ReactContext;
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize;
import io.invertase.googlemobileads.common.ReactNativeAdView;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class ReactNativeGoogleMobileAdsBannerSize {
  private static final String TAG = "RNGoogleMobileAds";

  private ReactNativeGoogleMobileAdsBannerSize() {}

  static AdSize getAdSize(String value, ViewGroup view) {
    if (value.matches(
        "ANCHORED_ADAPTIVE_BANNER|LARGE_ANCHORED_ADAPTIVE_BANNER|INLINE_ADAPTIVE_BANNER")) {
      return adaptive(value, view);
    }
    return fromString(value);
  }

  static AdSize fromString(String value) {
    Matcher matcher = Pattern.compile("([0-9]+)x([0-9]+)").matcher(value);
    if (matcher.find()) {
      return new AdSize(Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2)));
    }
    switch (value.toUpperCase()) {
      case "FLUID":
        return AdSize.FLUID;
      case "LARGE_BANNER":
        return AdSize.LARGE_BANNER;
      case "MEDIUM_RECTANGLE":
        return AdSize.MEDIUM_RECTANGLE;
      case "FULL_BANNER":
        return AdSize.FULL_BANNER;
      case "LEADERBOARD":
        return AdSize.LEADERBOARD;
      case "WIDE_SKYSCRAPER":
        // Next-Gen has no predefined skyscraper constant, but custom sizes are supported.
        return new AdSize(160, 600);
      default:
        return AdSize.BANNER;
    }
  }

  private static AdSize adaptive(String value, ViewGroup view) {
    try {
      Display display =
          Objects.requireNonNull(((ReactContext) view.getContext()).getCurrentActivity())
              .getWindowManager()
              .getDefaultDisplay();
      DisplayMetrics metrics = new DisplayMetrics();
      display.getMetrics(metrics);
      ReactNativeAdView reactView = (ReactNativeAdView) view;
      int screenWidth = (int) (metrics.widthPixels / metrics.density);
      int width =
          reactView.getAdWidth() > 0
              ? Math.min(Math.round(reactView.getAdWidth()), screenWidth)
              : screenWidth;
      AdSize resolved;
      if ("INLINE_ADAPTIVE_BANNER".equals(value)) {
        if (reactView.getMaxAdHeight() > 0) {
          resolved =
              AdSize.getInlineAdaptiveBannerAdSize(
                  width, Math.round(Math.max(reactView.getMaxAdHeight(), 32)));
        } else {
          resolved =
              AdSize.getCurrentOrientationInlineAdaptiveBannerAdSize(view.getContext(), width);
        }
      } else if ("LARGE_ANCHORED_ADAPTIVE_BANNER".equals(value)) {
        resolved = AdSize.getLargeAnchoredAdaptiveBannerAdSize(view.getContext(), width);
      } else {
        resolved =
            AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(view.getContext(), width);
      }
      Log.d(
          TAG,
          "Resolved "
              + value
              + " to "
              + resolved.getWidth()
              + "x"
              + resolved.getHeight()
              + "dp (screenWidth="
              + screenWidth
              + "dp, requestedWidth="
              + reactView.getAdWidth()
              + "dp)");
      return resolved;
    } catch (Exception exception) {
      Log.w(TAG, "Failed to resolve " + value + "; falling back to BANNER", exception);
      return AdSize.BANNER;
    }
  }
}
