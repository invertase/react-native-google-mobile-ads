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
import com.google.android.gms.ads.AdLoadCallback
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.OnUserEarnedRewardListener
import com.google.android.gms.ads.admanager.AdManagerAdRequest
import com.google.android.gms.ads.admanager.AdManagerInterstitialAd
import com.google.android.gms.ads.admanager.AppEventListener
import com.google.android.gms.ads.appopen.AppOpenAd
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardItem
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback

class ReactNativeGoogleMobileAdsAdHelper<T>(private val ad: T) {
  fun show(activity: Activity, onUserEarnedRewardListener: OnUserEarnedRewardListener?) {
    when (ad) {
      is AppOpenAd, is InterstitialAd -> {
        val method = ad.javaClass.getMethod("show", Activity::class.java)
        method.invoke(ad, activity)
      }
      is RewardedAd, is RewardedInterstitialAd -> {
        val method = ad.javaClass.getMethod(
          "show",
          Activity::class.java,
          OnUserEarnedRewardListener::class.java
        )
        method.invoke(ad, activity, onUserEarnedRewardListener)
      }
    }
  }

  fun setFullScreenContentCallback(fullScreenContentCallback: FullScreenContentCallback) {
    when (ad) {
      is AppOpenAd, is InterstitialAd, is RewardedAd, is RewardedInterstitialAd -> {
        val method = ad.javaClass.getMethod(
          "setFullScreenContentCallback",
          FullScreenContentCallback::class.java
        )
        method.invoke(ad, fullScreenContentCallback)
      }
    }
  }

  fun setAppEventListener(appEventListener: AppEventListener) {
    if (ad is AdManagerInterstitialAd) {
      val method = ad.javaClass.getMethod("setAppEventListener", AppEventListener::class.java)
      method.invoke(ad, appEventListener)
    }
  }

  fun setImmersiveMode(enabled: Boolean) {
    when (ad) {
      is AppOpenAd, is InterstitialAd, is RewardedAd, is RewardedInterstitialAd -> {
        val method = ad.javaClass.getMethod("setImmersiveMode", Boolean::class.javaPrimitiveType)
        method.invoke(ad, enabled)
      }
    }
  }

  fun setServerSideVerificationOptions(serverSideVerificationOptions: ServerSideVerificationOptions) {
    when (ad) {
      is RewardedAd, is RewardedInterstitialAd -> {
        val method = ad.javaClass.getMethod(
          "setServerSideVerificationOptions",
          ServerSideVerificationOptions::class.java
        )
        method.invoke(ad, serverSideVerificationOptions)
      }
    }
  }

  val rewardItem: RewardItem
    get() {
      when (ad) {
        is RewardedAd, is RewardedInterstitialAd -> {
          val method = ad.javaClass.getMethod("getRewardItem")
          return method.invoke(ad) as RewardItem
        }
      }
      throw IllegalStateException("Ad type not supported")
    }
}
