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
import android.content.SharedPreferences;
import android.preference.PreferenceManager;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.google.android.ump.ConsentDebugSettings;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import io.invertase.googlemobileads.common.ReactNativeModule;
import javax.annotation.Nonnull;

public class ReactNativeGoogleMobileAdsConsentModule extends ReactNativeModule {

  private static final String TAG = "RNGoogleMobileAdsConsentModule";
  private ConsentInformation consentInformation;

  public ReactNativeGoogleMobileAdsConsentModule(ReactApplicationContext reactContext) {
    super(reactContext, TAG);
    consentInformation = UserMessagingPlatform.getConsentInformation(reactContext);
  }

  private String getConsentStatusString(int consentStatus) {
    switch (consentStatus) {
      case ConsentInformation.ConsentStatus.REQUIRED:
        return "REQUIRED";
      case ConsentInformation.ConsentStatus.NOT_REQUIRED:
        return "NOT_REQUIRED";
      case ConsentInformation.ConsentStatus.OBTAINED:
        return "OBTAINED";
      case ConsentInformation.ConsentStatus.UNKNOWN:
      default:
        return "UNKNOWN";
    }
  }

  @ReactMethod
  public void requestInfoUpdate(@Nonnull final ReadableMap options, final Promise promise) {
    try {
      ConsentRequestParameters.Builder paramsBuilder = new ConsentRequestParameters.Builder();
      ConsentDebugSettings.Builder debugSettingsBuilder =
          new ConsentDebugSettings.Builder(getApplicationContext());

      if (options.hasKey("testDeviceIdentifiers")) {
        ReadableArray devices = options.getArray("testDeviceIdentifiers");

        for (int i = 0; i < devices.size(); i++) {
          debugSettingsBuilder.addTestDeviceHashedId(devices.getString(i));
        }
      }

      if (options.hasKey("debugGeography")) {
        debugSettingsBuilder.setDebugGeography(options.getInt("debugGeography"));
      }

      paramsBuilder.setConsentDebugSettings(debugSettingsBuilder.build());

      if (options.hasKey("tagForUnderAgeOfConsent")) {
        paramsBuilder.setTagForUnderAgeOfConsent(options.getBoolean("tagForUnderAgeOfConsent"));
      }

      ConsentRequestParameters consentRequestParameters = paramsBuilder.build();

      if (getCurrentActivity() == null) {
        rejectPromiseWithCodeAndMessage(
            promise,
            "null-activity",
            "Attempted to request a consent info update but the current Activity was null.");
        return;
      }

      consentInformation.requestConsentInfoUpdate(
          getCurrentActivity(),
          consentRequestParameters,
          () -> {
            WritableMap requestInfoMap = Arguments.createMap();
            requestInfoMap.putString(
                "status", getConsentStatusString(consentInformation.getConsentStatus()));
            requestInfoMap.putBoolean(
                "isConsentFormAvailable", consentInformation.isConsentFormAvailable());
            promise.resolve(requestInfoMap);
          },
          formError ->
              rejectPromiseWithCodeAndMessage(
                  promise, "consent-update-failed", formError.getMessage()));
    } catch (Exception e) {
      rejectPromiseWithCodeAndMessage(promise, "consent-update-failed", e.toString());
    }
  }

  @ReactMethod
  public void showForm(final Promise promise) {
    try {
      if (getCurrentActivity() == null) {
        rejectPromiseWithCodeAndMessage(
            promise,
            "null-activity",
            "Consent form attempted to show but the current Activity was null.");
        return;
      }
      getCurrentActivity()
          .runOnUiThread(
              () ->
                  UserMessagingPlatform.loadConsentForm(
                      getReactApplicationContext(),
                      consentForm ->
                          consentForm.show(
                              getCurrentActivity(),
                              formError -> {
                                if (formError != null) {
                                  rejectPromiseWithCodeAndMessage(
                                      promise, "consent-form-error", formError.getMessage());
                                } else {
                                  WritableMap consentFormMap = Arguments.createMap();
                                  consentFormMap.putString(
                                      "status",
                                      getConsentStatusString(
                                          consentInformation.getConsentStatus()));
                                  promise.resolve(consentFormMap);
                                }
                              }),
                      formError ->
                          rejectPromiseWithCodeAndMessage(
                              promise, "consent-form-error", formError.getMessage())));
    } catch (Exception e) {
      rejectPromiseWithCodeAndMessage(promise, "consent-form-error", e.toString());
    }
  }

  @ReactMethod
  public void reset() {
    consentInformation.reset();
  }

  @ReactMethod
  public void getTCString(Promise promise) {
    try {
      SharedPreferences prefs =
          PreferenceManager.getDefaultSharedPreferences(getReactApplicationContext());
      // https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md#in-app-details
      String tcString = prefs.getString("IABTCF_TCString", null);
      promise.resolve(tcString);
    } catch (Exception e) {
      rejectPromiseWithCodeAndMessage(promise, "consent-string-error", e.toString());
    }
  }
}
