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

import static io.invertase.googleads.ReactNativeGoogleAdsCommon.getCodeAndMessageFromAdError;
import static io.invertase.googleads.ReactNativeGoogleAdsCommon.sendAdEvent;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_CLICKED;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_CLOSED;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_ERROR;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_INTERSTITIAL;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_LOADED;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_OPENED;

import android.app.Activity;
import android.util.SparseArray;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import io.invertase.googleads.common.ReactNativeModule;
import javax.annotation.Nullable;

public class ReactNativeGoogleAdsInterstitialModule extends ReactNativeModule {
  private static final String SERVICE = "RNGoogleAdsInterstitialModule";
  private static SparseArray<InterstitialAd> interstitialAdArray = new SparseArray<>();

  public ReactNativeGoogleAdsInterstitialModule(ReactApplicationContext reactContext) {
    super(reactContext, SERVICE);
  }

  private void sendInterstitialEvent(
      String type, int requestId, String adUnitId, @Nullable WritableMap error) {
    sendAdEvent(GOOGLE_ADS_EVENT_INTERSTITIAL, requestId, type, adUnitId, error);
  }

  @ReactMethod
  public void interstitialLoad(int requestId, String adUnitId, ReadableMap adRequestOptions) {
    Activity currentActivity = getCurrentActivity();
    if (currentActivity == null) {
      WritableMap error = Arguments.createMap();
      error.putString("code", "null-activity");
      error.putString(
          "message", "Interstitial ad attempted to load but the current Activity was null.");
      sendInterstitialEvent(GOOGLE_ADS_EVENT_ERROR, requestId, adUnitId, error);
      return;
    }
    currentActivity.runOnUiThread(
        () -> {
          AdRequest.Builder adRequestBuilder = new AdRequest.Builder();
          AdRequest adRequest = adRequestBuilder.build();

          InterstitialAdLoadCallback interstitialAdLoadCallback =
              new InterstitialAdLoadCallback() {

                @Override
                public void onAdLoaded(@NonNull InterstitialAd interstitialAd) {

                  interstitialAd.setFullScreenContentCallback(
                      new FullScreenContentCallback() {
                        @Override
                        public void onAdDismissedFullScreenContent() {
                          sendInterstitialEvent(GOOGLE_ADS_EVENT_CLOSED, requestId, adUnitId, null);
                          interstitialAdArray.put(requestId, null);
                        }

                        @Override
                        public void onAdClicked() {
                          sendInterstitialEvent(
                              GOOGLE_ADS_EVENT_CLICKED, requestId, adUnitId, null);
                        }

                        @Override
                        public void onAdShowedFullScreenContent() {
                          sendInterstitialEvent(GOOGLE_ADS_EVENT_OPENED, requestId, adUnitId, null);
                        }
                      });

                  interstitialAdArray.put(requestId, interstitialAd);
                  sendInterstitialEvent(GOOGLE_ADS_EVENT_LOADED, requestId, adUnitId, null);
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                  WritableMap error = Arguments.createMap();
                  String[] codeAndMessage = getCodeAndMessageFromAdError(loadAdError);
                  error.putString("code", codeAndMessage[0]);
                  error.putString("message", codeAndMessage[1]);
                  sendInterstitialEvent(GOOGLE_ADS_EVENT_ERROR, requestId, adUnitId, error);
                }
              };

          InterstitialAd.load(currentActivity, adUnitId, adRequest, interstitialAdLoadCallback);
        });
  }

  @ReactMethod
  public void interstitialShow(int requestId, ReadableMap showOptions, Promise promise) {
    if (getCurrentActivity() == null) {
      rejectPromiseWithCodeAndMessage(
          promise,
          "null-activity",
          "Interstitial ad attempted to show but the current Activity was null.");
      return;
    }
    getCurrentActivity()
        .runOnUiThread(
            () -> {
              InterstitialAd interstitialAd = interstitialAdArray.get(requestId);
              if (interstitialAd == null) {
                rejectPromiseWithCodeAndMessage(
                    promise,
                    "null-interstitialAd",
                    "Interstitial ad attempted to show but its object was null.");
                return;
              }

              if (showOptions.hasKey("immersiveModeEnabled")) {
                interstitialAd.setImmersiveMode(showOptions.getBoolean("immersiveModeEnabled"));
              } else {
                interstitialAd.setImmersiveMode(false);
              }

              String a = String.valueOf(requestId);

              if (interstitialAd != null) {
                interstitialAd.show(getCurrentActivity());
                promise.resolve(null);
              } else {
                rejectPromiseWithCodeAndMessage(
                    promise, "not-ready", "Interstitial ad attempted to show but was not ready.");
              }
            });
  }
}
