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

import com.facebook.react.bridge.*
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.initialization.OnInitializationCompleteListener
import com.google.android.gms.ads.RequestConfiguration
import com.google.android.gms.ads.AdInspectorError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdValue;
import com.google.android.gms.ads.OnAdInspectorClosedListener

class ReactNativeGoogleMobileAdsModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  private fun buildRequestConfiguration(
    requestConfiguration: ReadableMap
  ): RequestConfiguration {
    val builder = RequestConfiguration.Builder()

    if (requestConfiguration.hasKey("testDeviceIdentifiers")) {
      val devices = checkNotNull(requestConfiguration.getArray("testDeviceIdentifiers")).toArrayList()
      val testDeviceIds = devices.map {
        val id = it as String;
        if (id == "EMULATOR") {
          AdRequest.DEVICE_ID_EMULATOR
        } else {
          id
        }
      }

      builder.setTestDeviceIds(testDeviceIds)
    }

    if (requestConfiguration.hasKey("maxAdContentRating")) {
      val rating = requestConfiguration.getString("maxAdContentRating")

      when (rating) {
        "G" -> builder.setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G)
        "PG" -> builder.setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_PG)
        "T" -> builder.setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_T)
        "MA" -> builder.setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_MA)
      }
    }

    if (requestConfiguration.hasKey("tagForChildDirectedTreatment")) {
      val tagForChildDirectedTreatment = requestConfiguration.getBoolean("tagForChildDirectedTreatment")
      builder.setTagForChildDirectedTreatment(
        if (tagForChildDirectedTreatment) {
          RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE
        } else {
          RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_FALSE
        }
      )
    } else {
      builder.setTagForChildDirectedTreatment(RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_UNSPECIFIED)
    }

    if (requestConfiguration.hasKey("tagForUnderAgeOfConsent")) {
      val tagForUnderAgeOfConsent = requestConfiguration.getBoolean("tagForUnderAgeOfConsent")
      builder.setTagForUnderAgeOfConsent(
        if (tagForUnderAgeOfConsent) {
          RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE
        } else {
          RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_FALSE
        }
      )
    } else {
      builder.setTagForUnderAgeOfConsent(RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_UNSPECIFIED)
    }

    return builder.build()
  }

  @ReactMethod
  fun initialize(promise: Promise) {
    MobileAds.initialize(
      // in react-native, the Activity instance *may* go away, becoming null after initialize
      // it is not clear if that can happen here without an initialize necessarily following the Activity lifecycle
      // it is not clear if that will cause problems even if it happens, but users that have widely deployed this
      // with the use of currentActivity have not seen problems
      // reference if it needs attention: https://github.com/invertase/react-native-google-mobile-ads/pull/664
      reactApplicationContext.currentActivity ?: reactApplicationContext,
      OnInitializationCompleteListener { initializationStatus ->
        val result = Arguments.createArray()
        for ((key, value) in initializationStatus.adapterStatusMap) {
          val info = Arguments.createMap();
          info.putString("name", key)
          info.putInt("state", value.initializationState.ordinal)
          info.putString("description", value.description)
          result.pushMap(info);
        }
        promise.resolve(result)
      });
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
        reactApplicationContext,
        OnAdInspectorClosedListener { adInspectorError ->
          if (adInspectorError != null) {
            val code = when (adInspectorError.code) {
              AdInspectorError.ERROR_CODE_INTERNAL_ERROR -> "INTERNAL_ERROR"
              AdInspectorError.ERROR_CODE_FAILED_TO_LOAD -> "FAILED_TO_LOAD"
              AdInspectorError.ERROR_CODE_NOT_IN_TEST_MODE -> "NOT_IN_TEST_MODE"
              AdInspectorError.ERROR_CODE_ALREADY_OPEN -> "ALREADY_OPEN"
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
    MobileAds.setAppVolume(volume)
  }

  @ReactMethod
  fun setAppMuted(muted: Boolean) {
    MobileAds.setAppMuted(muted)
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsModule"
  }
}
