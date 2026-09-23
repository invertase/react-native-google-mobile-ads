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
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.google.android.libraries.ads.mobile.sdk.MobileAds
import com.google.android.libraries.ads.mobile.sdk.common.AgeRestrictedTreatment
import com.google.android.libraries.ads.mobile.sdk.common.RequestConfiguration
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig
import io.invertase.googlemobileads.common.ReactNativeModule

class ReactNativeGoogleMobileAdsModule(
  reactContext: ReactApplicationContext,
) : ReactNativeModule(reactContext, NAME) {
  @Volatile
  private var pendingRequestConfiguration: RequestConfiguration? = null

  private val initializationLock = Any()
  private val initializationPromises = ArrayList<Promise>()
  private var initializationStarted = false
  private var initializationResult: List<AdapterInitializationResult>? = null
  private var initializationFailure: Pair<String, String>? = null

  init {
    startInitializationIfNeeded()
  }

  override fun getConstants(): Map<String, Any> =
    mapOf(
      // getVersion() throws before Next-Gen initialization; the selected dependency version is
      // generated into BuildConfig so module construction remains safe.
      "sdkVersion" to BuildConfig.GOOGLE_MOBILE_ADS_SDK_VERSION,
      "backend" to ReactNativeGoogleMobileAds.backend,
    )

  private fun buildRequestConfiguration(requestConfiguration: ReadableMap): RequestConfiguration {
    val builder = RequestConfiguration.Builder()

    if (requestConfiguration.hasKey("testDeviceIdentifiers")) {
      val devices = checkNotNull(requestConfiguration.getArray("testDeviceIdentifiers")).toArrayList()
      builder.setTestDeviceIds(
        devices.mapNotNull { id ->
          (id as String).takeUnless { it == "EMULATOR" }
        },
      )
    }

    if (requestConfiguration.hasKey("maxAdContentRating")) {
      when (requestConfiguration.getString("maxAdContentRating")) {
        "G" ->
          builder.setMaxAdContentRating(
            RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_G,
          )
        "PG" ->
          builder.setMaxAdContentRating(
            RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_PG,
          )
        "T" ->
          builder.setMaxAdContentRating(
            RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_T,
          )
        "MA" ->
          builder.setMaxAdContentRating(
            RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_MA,
          )
      }
    }

    if (requestConfiguration.hasKey("ageRestrictedTreatment")) {
      when (requestConfiguration.getString("ageRestrictedTreatment")) {
        "CHILD" -> builder.setAgeRestrictedTreatment(AgeRestrictedTreatment.CHILD)
        "TEEN" -> builder.setAgeRestrictedTreatment(AgeRestrictedTreatment.TEEN)
        "UNSPECIFIED" -> builder.setAgeRestrictedTreatment(AgeRestrictedTreatment.UNSPECIFIED)
      }
    }

    @Suppress("DEPRECATION")
    if (requestConfiguration.hasKey("tagForChildDirectedTreatment")) {
      builder.setTagForChildDirectedTreatment(
        if (requestConfiguration.getBoolean("tagForChildDirectedTreatment")) {
          RequestConfiguration.TagForChildDirectedTreatment.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE
        } else {
          RequestConfiguration.TagForChildDirectedTreatment.TAG_FOR_CHILD_DIRECTED_TREATMENT_FALSE
        },
      )
    } else {
      builder.setTagForChildDirectedTreatment(
        RequestConfiguration.TagForChildDirectedTreatment.TAG_FOR_CHILD_DIRECTED_TREATMENT_UNSPECIFIED,
      )
    }

    @Suppress("DEPRECATION")
    if (requestConfiguration.hasKey("tagForUnderAgeOfConsent")) {
      builder.setTagForUnderAgeOfConsent(
        if (requestConfiguration.getBoolean("tagForUnderAgeOfConsent")) {
          RequestConfiguration.TagForUnderAgeOfConsent.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE
        } else {
          RequestConfiguration.TagForUnderAgeOfConsent.TAG_FOR_UNDER_AGE_OF_CONSENT_FALSE
        },
      )
    } else {
      builder.setTagForUnderAgeOfConsent(
        RequestConfiguration.TagForUnderAgeOfConsent.TAG_FOR_UNDER_AGE_OF_CONSENT_UNSPECIFIED,
      )
    }

    return builder.build()
  }

  @ReactMethod
  fun initialize(promise: Promise) {
    val completed =
      synchronized(initializationLock) {
        initializationResult?.let { return@synchronized it }
        initializationFailure?.let {
          rejectInitialization(promise, it.first, it.second)
          return
        }
        initializationPromises.add(promise)
        null
      }
    if (completed != null) {
      promise.resolve(initializationResultArray(completed))
      return
    }
    startInitializationIfNeeded()
  }

  private fun startInitializationIfNeeded() {
    synchronized(initializationLock) {
      if (initializationStarted) return
      initializationStarted = true
    }
    executor.execute {
      try {
        val applicationId = getApplicationId()
        if (applicationId.isNullOrBlank()) {
          completeInitializationFailure(
            "app-id-missing",
            "The Android Google Mobile Ads app ID is missing from AndroidManifest.xml.",
          )
          return@execute
        }

        val initializationConfigBuilder = InitializationConfig.Builder(applicationId)
        pendingRequestConfiguration?.let(initializationConfigBuilder::setRequestConfiguration)

        MobileAds.initialize(
          reactApplicationContext.applicationContext,
          initializationConfigBuilder.build(),
        ) { initializationStatus ->
          NextGenMobileAdsGate.markInitialized()
          val result =
            initializationStatus.adapterStatusMap.map { (name, status) ->
              AdapterInitializationResult(
                name,
                status.initializationState.ordinal,
                status.description,
              )
            }
          completeInitializationSuccess(result)
        }
      } catch (exception: Exception) {
        completeInitializationFailure(
          "internal-error",
          exception.message ?: exception.toString(),
        )
      }
    }
  }

  private fun completeInitializationSuccess(result: List<AdapterInitializationResult>) {
    val promises =
      synchronized(initializationLock) {
        initializationResult = result
        initializationPromises.toList().also { initializationPromises.clear() }
      }
    promises.forEach { it.resolve(initializationResultArray(result)) }
  }

  private fun completeInitializationFailure(
    code: String,
    message: String,
  ) {
    NextGenMobileAdsGate.markInitializationFailed(code, message)
    val promises =
      synchronized(initializationLock) {
        initializationFailure = code to message
        initializationPromises.toList().also { initializationPromises.clear() }
      }
    promises.forEach { rejectInitialization(it, code, message) }
  }

  private fun initializationResultArray(result: List<AdapterInitializationResult>) =
    Arguments.createArray().apply {
      result.forEach {
        pushMap(
          Arguments.createMap().apply {
            putString("name", it.name)
            putInt("state", it.state)
            putString("description", it.description)
          },
        )
      }
    }

  @ReactMethod
  fun setRequestConfiguration(
    requestConfiguration: ReadableMap,
    promise: Promise,
  ) {
    val configuration = buildRequestConfiguration(requestConfiguration)
    pendingRequestConfiguration = configuration
    NextGenMobileAdsGate.runWhenInitialized {
      MobileAds.setRequestConfiguration(configuration)
    }
    promise.resolve(null)
  }

  @ReactMethod
  fun openAdInspector(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("null-activity", "Ad Inspector attempted to open but the current Activity was null.")
      return
    }
    NextGenMobileAdsGate.runWhenInitialized(
      onFailure = {
        promise.reject(it.code, it.message)
      },
    ) {
      activity.runOnUiThread {
        MobileAds.openAdInspector { adInspectorError ->
          if (adInspectorError != null) {
            promise.reject(adInspectorError.code.toString(), adInspectorError.message)
          } else {
            promise.resolve(null)
          }
        }
      }
    }
  }

  @ReactMethod
  fun openDebugMenu(adUnit: String) {
    NextGenMobileAdsGate.runWhenInitialized {
      reactApplicationContext.currentActivity?.runOnUiThread {
        MobileAds.openDebugMenu(reactApplicationContext.currentActivity!!, adUnit)
      }
    }
  }

  @ReactMethod
  fun setAppVolume(volume: Float) {
    NextGenMobileAdsGate.runWhenInitialized {
      MobileAds.setUserControlledAppVolume(volume)
    }
  }

  @ReactMethod
  fun setAppMuted(muted: Boolean) {
    NextGenMobileAdsGate.runWhenInitialized {
      MobileAds.setUserMutedApp(muted)
    }
  }

  private fun getApplicationId(): String? {
    val applicationInfo =
      reactApplicationContext.packageManager.getApplicationInfo(
        reactApplicationContext.packageName,
        PackageManager.GET_META_DATA,
      )
    return applicationInfo.metaData?.getString(APPLICATION_ID_META_DATA_KEY)
  }

  private fun rejectInitialization(
    promise: Promise,
    code: String,
    message: String,
  ) {
    val error = ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(code, message, "initialize")
    promise.reject(code, message, error)
  }

  companion object {
    const val NAME = "RNGoogleMobileAdsModule"
    private const val APPLICATION_ID_META_DATA_KEY = "com.google.android.gms.ads.APPLICATION_ID"
  }

  private data class AdapterInitializationResult(
    val name: String,
    val state: Int,
    val description: String,
  )
}
