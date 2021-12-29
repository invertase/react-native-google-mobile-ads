package io.invertase.googleads;

import static io.invertase.googleads.ReactNativeGoogleAdsCommon.getCodeAndMessageFromAdError;
import static io.invertase.googleads.ReactNativeGoogleAdsCommon.sendAdEvent;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_CLOSED;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_ERROR;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_OPENED;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_REWARDED_EARNED_REWARD;
import static io.invertase.googleads.ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_REWARDED_LOADED;

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
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.OnUserEarnedRewardListener;
import com.google.android.gms.ads.rewarded.RewardItem;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions;
import io.invertase.googleads.common.ReactNativeModule;

public class ReactNativeGoogleAdsRewardedModule extends ReactNativeModule {
  private static final String SERVICE = "RNGoogleAdsRewardedModule";
  private static SparseArray<RewardedAd> rewardedAdArray = new SparseArray<>();

  public ReactNativeGoogleAdsRewardedModule(ReactApplicationContext reactContext) {
    super(reactContext, SERVICE);
  }

  private void sendRewardedEvent(
      String type,
      int requestId,
      String adUnitId,
      @Nullable WritableMap error,
      @Nullable WritableMap data) {
    sendAdEvent(
        ReactNativeGoogleAdsEvent.GOOGLE_ADS_EVENT_REWARDED,
        requestId,
        type,
        adUnitId,
        error,
        data);
  }

  @ReactMethod
  public void rewardedLoad(int requestId, String adUnitId, ReadableMap adRequestOptions) {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      WritableMap error = Arguments.createMap();
      error.putString("code", "null-activity");
      error.putString(
          "message", "Rewarded ad attempted to load but the current Activity was null.");
      sendRewardedEvent(GOOGLE_ADS_EVENT_ERROR, requestId, adUnitId, error, null);
      return;
    }
    activity.runOnUiThread(
        () -> {
          AdRequest adRequest = new AdRequest.Builder().build();

          RewardedAdLoadCallback rewardedAdLoadCallback =
              new RewardedAdLoadCallback() {
                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                  WritableMap error = Arguments.createMap();
                  String[] codeAndMessage = getCodeAndMessageFromAdError(loadAdError);
                  error.putString("code", codeAndMessage[0]);
                  error.putString("message", codeAndMessage[1]);
                  sendRewardedEvent(GOOGLE_ADS_EVENT_ERROR, requestId, adUnitId, error, null);
                }

                @Override
                public void onAdLoaded(@NonNull RewardedAd rewardedAd) {
                  RewardItem rewardItem = rewardedAd.getRewardItem();
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

                      rewardedAd.setServerSideVerificationOptions(options.build());
                    }
                  }

                  FullScreenContentCallback fullScreenContentCallback =
                      new FullScreenContentCallback() {
                        @Override
                        public void onAdShowedFullScreenContent() {
                          sendRewardedEvent(
                              GOOGLE_ADS_EVENT_OPENED, requestId, adUnitId, null, null);
                        }

                        @Override
                        public void onAdDismissedFullScreenContent() {
                          sendRewardedEvent(
                              GOOGLE_ADS_EVENT_CLOSED, requestId, adUnitId, null, null);
                        }
                      };

                  rewardedAd.setFullScreenContentCallback(fullScreenContentCallback);

                  rewardedAdArray.put(requestId, rewardedAd);
                  sendRewardedEvent(
                      GOOGLE_ADS_EVENT_REWARDED_LOADED, requestId, adUnitId, null, data);
                }
              };

          RewardedAd.load(activity, adUnitId, adRequest, rewardedAdLoadCallback);
        });
  }

  @ReactMethod
  public void rewardedShow(
      int requestId, String adUnitId, ReadableMap showOptions, Promise promise) {
    if (getCurrentActivity() == null) {
      rejectPromiseWithCodeAndMessage(
          promise,
          "null-activity",
          "Rewarded ad attempted to show but the current Activity was null.");
      return;
    }
    getCurrentActivity()
        .runOnUiThread(
            () -> {
              RewardedAd rewardedAd = rewardedAdArray.get(requestId);

              boolean immersiveModeEnabled = false;
              if (showOptions.hasKey("immersiveModeEnabled")) {
                immersiveModeEnabled = showOptions.getBoolean("immersiveModeEnabled");
              }
              rewardedAd.setImmersiveMode(immersiveModeEnabled);

              OnUserEarnedRewardListener onUserEarnedRewardListener =
                  new OnUserEarnedRewardListener() {
                    @Override
                    public void onUserEarnedReward(@NonNull RewardItem rewardItem) {
                      WritableMap data = Arguments.createMap();
                      data.putString("type", rewardItem.getType());
                      data.putInt("amount", rewardItem.getAmount());
                      sendRewardedEvent(
                          GOOGLE_ADS_EVENT_REWARDED_EARNED_REWARD, requestId, adUnitId, null, data);
                    }
                  };

              rewardedAd.show(getCurrentActivity(), onUserEarnedRewardListener);
              promise.resolve(null);
            });
  }
}
