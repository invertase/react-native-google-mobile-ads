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
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMapKeySetIterator;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableMap;
import com.google.android.gms.ads.AdError;
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize;
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdRequest;
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest;
import com.google.android.libraries.ads.mobile.sdk.common.BaseRequestBuilder;
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError;
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError;
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAd;
import com.google.android.libraries.ads.mobile.sdk.nativead.NativeAdRequest;
import io.invertase.googlemobileads.common.ReactNativeEventEmitter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import javax.annotation.Nullable;

/**
 * Next-Gen SDK boundary for common ad error conversion.
 *
 * <p>The React Native payload remains identical across backends, while the SDK-owned {@link
 * AdError} type stays out of {@code src/main}.
 */
public final class ReactNativeGoogleMobileAdsCommon {
  private ReactNativeGoogleMobileAdsCommon() {}

  public static String reasonFromLegacyCode(@Nullable String code) {
    if (code == null || code.isEmpty()) {
      return "unknown";
    }
    if ("no-fill".equals(code) || "error-code-no-fill".equals(code)) {
      return "no-fill";
    }
    if ("mediation-no-fill".equals(code) || "error-code-mediation-no-fill".equals(code)) {
      return "mediation-no-fill";
    }
    if (code.startsWith("error-code-")) {
      return code.substring("error-code-".length());
    }
    if ("application-identifier-missing".equals(code)) {
      return "app-id-missing";
    }
    if ("received-invalid-ad-string".equals(code)) {
      return "invalid-ad-string";
    }
    if ("internal".equals(code)) {
      return "internal-error";
    }
    return code;
  }

  public static WritableMap buildAdErrorMap(String code, @Nullable String message, String phase) {
    WritableMap map = Arguments.createMap();
    map.putString("code", code);
    map.putString("message", message != null ? message : "");
    map.putString("reason", reasonFromLegacyCode(code));
    map.putString("phase", phase);
    return map;
  }

  /**
   * Converts the structured error supplied to {@code
   * InitializationCompleteCallback.onInitializationFailed(AdError)}. The deprecated String overload
   * deliberately has no equivalent here.
   */
  public static WritableMap initializationErrorToMap(AdError adError) {
    return adErrorToMap(adError, "initialize");
  }

  public static WritableMap adErrorToMap(AdError adError, String phase) {
    String[] codeAndMessage = getCodeAndMessageFromAdError(adError);
    return buildAdErrorMap(codeAndMessage[0], codeAndMessage[1], phase);
  }

  public static String[] getCodeAndMessageFromAdError(AdError adError) {
    String code;
    switch (adError.getCode()) {
      case 0:
        code = "internal-error";
        break;
      case 1:
        code = "invalid-request";
        break;
      case 2:
        code = "network-error";
        break;
      case 3:
        code = "no-fill";
        break;
      case 8:
        code = "app-id-missing";
        break;
      case 9:
        code = "mediation-no-fill";
        break;
      case 10:
        code = "invalid-ad-string";
        break;
      case 11:
        code = "request-id-mismatch";
        break;
      default:
        code = "unknown";
        break;
    }
    return new String[] {code, adError.getMessage()};
  }

  public static WritableMap loadAdErrorToMap(LoadAdError adError) {
    WritableMap map =
        buildAdErrorMap(codeFromLoadError(adError.getCode()), adError.getMessage(), "load");
    WritableMap responseInfo =
        ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(adError.getResponseInfo());
    if (responseInfo != null) {
      map.putMap("responseInfo", responseInfo);
    }
    return map;
  }

  public static WritableMap fullScreenContentErrorToMap(FullScreenContentError adError) {
    return buildAdErrorMap(
        codeFromFullScreenError(adError.getCode()), adError.getMessage(), "show");
  }

  private static String codeFromLoadError(LoadAdError.ErrorCode code) {
    switch (code) {
      case INTERNAL_ERROR:
        return "internal-error";
      case INVALID_REQUEST:
        return "invalid-request";
      case NETWORK_ERROR:
        return "network-error";
      case NO_FILL:
        return "no-fill";
      case APP_ID_MISSING:
        return "app-id-missing";
      case INVALID_AD_RESPONSE:
        return "invalid-ad-string";
      case REQUEST_ID_MISMATCH:
        return "request-id-mismatch";
      default:
        return "unknown";
    }
  }

  private static String codeFromFullScreenError(FullScreenContentError.ErrorCode code) {
    switch (code) {
      case INTERNAL_ERROR:
        return "internal-error";
      case H5_SHOW_AD_NOT_LOADED:
        return "not-ready";
      case AD_REUSED:
        return "ad-reused";
      case APP_NOT_FOREGROUND:
        return "app-not-foreground";
      case MEDIATION_SHOW_ERROR:
        return "mediation-show-error";
      default:
        return "unknown";
    }
  }

  /**
   * Builds a Next-Gen request without classifying the ad unit ID. AdMob and Google Ad Manager use
   * the same request type; GAM-only fields are accepted by the builder and ignored for AdMob.
   */
  public static AdRequest buildAdRequest(String adUnitId, ReadableMap adRequestOptions) {
    AdRequest.Builder builder = new AdRequest.Builder(adUnitId);
    Bundle extras = new Bundle();

    if (adRequestOptions.hasKey("requestNonPersonalizedAdsOnly")
        && adRequestOptions.getBoolean("requestNonPersonalizedAdsOnly")) {
      extras.putString("npa", "1");
    }

    if (adRequestOptions.hasKey("networkExtras")) {
      Map<String, Object> networkExtras =
          Objects.requireNonNull(adRequestOptions.getMap("networkExtras")).toHashMap();
      for (Map.Entry<String, Object> entry : networkExtras.entrySet()) {
        extras.putString(entry.getKey(), (String) entry.getValue());
      }
    }

    if (adRequestOptions.hasKey("publisherProvidedSignals")) {
      ReadableMap ppsMap =
          Objects.requireNonNull(adRequestOptions.getMap("publisherProvidedSignals"));
      ReadableMapKeySetIterator iterator = ppsMap.keySetIterator();
      while (iterator.hasNextKey()) {
        String key = iterator.nextKey();
        ReadableArray values = Objects.requireNonNull(ppsMap.getArray(key));
        ArrayList<Integer> intValues = new ArrayList<>();
        for (int i = 0; i < values.size(); i++) {
          intValues.add(values.getInt(i));
        }
        extras.putIntegerArrayList(key, intValues);
      }
    }
    builder.setGoogleExtrasBundle(extras);

    if (adRequestOptions.hasKey("keywords")) {
      for (Object keyword :
          Objects.requireNonNull(adRequestOptions.getArray("keywords")).toArrayList()) {
        builder.addKeyword((String) keyword);
      }
    }
    if (adRequestOptions.hasKey("contentUrl")) {
      builder.setContentUrl(Objects.requireNonNull(adRequestOptions.getString("contentUrl")));
    }
    if (adRequestOptions.hasKey("neighboringContentUrls")) {
      ReadableArray values =
          Objects.requireNonNull(adRequestOptions.getArray("neighboringContentUrls"));
      HashSet<String> urls = new HashSet<>();
      for (int i = 0; i < values.size(); i++) {
        urls.add(Objects.requireNonNull(values.getString(i)));
      }
      builder.setNeighboringContentUrls(urls);
    }
    if (adRequestOptions.hasKey("requestAgent")) {
      builder.setRequestAgent(Objects.requireNonNull(adRequestOptions.getString("requestAgent")));
    }
    if (adRequestOptions.hasKey("customTargeting")) {
      ReadableMap customTargeting =
          Objects.requireNonNull(adRequestOptions.getMap("customTargeting"));
      ReadableMapKeySetIterator iterator = customTargeting.keySetIterator();
      while (iterator.hasNextKey()) {
        String key = iterator.nextKey();
        if (customTargeting.getType(key) == ReadableType.String) {
          builder.putCustomTargeting(key, Objects.requireNonNull(customTargeting.getString(key)));
        } else {
          ReadableArray readableValues = Objects.requireNonNull(customTargeting.getArray(key));
          ArrayList<String> values = new ArrayList<>();
          for (int i = 0; i < readableValues.size(); i++) {
            values.add(Objects.requireNonNull(readableValues.getString(i)));
          }
          builder.putCustomTargeting(key, values);
        }
      }
    }
    if (adRequestOptions.hasKey("categoryExclusions")) {
      ReadableArray values =
          Objects.requireNonNull(adRequestOptions.getArray("categoryExclusions"));
      for (int i = 0; i < values.size(); i++) {
        builder.addCategoryExclusion(Objects.requireNonNull(values.getString(i)));
      }
    }
    if (adRequestOptions.hasKey("publisherProvidedId")) {
      builder.setPublisherProvidedId(
          Objects.requireNonNull(adRequestOptions.getString("publisherProvidedId")));
    }

    return builder.build();
  }

  /** Builds the banner-specific request while preserving the common v17 targeting surface. */
  public static BannerAdRequest buildBannerAdRequest(
      String adUnitId,
      java.util.List<AdSize> adSizes,
      ReadableMap adRequestOptions,
      boolean manualImpressionsEnabled) {
    // The multi-size constructor is Ad Manager-only. Standard AdMob banners must use the
    // single-size constructor or the Next-Gen request can remain unresolved.
    BannerAdRequest.Builder builder =
        adSizes.size() == 1
            ? new BannerAdRequest.Builder(adUnitId, adSizes.get(0))
            : new BannerAdRequest.Builder(adUnitId, adSizes);
    Bundle extras = new Bundle();

    if (adRequestOptions.hasKey("requestNonPersonalizedAdsOnly")
        && adRequestOptions.getBoolean("requestNonPersonalizedAdsOnly")) {
      extras.putString("npa", "1");
    }
    if (adRequestOptions.hasKey("networkExtras")) {
      Map<String, Object> networkExtras =
          Objects.requireNonNull(adRequestOptions.getMap("networkExtras")).toHashMap();
      for (Map.Entry<String, Object> entry : networkExtras.entrySet()) {
        extras.putString(entry.getKey(), (String) entry.getValue());
      }
    }
    if (adRequestOptions.hasKey("publisherProvidedSignals")) {
      ReadableMap ppsMap =
          Objects.requireNonNull(adRequestOptions.getMap("publisherProvidedSignals"));
      ReadableMapKeySetIterator iterator = ppsMap.keySetIterator();
      while (iterator.hasNextKey()) {
        String key = iterator.nextKey();
        ReadableArray values = Objects.requireNonNull(ppsMap.getArray(key));
        ArrayList<Integer> intValues = new ArrayList<>();
        for (int i = 0; i < values.size(); i++) {
          intValues.add(values.getInt(i));
        }
        extras.putIntegerArrayList(key, intValues);
      }
    }
    builder.setGoogleExtrasBundle(extras);

    if (adRequestOptions.hasKey("keywords")) {
      for (Object keyword :
          Objects.requireNonNull(adRequestOptions.getArray("keywords")).toArrayList()) {
        builder.addKeyword((String) keyword);
      }
    }
    if (adRequestOptions.hasKey("contentUrl")) {
      builder.setContentUrl(Objects.requireNonNull(adRequestOptions.getString("contentUrl")));
    }
    if (adRequestOptions.hasKey("neighboringContentUrls")) {
      ReadableArray values =
          Objects.requireNonNull(adRequestOptions.getArray("neighboringContentUrls"));
      HashSet<String> urls = new HashSet<>();
      for (int i = 0; i < values.size(); i++) {
        urls.add(Objects.requireNonNull(values.getString(i)));
      }
      builder.setNeighboringContentUrls(urls);
    }
    if (adRequestOptions.hasKey("requestAgent")) {
      builder.setRequestAgent(Objects.requireNonNull(adRequestOptions.getString("requestAgent")));
    }
    if (adRequestOptions.hasKey("customTargeting")) {
      ReadableMap customTargeting =
          Objects.requireNonNull(adRequestOptions.getMap("customTargeting"));
      ReadableMapKeySetIterator iterator = customTargeting.keySetIterator();
      while (iterator.hasNextKey()) {
        String key = iterator.nextKey();
        if (customTargeting.getType(key) == ReadableType.String) {
          builder.putCustomTargeting(key, Objects.requireNonNull(customTargeting.getString(key)));
        } else {
          ReadableArray readableValues = Objects.requireNonNull(customTargeting.getArray(key));
          ArrayList<String> values = new ArrayList<>();
          for (int i = 0; i < readableValues.size(); i++) {
            values.add(Objects.requireNonNull(readableValues.getString(i)));
          }
          builder.putCustomTargeting(key, values);
        }
      }
    }
    if (adRequestOptions.hasKey("categoryExclusions")) {
      ReadableArray values =
          Objects.requireNonNull(adRequestOptions.getArray("categoryExclusions"));
      for (int i = 0; i < values.size(); i++) {
        builder.addCategoryExclusion(Objects.requireNonNull(values.getString(i)));
      }
    }
    if (adRequestOptions.hasKey("publisherProvidedId")) {
      builder.setPublisherProvidedId(
          Objects.requireNonNull(adRequestOptions.getString("publisherProvidedId")));
    }
    builder.setManualImpressionEnabled(manualImpressionsEnabled);
    return builder.build();
  }

  public static NativeAdRequest.Builder buildNativeAdRequestBuilder(
      String adUnitId,
      java.util.List<NativeAd.NativeAdType> adTypes,
      ReadableMap adRequestOptions) {
    NativeAdRequest.Builder builder = new NativeAdRequest.Builder(adUnitId, adTypes);
    applyRequestOptions(builder, adRequestOptions);
    return builder;
  }

  private static <T extends BaseRequestBuilder<T>> void applyRequestOptions(
      T builder, ReadableMap options) {
    Bundle extras = new Bundle();
    if (options.hasKey("requestNonPersonalizedAdsOnly")
        && options.getBoolean("requestNonPersonalizedAdsOnly")) {
      extras.putString("npa", "1");
    }
    if (options.hasKey("networkExtras")) {
      for (Map.Entry<String, Object> entry :
          Objects.requireNonNull(options.getMap("networkExtras")).toHashMap().entrySet()) {
        extras.putString(entry.getKey(), (String) entry.getValue());
      }
    }
    if (options.hasKey("publisherProvidedSignals")) {
      ReadableMap values = Objects.requireNonNull(options.getMap("publisherProvidedSignals"));
      ReadableMapKeySetIterator iterator = values.keySetIterator();
      while (iterator.hasNextKey()) {
        String key = iterator.nextKey();
        ReadableArray source = Objects.requireNonNull(values.getArray(key));
        ArrayList<Integer> target = new ArrayList<>();
        for (int index = 0; index < source.size(); index++) target.add(source.getInt(index));
        extras.putIntegerArrayList(key, target);
      }
    }
    builder.setGoogleExtrasBundle(extras);
    if (options.hasKey("keywords")) {
      for (Object value : Objects.requireNonNull(options.getArray("keywords")).toArrayList()) {
        builder.addKeyword((String) value);
      }
    }
    if (options.hasKey("contentUrl")) {
      builder.setContentUrl(Objects.requireNonNull(options.getString("contentUrl")));
    }
    if (options.hasKey("neighboringContentUrls")) {
      HashSet<String> urls = new HashSet<>();
      ReadableArray values = Objects.requireNonNull(options.getArray("neighboringContentUrls"));
      for (int index = 0; index < values.size(); index++) {
        urls.add(Objects.requireNonNull(values.getString(index)));
      }
      builder.setNeighboringContentUrls(urls);
    }
    if (options.hasKey("requestAgent")) {
      builder.setRequestAgent(Objects.requireNonNull(options.getString("requestAgent")));
    }
    if (options.hasKey("customTargeting")) {
      ReadableMap values = Objects.requireNonNull(options.getMap("customTargeting"));
      ReadableMapKeySetIterator iterator = values.keySetIterator();
      while (iterator.hasNextKey()) {
        String key = iterator.nextKey();
        if (values.getType(key) == ReadableType.String) {
          builder.putCustomTargeting(key, Objects.requireNonNull(values.getString(key)));
        } else {
          ReadableArray source = Objects.requireNonNull(values.getArray(key));
          ArrayList<String> target = new ArrayList<>();
          for (int index = 0; index < source.size(); index++) {
            target.add(Objects.requireNonNull(source.getString(index)));
          }
          builder.putCustomTargeting(key, target);
        }
      }
    }
    if (options.hasKey("categoryExclusions")) {
      ReadableArray values = Objects.requireNonNull(options.getArray("categoryExclusions"));
      for (int index = 0; index < values.size(); index++) {
        builder.addCategoryExclusion(Objects.requireNonNull(values.getString(index)));
      }
    }
    if (options.hasKey("publisherProvidedId")) {
      builder.setPublisherProvidedId(
          Objects.requireNonNull(options.getString("publisherProvidedId")));
    }
  }

  public static void sendAdEvent(
      String event,
      int requestId,
      String type,
      String adUnitId,
      @Nullable WritableMap error,
      @Nullable WritableMap data) {
    WritableMap eventBody = Arguments.createMap();
    eventBody.putString("type", type);
    if (error != null) {
      eventBody.putMap("error", error);
    }
    if (data != null) {
      eventBody.putMap("data", data);
    }
    ReactNativeEventEmitter.getSharedInstance()
        .sendEvent(new ReactNativeGoogleMobileAdsEvent(event, requestId, adUnitId, eventBody));
  }
}
