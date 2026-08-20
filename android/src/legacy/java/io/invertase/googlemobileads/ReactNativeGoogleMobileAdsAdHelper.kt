package io.invertase.googlemobileads

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

import android.app.Activity
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.OnUserEarnedRewardListener
import com.google.android.gms.ads.admanager.AdManagerInterstitialAd
import com.google.android.gms.ads.admanager.AppEventListener
import com.google.android.gms.ads.appopen.AppOpenAd
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.rewarded.RewardItem
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd

class ReactNativeGoogleMobileAdsAdHelper<T>(private val ad: T) {
  fun show(activity: Activity, onUserEarnedRewardListener: OnUserEarnedRewardListener?) {
    when (ad) {
      is AppOpenAd -> ad.show(activity)
      is InterstitialAd -> ad.show(activity)
      is RewardedAd -> onUserEarnedRewardListener?.let { ad.show(activity, it) }
      is RewardedInterstitialAd -> onUserEarnedRewardListener?.let { ad.show(activity, it) }
    }
  }

  fun setFullScreenContentCallback(fullScreenContentCallback: FullScreenContentCallback) {
    when (ad) {
      is AppOpenAd -> ad.fullScreenContentCallback = fullScreenContentCallback
      is InterstitialAd -> ad.fullScreenContentCallback = fullScreenContentCallback
      is RewardedAd -> ad.fullScreenContentCallback = fullScreenContentCallback
      is RewardedInterstitialAd -> ad.fullScreenContentCallback = fullScreenContentCallback
    }
  }

  fun setAppEventListener(appEventListener: AppEventListener) {
    if (ad is AdManagerInterstitialAd) {
      ad.appEventListener = appEventListener
    }
  }

  fun setImmersiveMode(enabled: Boolean) {
    when (ad) {
      is AppOpenAd -> ad.setImmersiveMode(enabled)
      is InterstitialAd -> ad.setImmersiveMode(enabled)
      is RewardedAd -> ad.setImmersiveMode(enabled)
      is RewardedInterstitialAd -> ad.setImmersiveMode(enabled)
    }
  }

  fun setServerSideVerificationOptions(serverSideVerificationOptions: ServerSideVerificationOptions) {
    when (ad) {
      is RewardedAd -> ad.setServerSideVerificationOptions(serverSideVerificationOptions)
      is RewardedInterstitialAd -> ad.setServerSideVerificationOptions(serverSideVerificationOptions)
    }
  }

  val rewardItem: RewardItem
    get() {
      when (ad) {
        is RewardedAd -> return ad.rewardItem
        is RewardedInterstitialAd -> return ad.rewardItem
      }
      throw IllegalStateException("Ad type not supported")
    }
}
