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

import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsCommon.buildAdRequest;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsCommon.getCodeAndMessageFromAdError;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsCommon.sendAdEvent;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_APP_OPEN;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLICKED;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLOSED;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_LOADED;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_OPENED;

import android.app.Activity;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.appopen.AppOpenAd;
import io.invertase.googlemobileads.common.ReactNativeModule;
import javax.annotation.Nullable;

public class ReactNativeGoogleMobileAdsAppOpenModule extends ReactNativeModule {
  private static final String SERVICE = "RNGoogleMobileAdsAppOpenModule";
  private AppOpenAd appOpenAd = null;

  public ReactNativeGoogleMobileAdsAppOpenModule(ReactApplicationContext reactContext) {
    super(reactContext, SERVICE);
  }

  private void sendAppOpenEvent(
      String type, int requestId, String adUnitId, @Nullable WritableMap error) {
    sendAdEvent(GOOGLE_MOBILE_ADS_EVENT_APP_OPEN, requestId, type, adUnitId, error);
  }

  @ReactMethod
  public void appOpenLoad(int requestId, String adUnitId, ReadableMap adRequestOptions) {
    Activity currentActivity = getCurrentActivity();
    if (currentActivity == null) {
      WritableMap error = Arguments.createMap();
      error.putString("code", "null-activity");
      error.putString(
          "message", "App Open ad attempted to load but the current Activity was null.");
      sendAppOpenEvent(GOOGLE_MOBILE_ADS_EVENT_ERROR, requestId, adUnitId, error);
      return;
    }
    currentActivity.runOnUiThread(
        () -> {
          AppOpenAd.AppOpenAdLoadCallback appOpenAdLoadCallback =
              new AppOpenAd.AppOpenAdLoadCallback() {

                @Override
                public void onAdLoaded(@NonNull AppOpenAd appOpenAd) {

                  appOpenAd.setFullScreenContentCallback(
                      new FullScreenContentCallback() {
                        @Override
                        public void onAdDismissedFullScreenContent() {
                          sendAppOpenEvent(
                              GOOGLE_MOBILE_ADS_EVENT_CLOSED, requestId, adUnitId, null);
                          ReactNativeGoogleMobileAdsAppOpenModule.this.appOpenAd = null;
                        }

                        @Override
                        public void onAdClicked() {
                          sendAppOpenEvent(
                              GOOGLE_MOBILE_ADS_EVENT_CLICKED, requestId, adUnitId, null);
                        }

                        @Override
                        public void onAdShowedFullScreenContent() {
                          sendAppOpenEvent(
                              GOOGLE_MOBILE_ADS_EVENT_OPENED, requestId, adUnitId, null);
                        }
                      });

                  ReactNativeGoogleMobileAdsAppOpenModule.this.appOpenAd = appOpenAd;
                  sendAppOpenEvent(GOOGLE_MOBILE_ADS_EVENT_LOADED, requestId, adUnitId, null);
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                  WritableMap error = Arguments.createMap();
                  String[] codeAndMessage = getCodeAndMessageFromAdError(loadAdError);
                  error.putString("code", codeAndMessage[0]);
                  error.putString("message", codeAndMessage[1]);
                  sendAppOpenEvent(GOOGLE_MOBILE_ADS_EVENT_ERROR, requestId, adUnitId, error);
                }
              };

          AppOpenAd.load(
              currentActivity,
              adUnitId,
              buildAdRequest(adRequestOptions),
              AppOpenAd.APP_OPEN_AD_ORIENTATION_PORTRAIT,
              appOpenAdLoadCallback);
        });
  }

  @ReactMethod
  public void appOpenShow(
      int requestId, String adUnitId, ReadableMap showOptions, Promise promise) {
    if (getCurrentActivity() == null) {
      rejectPromiseWithCodeAndMessage(
          promise,
          "null-activity",
          "App Open ad attempted to show but the current Activity was null.");
      return;
    }
    getCurrentActivity()
        .runOnUiThread(
            () -> {
              if (appOpenAd == null) {
                rejectPromiseWithCodeAndMessage(
                    promise,
                    "null-appOpenAd",
                    "App Open ad attempted to show but its object was null.");
                return;
              }

              if (showOptions.hasKey("immersiveModeEnabled")) {
                appOpenAd.setImmersiveMode(showOptions.getBoolean("immersiveModeEnabled"));
              } else {
                appOpenAd.setImmersiveMode(false);
              }

              String a = String.valueOf(requestId);

              if (appOpenAd != null) {
                appOpenAd.show(getCurrentActivity());
                promise.resolve(null);
              } else {
                rejectPromiseWithCodeAndMessage(
                    promise, "not-ready", "App Open ad attempted to show but was not ready.");
              }
            });
  }
}
