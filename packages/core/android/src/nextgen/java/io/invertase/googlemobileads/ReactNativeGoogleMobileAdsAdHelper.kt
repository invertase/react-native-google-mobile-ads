package io.invertase.googlemobileads

import android.app.Activity
import com.google.android.libraries.ads.mobile.sdk.appopen.AppOpenAd
import com.google.android.libraries.ads.mobile.sdk.common.Ad
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAd
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardItem
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAd
import com.google.android.libraries.ads.mobile.sdk.rewarded.ServerSideVerificationOptions
import com.google.android.libraries.ads.mobile.sdk.rewardedinterstitial.RewardedInterstitialAd

/** Small type-safe facade over the Next-Gen fullscreen ad variants. */
class ReactNativeGoogleMobileAdsAdHelper<T : Ad>(
  private val ad: T,
) {
  val responseInfo: ResponseInfo
    get() = ad.getResponseInfo()

  fun show(
    activity: Activity,
    onReward: ((RewardItem) -> Unit)? = null,
  ) {
    when (ad) {
      is AppOpenAd -> ad.show(activity)
      is InterstitialAd -> ad.show(activity)
      is RewardedAd -> ad.show(activity) { onReward?.invoke(it) }
      is RewardedInterstitialAd -> ad.show(activity) { onReward?.invoke(it) }
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

  fun setServerSideVerificationOptions(options: ServerSideVerificationOptions) {
    when (ad) {
      is RewardedAd -> ad.setServerSideVerificationOptions(options)
      is RewardedInterstitialAd -> ad.setServerSideVerificationOptions(options)
    }
  }

  val rewardItem: RewardItem
    get() =
      when (ad) {
        is RewardedAd -> ad.getRewardItem()
        is RewardedInterstitialAd -> ad.getRewardItem()
        else -> throw IllegalStateException("Ad type not rewarded")
      }

  fun destroy() = ad.destroy()
}
