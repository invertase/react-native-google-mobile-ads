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

import androidx.annotation.Nullable;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.google.android.gms.ads.AdInspectorError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.OnAdInspectorClosedListener;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.initialization.AdapterStatus;
import com.google.android.gms.ads.initialization.InitializationStatus;
import com.google.android.gms.ads.initialization.OnInitializationCompleteListener;
import io.invertase.googlemobileads.common.ReactNativeModule;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public class ReactNativeGoogleMobileAdsModule extends ReactNativeModule {
  private static final String SERVICE = "RNGoogleMobileAdsModule";

  ReactNativeGoogleMobileAdsModule(ReactApplicationContext reactContext) {
    super(reactContext, SERVICE);
  }

  private RequestConfiguration buildRequestConfiguration(ReadableMap requestConfiguration) {
    RequestConfiguration.Builder builder = new RequestConfiguration.Builder();

    if (requestConfiguration.hasKey("testDeviceIdentifiers")) {
      ArrayList<Object> devices =
          Objects.requireNonNull(requestConfiguration.getArray("testDeviceIdentifiers"))
              .toArrayList();

      List<String> testDeviceIds = new ArrayList<>();

      for (Object device : devices) {
        String id = (String) device;

        if (id.equals("EMULATOR")) {
          testDeviceIds.add(AdRequest.DEVICE_ID_EMULATOR);
        } else {
          testDeviceIds.add(id);
        }
      }
      builder.setTestDeviceIds(testDeviceIds);
    }

    if (requestConfiguration.hasKey("maxAdContentRating")) {
      String rating = requestConfiguration.getString("maxAdContentRating");

      switch (Objects.requireNonNull(rating)) {
        case "G":
          builder.setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G);
          break;
        case "PG":
          builder.setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_PG);
          break;
        case "T":
          builder.setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_T);
          break;
        case "MA":
          builder.setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_MA);
          break;
      }
    }

    if (requestConfiguration.hasKey("tagForChildDirectedTreatment")) {
      boolean tagForChildDirectedTreatment =
          requestConfiguration.getBoolean("tagForChildDirectedTreatment");
      if (tagForChildDirectedTreatment) {
        builder.setTagForChildDirectedTreatment(
            RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE);
      } else {
        builder.setTagForChildDirectedTreatment(
            RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_FALSE);
      }
    } else {
      builder.setTagForChildDirectedTreatment(
          RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_UNSPECIFIED);
    }

    if (requestConfiguration.hasKey("tagForUnderAgeOfConsent")) {
      boolean tagForUnderAgeOfConsent = requestConfiguration.getBoolean("tagForUnderAgeOfConsent");
      if (tagForUnderAgeOfConsent) {
        builder.setTagForUnderAgeOfConsent(RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE);
      } else {
        builder.setTagForUnderAgeOfConsent(RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_FALSE);
      }
    } else {
      builder.setTagForUnderAgeOfConsent(
          RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_UNSPECIFIED);
    }

    return builder.build();
  }

  @ReactMethod
  public void initialize(Promise promise) {
    MobileAds.initialize(
        getApplicationContext(),
        new OnInitializationCompleteListener() {
          @Override
          public void onInitializationComplete(InitializationStatus initializationStatus) {
            WritableArray result = Arguments.createArray();
            for (Map.Entry<String, AdapterStatus> entry :
                initializationStatus.getAdapterStatusMap().entrySet()) {
              WritableMap info = Arguments.createMap();
              info.putString("name", entry.getKey());
              info.putInt("state", entry.getValue().getInitializationState().ordinal());
              info.putString("description", entry.getValue().getDescription());
              result.pushMap(info);
            }
            promise.resolve(result);
          }
        });
  }

  @ReactMethod
  public void setRequestConfiguration(ReadableMap requestConfiguration, Promise promise) {
    MobileAds.setRequestConfiguration(buildRequestConfiguration(requestConfiguration));
    promise.resolve(null);
  }

  @ReactMethod
  public void openAdInspector(Promise promise) {
    if (getCurrentActivity() == null) {
      rejectPromiseWithCodeAndMessage(
          promise,
          "null-activity",
          "Ad Inspector attempted to open but the current Activity was null.");
      return;
    }
    getCurrentActivity()
        .runOnUiThread(
            () -> {
              MobileAds.openAdInspector(
                  getApplicationContext(),
                  new OnAdInspectorClosedListener() {
                    @Override
                    public void onAdInspectorClosed(@Nullable AdInspectorError adInspectorError) {
                      if (adInspectorError != null) {
                        String code = "";
                        switch (adInspectorError.getCode()) {
                          case AdInspectorError.ERROR_CODE_INTERNAL_ERROR:
                            code = "INTERNAL_ERROR";
                            break;
                          case AdInspectorError.ERROR_CODE_FAILED_TO_LOAD:
                            code = "FAILED_TO_LOAD";
                            break;
                          case AdInspectorError.ERROR_CODE_NOT_IN_TEST_MODE:
                            code = "NOT_IN_TEST_MODE";
                            break;
                          case AdInspectorError.ERROR_CODE_ALREADY_OPEN:
                            code = "ALREADY_OPEN";
                            break;
                        }
                        rejectPromiseWithCodeAndMessage(
                            promise, code, adInspectorError.getMessage());
                      } else {
                        promise.resolve(null);
                      }
                    }
                  });
            });
  }

  @ReactMethod
  public void openDebugMenu(final String adUnit) {
    if (getCurrentActivity() != null) {
      getCurrentActivity()
          .runOnUiThread(() -> MobileAds.openDebugMenu(getCurrentActivity(), adUnit));
    }
  }
}
