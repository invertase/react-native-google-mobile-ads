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
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_CLOSED;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_OPENED;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD;
import static io.invertase.googlemobileads.ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED;

import android.app.Activity;
import android.util.SparseArray;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.OnUserEarnedRewardListener;
import com.google.android.gms.ads.rewarded.RewardItem;
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback;
import io.invertase.googlemobileads.common.ReactNativeModule;

public class ReactNativeGoogleMobileAdsRewardedInterstitialModule extends ReactNativeModule {
  private static final String SERVICE = "RNGoogleMobileAdsRewardedInterstitialModule";
  private static SparseArray<RewardedInterstitialAd> rewardedInterstitialAdArray =
      new SparseArray<>();

  public ReactNativeGoogleMobileAdsRewardedInterstitialModule(
      ReactApplicationContext reactContext) {
    super(reactContext, SERVICE);
  }

  private void sendRewardedInterstitialEvent(
      String type,
      int requestId,
      String adUnitId,
      @Nullable WritableMap error,
      @Nullable WritableMap data) {
    sendAdEvent(
        ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_INTERSTITIAL,
        requestId,
        type,
        adUnitId,
        error,
        data);
  }

  @ReactMethod
  public void rewardedInterstitialLoad(
      int requestId, String adUnitId, ReadableMap adRequestOptions) {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      WritableMap error = Arguments.createMap();
      error.putString("code", "null-activity");
      error.putString(
          "message",
          "Rewarded Interstitial ad attempted to load but the current Activity was null.");
      sendRewardedInterstitialEvent(
          GOOGLE_MOBILE_ADS_EVENT_ERROR, requestId, adUnitId, error, null);
      return;
    }
    activity.runOnUiThread(
        () -> {
          RewardedInterstitialAdLoadCallback rewardedAdLoadCallback =
              new RewardedInterstitialAdLoadCallback() {
                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                  WritableMap error = Arguments.createMap();
                  String[] codeAndMessage = getCodeAndMessageFromAdError(loadAdError);
                  error.putString("code", codeAndMessage[0]);
                  error.putString("message", codeAndMessage[1]);
                  sendRewardedInterstitialEvent(
                      GOOGLE_MOBILE_ADS_EVENT_ERROR, requestId, adUnitId, error, null);
                }

                @Override
                public void onAdLoaded(@NonNull RewardedInterstitialAd rewardedInterstitialAd) {
                  RewardItem rewardItem = rewardedInterstitialAd.getRewardItem();
                  WritableMap data = Arguments.createMap();
                  data.putString("type", rewardItem.getType());
                  data.putInt("amount", rewardItem.getAmount());

                  if (adRequestOptions.hasKey("serverSideVerificationOptions")) {
                    ReadableMap serverSideVerificationOptions =
                        adRequestOptions.getMap("serverSideVerificationOptions");

                    if (serverSideVerificationOptions != null) {
                      ServerSideVerificationOptions.Builder options =
                          new ServerSideVerificationOptions.Builder();

                      if (serverSideVerificationOptions.hasKey("userId")) {
                        options.setUserId(serverSideVerificationOptions.getString("userId"));
                      }

                      if (serverSideVerificationOptions.hasKey("customData")) {
                        options.setCustomData(
                            serverSideVerificationOptions.getString("customData"));
                      }

                      rewardedInterstitialAd.setServerSideVerificationOptions(options.build());
                    }
                  }

                  FullScreenContentCallback fullScreenContentCallback =
                      new FullScreenContentCallback() {
                        @Override
                        public void onAdShowedFullScreenContent() {
                          sendRewardedInterstitialEvent(
                              GOOGLE_MOBILE_ADS_EVENT_OPENED, requestId, adUnitId, null, null);
                        }

                        @Override
                        public void onAdDismissedFullScreenContent() {
                          sendRewardedInterstitialEvent(
                              GOOGLE_MOBILE_ADS_EVENT_CLOSED, requestId, adUnitId, null, null);
                        }
                      };

                  rewardedInterstitialAd.setFullScreenContentCallback(fullScreenContentCallback);

                  rewardedInterstitialAdArray.put(requestId, rewardedInterstitialAd);
                  sendRewardedInterstitialEvent(
                      GOOGLE_MOBILE_ADS_EVENT_REWARDED_LOADED, requestId, adUnitId, null, data);
                }
              };

          RewardedInterstitialAd.load(
              activity, adUnitId, buildAdRequest(adRequestOptions), rewardedAdLoadCallback);
        });
  }

  @ReactMethod
  public void rewardedInterstitialShow(
      int requestId, String adUnitId, ReadableMap showOptions, Promise promise) {
    if (getCurrentActivity() == null) {
      rejectPromiseWithCodeAndMessage(
          promise,
          "null-activity",
          "Rewarded Interstitial ad attempted to show but the current Activity was null.");
      return;
    }
    getCurrentActivity()
        .runOnUiThread(
            () -> {
              RewardedInterstitialAd rewardedInterstitialAd =
                  rewardedInterstitialAdArray.get(requestId);

              boolean immersiveModeEnabled = false;
              if (showOptions.hasKey("immersiveModeEnabled")) {
                immersiveModeEnabled = showOptions.getBoolean("immersiveModeEnabled");
              }
              rewardedInterstitialAd.setImmersiveMode(immersiveModeEnabled);

              OnUserEarnedRewardListener onUserEarnedRewardListener =
                  new OnUserEarnedRewardListener() {
                    @Override
                    public void onUserEarnedReward(@NonNull RewardItem rewardItem) {
                      WritableMap data = Arguments.createMap();
                      data.putString("type", rewardItem.getType());
                      data.putInt("amount", rewardItem.getAmount());
                      sendRewardedInterstitialEvent(
                          GOOGLE_MOBILE_ADS_EVENT_REWARDED_EARNED_REWARD,
                          requestId,
                          adUnitId,
                          null,
                          data);
                    }
                  };

              rewardedInterstitialAd.show(getCurrentActivity(), onUserEarnedRewardListener);
              promise.resolve(null);
            });
  }
}
