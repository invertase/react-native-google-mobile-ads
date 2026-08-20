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

import android.content.pm.PackageManager
import com.facebook.react.bridge.*
import com.google.android.libraries.ads.mobile.sdk.MobileAds
import com.google.android.libraries.ads.mobile.sdk.common.AdInspectorError
import com.google.android.libraries.ads.mobile.sdk.common.AgeRestrictedTreatment
import com.google.android.libraries.ads.mobile.sdk.common.OnAdInspectorClosedListener
import com.google.android.libraries.ads.mobile.sdk.common.RequestConfiguration
import com.google.android.libraries.ads.mobile.sdk.initialization.AdapterStatus
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig
import com.google.android.libraries.ads.mobile.sdk.initialization.OnAdapterInitializationCompleteListener
import java.util.concurrent.Executors

/**
 * This is the GMA Next-Gen SDK (`ads-mobile-sdk`) backed implementation of this module, built
 * against `android/src/nextgen` instead of `android/src/legacy` (see build.gradle's
 * `googleMobileAdsSdk` app.json flag). It intentionally exposes the exact same JS-facing
 * contract as the legacy implementation, but GMA Next-Gen SDK differs from Google Mobile Ads SDK
 * (Legacy) in a few ways that are worked around here:
 * - it does not read the App ID from AndroidManifest.xml meta-data, so it is read here instead
 *   and passed explicitly via InitializationConfig
 * - it may start preloading ads (including via mediation partner SDKs) as soon as initialize()
 *   is called, so RequestConfiguration must be applied before initialize() is invoked; callers
 *   should call setRequestConfiguration() before initialize()
 * - it requires initialize() to be called off the main thread to avoid ANRs
 */
class ReactNativeGoogleMobileAdsModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  // Lazy so no background thread is spun up unless/until initialize() is actually called.
  private val initExecutor by lazy { Executors.newSingleThreadExecutor() }

  private fun buildRequestConfiguration(
    requestConfiguration: ReadableMap
  ): RequestConfiguration {
    val builder = RequestConfiguration.Builder()

    if (requestConfiguration.hasKey("testDeviceIdentifiers")) {
      val devices = checkNotNull(requestConfiguration.getArray("testDeviceIdentifiers")).toArrayList()
      // Unlike the legacy SDK (which maps the "EMULATOR" sentinel to AdRequest.DEVICE_ID_EMULATOR),
      // GMA Next-Gen SDK has no equivalent constant because it treats Android emulators as test
      // devices automatically - so the sentinel is simply dropped rather than forwarded as a
      // literal (and meaningless) device ID string.
      val testDeviceIds = devices.map { it as String }.filter { it != "EMULATOR" }

      builder.setTestDeviceIds(testDeviceIds)
    }

    if (requestConfiguration.hasKey("maxAdContentRating")) {
      val rating = requestConfiguration.getString("maxAdContentRating")

      when (rating) {
        "G" -> builder.setMaxAdContentRating(RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_G)
        "PG" -> builder.setMaxAdContentRating(RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_PG)
        "T" -> builder.setMaxAdContentRating(RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_T)
        "MA" -> builder.setMaxAdContentRating(RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_MA)
      }
    }

    if (requestConfiguration.hasKey("ageRestrictedTreatment")) {
      val ageRestrictedTreatment = requestConfiguration.getString("ageRestrictedTreatment")

      when (ageRestrictedTreatment) {
        "CHILD" -> builder.setAgeRestrictedTreatment(AgeRestrictedTreatment.CHILD)
        "TEEN" -> builder.setAgeRestrictedTreatment(AgeRestrictedTreatment.TEEN)
        "UNSPECIFIED" -> builder.setAgeRestrictedTreatment(AgeRestrictedTreatment.UNSPECIFIED)
      }
    }

    if (requestConfiguration.hasKey("tagForChildDirectedTreatment")) {
      val tagForChildDirectedTreatment = requestConfiguration.getBoolean("tagForChildDirectedTreatment")
      builder.setTagForChildDirectedTreatment(
        if (tagForChildDirectedTreatment) {
          RequestConfiguration.TagForChildDirectedTreatment.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE
        } else {
          RequestConfiguration.TagForChildDirectedTreatment.TAG_FOR_CHILD_DIRECTED_TREATMENT_FALSE
        }
      )
    } else {
      builder.setTagForChildDirectedTreatment(
        RequestConfiguration.TagForChildDirectedTreatment.TAG_FOR_CHILD_DIRECTED_TREATMENT_UNSPECIFIED
      )
    }

    if (requestConfiguration.hasKey("tagForUnderAgeOfConsent")) {
      val tagForUnderAgeOfConsent = requestConfiguration.getBoolean("tagForUnderAgeOfConsent")
      builder.setTagForUnderAgeOfConsent(
        if (tagForUnderAgeOfConsent) {
          RequestConfiguration.TagForUnderAgeOfConsent.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE
        } else {
          RequestConfiguration.TagForUnderAgeOfConsent.TAG_FOR_UNDER_AGE_OF_CONSENT_FALSE
        }
      )
    } else {
      builder.setTagForUnderAgeOfConsent(
        RequestConfiguration.TagForUnderAgeOfConsent.TAG_FOR_UNDER_AGE_OF_CONSENT_UNSPECIFIED
      )
    }

    return builder.build()
  }

  /**
   * GMA Next-Gen SDK does not read the App ID from AndroidManifest.xml meta-data the way the
   * legacy SDK does, so this reads the same `com.google.android.gms.ads.APPLICATION_ID`
   * meta-data entry (populated from `app.json` via the existing manifest placeholder) and passes
   * it explicitly to InitializationConfig.
   */
  private fun getApplicationIdFromManifest(): String {
    val context = reactApplicationContext
    val appInfo =
      context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
    val appId = appInfo.metaData?.getString("com.google.android.gms.ads.APPLICATION_ID")
    return checkNotNull(appId) {
      "react-native-google-mobile-ads requires an 'android_app_id' property inside a " +
        "'react-native-google-mobile-ads' key in your app.json."
    }
  }

  private fun initializationStateToLegacyOrdinal(state: AdapterStatus.InitializationState): Int {
    // Preserve the JS-facing AdapterStatus.InitializationState contract (NotReady = 0, Ready = 1)
    // which mirrors the legacy SDK's two-state model, even though GMA Next-Gen SDK exposes a
    // more granular five-state model internally.
    return if (state == AdapterStatus.InitializationState.COMPLETE) 1 else 0
  }

  @ReactMethod
  fun initialize(promise: Promise) {
    val context = reactApplicationContext
    val appId: String
    try {
      appId = getApplicationIdFromManifest()
    } catch (e: Exception) {
      promise.reject("app-id-missing", e.message, e)
      return
    }

    val config = InitializationConfig.Builder(appId).build()

    initExecutor.execute {
      MobileAds.initialize(
        context,
        config,
        OnAdapterInitializationCompleteListener { initializationStatus ->
          val result = Arguments.createArray()
          for ((key, value) in initializationStatus.adapterStatusMap) {
            val info = Arguments.createMap()
            info.putString("name", key)
            info.putInt("state", initializationStateToLegacyOrdinal(value.initializationState))
            info.putString("description", value.description)
            result.pushMap(info)
          }
          promise.resolve(result)
        }
      )
    }
  }

  @ReactMethod
  fun setRequestConfiguration(
    requestConfiguration: ReadableMap,
    promise: Promise
  ) {
    MobileAds.setRequestConfiguration(buildRequestConfiguration(requestConfiguration))
    promise.resolve(null)
  }

  @ReactMethod
  fun openAdInspector(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("null-activity", "Ad Inspector attempted to open but the current Activity was null.")
      return
    }
    activity.runOnUiThread {
      MobileAds.openAdInspector(
        OnAdInspectorClosedListener { adInspectorError ->
          if (adInspectorError != null) {
            val code = when (adInspectorError.code) {
              AdInspectorError.ErrorCode.INTERNAL_ERROR -> "INTERNAL_ERROR"
              AdInspectorError.ErrorCode.FAILED_TO_LOAD -> "FAILED_TO_LOAD"
              AdInspectorError.ErrorCode.NOT_IN_TEST_MODE -> "NOT_IN_TEST_MODE"
              AdInspectorError.ErrorCode.ALREADY_OPEN -> "ALREADY_OPEN"
              AdInspectorError.ErrorCode.DISABLED -> "DISABLED"
              else -> ""
            }
            promise.reject(code, adInspectorError.message)
          } else {
            promise.resolve(null)
          }
        }
      )
    }
  }

  @ReactMethod
  fun openDebugMenu(adUnit: String) {
    reactApplicationContext.currentActivity?.runOnUiThread {
      MobileAds.openDebugMenu(reactApplicationContext.currentActivity!!, adUnit)
    }
  }

  @ReactMethod
  fun setAppVolume(volume: Float) {
    MobileAds.setUserControlledAppVolume(volume)
  }

  @ReactMethod
  fun setAppMuted(muted: Boolean) {
    MobileAds.setUserMutedApp(muted)
  }

  override fun getConstants(): MutableMap<String, Any> {
    return hashMapOf("googleMobileAdsSdk" to "next-gen")
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsModule"
  }
}
