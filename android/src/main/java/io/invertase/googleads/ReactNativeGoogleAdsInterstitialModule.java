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

import static io.invertase.googleads.ReactNativeGoogleAdsCommon.buildAdRequest;
import static io.invertase.googleads.ReactNativeGoogleAdsCommon.getCodeAndMessageFromAdErrorCode;
import static io.invertase.googleads.ReactNativeGoogleAdsCommon.sendAdEvent;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_CLICKED;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_CLOSED;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_ERROR;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_LEFT_APPLICATION;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_LOADED;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_OPENED;

import android.app.Activity;
import android.util.SparseArray;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.InterstitialAd;
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
    sendAdEvent(ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_INTERSTITIAL, requestId, type, adUnitId, error);
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
          InterstitialAd interstitialAd = new InterstitialAd(currentActivity);
          interstitialAd.setAdUnitId(adUnitId);

          // Apply AdRequest builder
          interstitialAd.loadAd(buildAdRequest(adRequestOptions));

          interstitialAd.setAdListener(
              new AdListener() {
                @Override
                public void onAdLoaded() {
                  sendInterstitialEvent(GOOGLE_ADS_EVENT_LOADED, requestId, adUnitId, null);
                }

                @Override
                public void onAdFailedToLoad(int errorCode) {
                  WritableMap error = Arguments.createMap();
                  String[] codeAndMessage = getCodeAndMessageFromAdErrorCode(errorCode);
                  error.putString("code", codeAndMessage[0]);
                  error.putString("message", codeAndMessage[1]);
                  sendInterstitialEvent(GOOGLE_ADS_EVENT_ERROR, requestId, adUnitId, error);
                }

                @Override
                public void onAdOpened() {
                  sendInterstitialEvent(GOOGLE_ADS_EVENT_OPENED, requestId, adUnitId, null);
                }

                @Override
                public void onAdClicked() {
                  sendInterstitialEvent(GOOGLE_ADS_EVENT_CLICKED, requestId, adUnitId, null);
                }

                @Override
                public void onAdLeftApplication() {
                  sendInterstitialEvent(GOOGLE_ADS_EVENT_LEFT_APPLICATION, requestId, adUnitId, null);
                }

                @Override
                public void onAdClosed() {
                  sendInterstitialEvent(GOOGLE_ADS_EVENT_CLOSED, requestId, adUnitId, null);
                }
              });

          interstitialAdArray.put(requestId, interstitialAd);
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

              if (interstitialAd.isLoaded()) {
                interstitialAd.show();
                promise.resolve(null);
              } else {
                rejectPromiseWithCodeAndMessage(
                    promise, "not-ready", "Interstitial ad attempted to show but was not ready.");
              }
            });
  }
}
