package io.invertase.googleads;

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

import android.location.Location;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.Display;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.views.view.ReactViewGroup;
import com.google.ads.mediation.admob.AdMobAdapter;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import io.invertase.googleads.common.ReactNativeEventEmitter;
import java.util.ArrayList;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.annotation.Nullable;

public class ReactNativeGoogleAdsCommon {

  static AdSize getAdSizeForAdaptiveBanner(ReactViewGroup reactViewGroup) {

    try {
      Display display =
          Objects.requireNonNull(((ReactContext) reactViewGroup.getContext()).getCurrentActivity())
              .getWindowManager()
              .getDefaultDisplay();

      DisplayMetrics outMetrics = new DisplayMetrics();
      display.getMetrics(outMetrics);
      int adWidth = (int) (outMetrics.widthPixels / outMetrics.density);

      return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(
          reactViewGroup.getContext(), adWidth);
    } catch (Exception e) {
      return AdSize.BANNER;
    }
  }

  static AdSize getAdSize(String preDefinedAdSize, ReactViewGroup reactViewGroup) {
    if ("ADAPTIVE_BANNER".equals(preDefinedAdSize)) {
      return ReactNativeGoogleAdsCommon.getAdSizeForAdaptiveBanner(reactViewGroup);
    } else {
      return ReactNativeGoogleAdsCommon.stringToAdSize(preDefinedAdSize);
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

  public static AdRequest buildAdRequest(ReadableMap adRequestOptions) {
    AdRequest.Builder builder = new AdRequest.Builder();
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

    if (adRequestOptions.hasKey("location")) {
      ReadableArray locationArray = adRequestOptions.getArray("location");
      Location location = new Location("");
      location.setLatitude(Objects.requireNonNull(locationArray).getDouble(0));
      location.setLongitude(Objects.requireNonNull(locationArray).getDouble(1));

      builder.setLocation(location);
    }

    if (adRequestOptions.hasKey("requestAgent")) {
      builder.setRequestAgent(Objects.requireNonNull(adRequestOptions.getString("requestAgent")));
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

    emitter.sendEvent(new ReactNativeGoogleAdsEvent(event, requestId, adUnitId, eventBody));
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

    emitter.sendEvent(new ReactNativeGoogleAdsEvent(event, requestId, adUnitId, eventBody));
  }

  public static String[] getCodeAndMessageFromAdErrorCode(int errorCode) {
    String code = "unknown";
    String message = "An unknown error occurred.";

    switch (errorCode) {
      case AdRequest.ERROR_CODE_APP_ID_MISSING:
        code = "app-id-missing";
        message = "The ad request was not made due to a missing app ID.";
        break;
      case AdRequest.ERROR_CODE_INTERNAL_ERROR:
        code = "internal-error";
        message =
            "Something happened internally; for instance, an invalid response was received from the"
                + " ad server.";
        break;
      case AdRequest.ERROR_CODE_INVALID_AD_STRING:
        code = "invalid-ad-string";
        message = "The ad string is invalid.";
        break;
      case AdRequest.ERROR_CODE_INVALID_REQUEST:
        code = "invalid-request";
        message = "The ad request was invalid; for instance, the ad unit ID was incorrect.";
        break;
      case AdRequest.ERROR_CODE_MEDIATION_NO_FILL:
        code = "mediation-no-fill";
        message = "The mediation adapter did not fill the ad request.";
        break;
      case AdRequest.ERROR_CODE_NETWORK_ERROR:
        code = "network-error";
        message = "The ad request was unsuccessful due to network connectivity.";
        break;
      case AdRequest.ERROR_CODE_NO_FILL:
        code = "no-fill";
        message =
            "The ad request was successful, but no ad was returned due to lack of ad inventory.";
        break;
      case AdRequest.ERROR_CODE_REQUEST_ID_MISMATCH:
        code = "request-id-mismatch";
        message =
            "The AdInfo object inside the ad request has mismatching request IDs or the request ID"
                + " in the ad string is not found.";
        break;
    }

    String[] codeAndMessage = new String[2];
    codeAndMessage[0] = code;
    codeAndMessage[1] = message;
    return codeAndMessage;
  }
}
