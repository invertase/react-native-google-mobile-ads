package io.invertase.googlemobileads;

/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.Display;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.views.view.ReactViewGroup;
import com.google.ads.mediation.admob.AdMobAdapter;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.admanager.AdManagerAdRequest;
import io.invertase.googlemobileads.common.ReactNativeEventEmitter;
import java.util.ArrayList;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.annotation.Nullable;

public class ReactNativeGoogleMobileAdsCommon {

  static AdSize getAdSizeForAdaptiveBanner(String preDefinedAdSize, ReactViewGroup reactViewGroup) {

    try {
      Display display =
          Objects.requireNonNull(((ReactContext) reactViewGroup.getContext()).getCurrentActivity())
              .getWindowManager()
              .getDefaultDisplay();

      DisplayMetrics outMetrics = new DisplayMetrics();
      display.getMetrics(outMetrics);
      int adWidth = (int) (outMetrics.widthPixels / outMetrics.density);

      if ("INLINE_ADAPTIVE_BANNER".equals(preDefinedAdSize)) {
        return AdSize.getCurrentOrientationInlineAdaptiveBannerAdSize(
            reactViewGroup.getContext(), adWidth);
      }
      return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(
          reactViewGroup.getContext(), adWidth);
    } catch (Exception e) {
      return AdSize.BANNER;
    }
  }

  static AdSize getAdSize(String preDefinedAdSize, ReactViewGroup reactViewGroup) {
    if (preDefinedAdSize.matches(
        "ADAPTIVE_BANNER|ANCHORED_ADAPTIVE_BANNER|INLINE_ADAPTIVE_BANNER")) {
      return ReactNativeGoogleMobileAdsCommon.getAdSizeForAdaptiveBanner(
          preDefinedAdSize, reactViewGroup);
    } else {
      return ReactNativeGoogleMobileAdsCommon.stringToAdSize(preDefinedAdSize);
    }
  }

  static AdSize stringToAdSize(String value) {
    Pattern pattern = Pattern.compile("([0-9]+)x([0-9]+)");
    Matcher matcher = pattern.matcher(value);

    // If size is "valXval"
    if (matcher.find()) {
      int width = Integer.parseInt(matcher.group(1));
      int height = Integer.parseInt(matcher.group(2));
      return new AdSize(width, height);
    }

    switch (value.toUpperCase()) {
      case "FLUID":
        return AdSize.FLUID;
      case "WIDE_SKYSCRAPER":
        return AdSize.WIDE_SKYSCRAPER;
      case "LARGE_BANNER":
        return AdSize.LARGE_BANNER;
      case "MEDIUM_RECTANGLE":
        return AdSize.MEDIUM_RECTANGLE;
      case "FULL_BANNER":
        return AdSize.FULL_BANNER;
      case "LEADERBOARD":
        return AdSize.LEADERBOARD;
      default:
      case "BANNER":
        return AdSize.BANNER;
    }
  }

  /** Convert common Google Mobile Ads errors into a standard format */
  static WritableMap errorCodeToMap(int errorCode) {
    WritableMap map = Arguments.createMap();

    switch (errorCode) {
      case AdRequest.ERROR_CODE_INTERNAL_ERROR:
        map.putString("code", "error-code-internal-error");
        map.putString(
            "message",
            "Something happened internally; for instance, an invalid response was received from the"
                + " ad server.");
        break;
      case AdRequest.ERROR_CODE_INVALID_REQUEST:
        map.putString("code", "error-code-invalid-request");
        map.putString(
            "message", "The ad request was invalid; for instance, the ad unit ID was incorrect.");
        break;
      case AdRequest.ERROR_CODE_NETWORK_ERROR:
        map.putString("code", "error-code-network-error");
        map.putString("message", "The ad request was unsuccessful due to network connectivity.");
        break;
      case AdRequest.ERROR_CODE_NO_FILL:
        map.putString("code", "error-code-no-fill");
        map.putString(
            "message",
            "The ad request was successful, but no ad was returned due to lack of ad inventory.");
        break;
    }

    return map;
  }

  public static AdManagerAdRequest buildAdRequest(ReadableMap adRequestOptions) {
    AdManagerAdRequest.Builder builder = new AdManagerAdRequest.Builder();
    Bundle extras = new Bundle();

    if (adRequestOptions.hasKey("requestNonPersonalizedAdsOnly")
        && adRequestOptions.getBoolean("requestNonPersonalizedAdsOnly")) {
      extras.putString("npa", "1");
    }

    if (adRequestOptions.hasKey("networkExtras")) {
      Map<String, Object> networkExtras = adRequestOptions.getMap("networkExtras").toHashMap();

      for (Map.Entry<String, Object> entry : networkExtras.entrySet()) {
        String key = entry.getKey();
        String value = (String) entry.getValue();
        extras.putString(key, value);
      }
    }

    builder.addNetworkExtrasBundle(AdMobAdapter.class, extras);

    if (adRequestOptions.hasKey("keywords")) {
      ArrayList<Object> keywords =
          Objects.requireNonNull(adRequestOptions.getArray("keywords")).toArrayList();

      for (Object keyword : keywords) {
        builder.addKeyword((String) keyword);
      }
    }

    if (adRequestOptions.hasKey("contentUrl")) {
      builder.setContentUrl(Objects.requireNonNull(adRequestOptions.getString("contentUrl")));
    }

    if (adRequestOptions.hasKey("requestAgent")) {
      builder.setRequestAgent(Objects.requireNonNull(adRequestOptions.getString("requestAgent")));
    }

    if (adRequestOptions.hasKey("customTargeting")) {
      Map<String, Object> customTargeting = adRequestOptions.getMap("customTargeting").toHashMap();

      for (Map.Entry<String, Object> entry : customTargeting.entrySet()) {
        String key = entry.getKey();
        String value = (String) entry.getValue();
        builder.addCustomTargeting(key, value);
      }
    }

    if (adRequestOptions.hasKey("publisherProvidedId")) {
      builder.setPublisherProvidedId(
          Objects.requireNonNull(adRequestOptions.getString("publisherProvidedId")));
    }

    return builder.build();
  }

  public static void sendAdEvent(
      String event, int requestId, String type, String adUnitId, @Nullable WritableMap error) {
    ReactNativeEventEmitter emitter = ReactNativeEventEmitter.getSharedInstance();

    WritableMap eventBody = Arguments.createMap();
    eventBody.putString("type", type);

    if (error != null) {
      eventBody.putMap("error", error);
    }

    emitter.sendEvent(new ReactNativeGoogleMobileAdsEvent(event, requestId, adUnitId, eventBody));
  }

  public static void sendAdEvent(
      String event,
      int requestId,
      String type,
      String adUnitId,
      @Nullable WritableMap error,
      @Nullable WritableMap data) {
    ReactNativeEventEmitter emitter = ReactNativeEventEmitter.getSharedInstance();

    WritableMap eventBody = Arguments.createMap();
    eventBody.putString("type", type);

    if (error != null) {
      eventBody.putMap("error", error);
    }

    if (data != null) {
      eventBody.putMap("data", data);
    }

    emitter.sendEvent(new ReactNativeGoogleMobileAdsEvent(event, requestId, adUnitId, eventBody));
  }

  public static String[] getCodeAndMessageFromAdError(AdError adError) {
    String code = "unknown";
    String message = adError.getMessage();

    switch (adError.getCode()) {
      case AdRequest.ERROR_CODE_APP_ID_MISSING:
        code = "app-id-missing";
        break;
      case AdRequest.ERROR_CODE_INTERNAL_ERROR:
        code = "internal-error";
        break;
      case AdRequest.ERROR_CODE_INVALID_AD_STRING:
        code = "invalid-ad-string";
        break;
      case AdRequest.ERROR_CODE_INVALID_REQUEST:
        code = "invalid-request";
        break;
      case AdRequest.ERROR_CODE_MEDIATION_NO_FILL:
        code = "mediation-no-fill";
        break;
      case AdRequest.ERROR_CODE_NETWORK_ERROR:
        code = "network-error";
        break;
      case AdRequest.ERROR_CODE_NO_FILL:
        code = "no-fill";
        break;
      case AdRequest.ERROR_CODE_REQUEST_ID_MISMATCH:
        code = "request-id-mismatch";
        break;
    }

    String[] codeAndMessage = new String[2];
    codeAndMessage[0] = code;
    codeAndMessage[1] = message;
    return codeAndMessage;
  }

  public static boolean isAdManagerUnit(String unitId) {
    if (unitId == null) return false;
    return unitId.startsWith("/");
  }
}
