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

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

@SuppressWarnings("unused")
class ReactNativeGoogleMobileAdsPackage : TurboReactPackage() {
  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> {
    return listOf(
      ReactNativeGoogleMobileAdsBannerAdViewManager(),
      ReactNativeGoogleMobileAdsNativeAdViewManager(),
      ReactNativeGoogleMobileAdsMediaViewManager()
    )
  }

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    when (name) {
      ReactNativeAppModule.NAME -> return ReactNativeAppModule(reactContext)
      ReactNativeGoogleMobileAdsModule.NAME -> return ReactNativeGoogleMobileAdsModule(reactContext)
      ReactNativeGoogleMobileAdsConsentModule.NAME -> return ReactNativeGoogleMobileAdsConsentModule(reactContext)
      ReactNativeGoogleMobileAdsAppOpenModule.NAME -> return ReactNativeGoogleMobileAdsAppOpenModule(reactContext)
      ReactNativeGoogleMobileAdsInterstitialModule.NAME -> return ReactNativeGoogleMobileAdsInterstitialModule(reactContext)
      ReactNativeGoogleMobileAdsRewardedModule.NAME -> return ReactNativeGoogleMobileAdsRewardedModule(reactContext)
      ReactNativeGoogleMobileAdsRewardedInterstitialModule.NAME -> return ReactNativeGoogleMobileAdsRewardedInterstitialModule(reactContext)
      ReactNativeGoogleMobileAdsNativeModule.NAME -> return ReactNativeGoogleMobileAdsNativeModule(reactContext)
    }
    return null
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      val isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      moduleInfos[ReactNativeAppModule.NAME] =
        ReactModuleInfo(
          ReactNativeAppModule.NAME,
          ReactNativeAppModule.NAME,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          false,  // isTurboModule
        )
      moduleInfos[ReactNativeGoogleMobileAdsModule.NAME] =
        ReactModuleInfo(
          ReactNativeGoogleMobileAdsModule.NAME,
          ReactNativeGoogleMobileAdsModule.NAME,
          false,
          false,
          false,
          false,
        )
      moduleInfos[ReactNativeGoogleMobileAdsConsentModule.NAME] =
        ReactModuleInfo(
          ReactNativeGoogleMobileAdsConsentModule.NAME,
          ReactNativeGoogleMobileAdsConsentModule.NAME,
          false,
          false,
          false,
          false,
        )
      moduleInfos[ReactNativeGoogleMobileAdsAppOpenModule.NAME] =
        ReactModuleInfo(
          ReactNativeGoogleMobileAdsAppOpenModule.NAME,
          ReactNativeGoogleMobileAdsAppOpenModule.NAME,
          false,
          false,
          false,
          false,
        )
      moduleInfos[ReactNativeGoogleMobileAdsInterstitialModule.NAME] =
      ReactModuleInfo(
        ReactNativeGoogleMobileAdsInterstitialModule.NAME,
        ReactNativeGoogleMobileAdsInterstitialModule.NAME,
        false,
        false,
        false,
        false,
      )
      moduleInfos[ReactNativeGoogleMobileAdsRewardedModule.NAME] =
        ReactModuleInfo(
          ReactNativeGoogleMobileAdsRewardedModule.NAME,
          ReactNativeGoogleMobileAdsRewardedModule.NAME,
          false,
          false,
          false,
          false,
        )
      moduleInfos[ReactNativeGoogleMobileAdsRewardedInterstitialModule.NAME] =
        ReactModuleInfo(
          ReactNativeGoogleMobileAdsRewardedInterstitialModule.NAME,
          ReactNativeGoogleMobileAdsRewardedInterstitialModule.NAME,
          false,
          false,
          false,
          false,
        )
      moduleInfos[ReactNativeGoogleMobileAdsNativeModule.NAME] =
        ReactModuleInfo(
          ReactNativeGoogleMobileAdsNativeModule.NAME,
          ReactNativeGoogleMobileAdsNativeModule.NAME,
          false,
          false,
          false,
          isTurboModule,
        )
      moduleInfos
    }
}
