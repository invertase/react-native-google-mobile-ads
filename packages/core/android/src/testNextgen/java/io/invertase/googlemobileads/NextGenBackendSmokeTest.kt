package io.invertase.googlemobileads

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NextGenBackendSmokeTest {
  @Test
  fun reportsSelectedBackend() {
    assertEquals("android-next-gen", ReactNativeGoogleMobileAds.backend)
  }

  @Test
  fun packageExposesImplementedCoreModulesOnly() {
    val moduleInfos =
      ReactNativeGoogleMobileAdsPackage().getReactModuleInfoProvider().getReactModuleInfos()

    assertTrue(moduleInfos.containsKey(ReactNativeAppModule.NAME))
    assertTrue(moduleInfos.containsKey(ReactNativeGoogleMobileAdsModule.NAME))
    assertTrue(moduleInfos.containsKey(ReactNativeGoogleMobileAdsAppOpenModule.NAME))
    assertTrue(moduleInfos.containsKey(ReactNativeGoogleMobileAdsInterstitialModule.NAME))
    assertTrue(moduleInfos.containsKey(ReactNativeGoogleMobileAdsRewardedModule.NAME))
    assertTrue(moduleInfos.containsKey(ReactNativeGoogleMobileAdsRewardedInterstitialModule.NAME))
    assertTrue(moduleInfos.containsKey(ReactNativeGoogleMobileAdsNativeModule.NAME))
    assertTrue(moduleInfos.containsKey(ReactNativeGoogleMobileAdsPoolModule.NAME))
    assertTrue(moduleInfos.containsKey(ReactNativeGoogleMobileAdsConsentModule.NAME))

    assertEquals(
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      moduleInfos.getValue(ReactNativeAppModule.NAME).isTurboModule,
    )
    assertFalse(moduleInfos.getValue(ReactNativeGoogleMobileAdsModule.NAME).isTurboModule)
    assertFalse(moduleInfos.getValue(ReactNativeGoogleMobileAdsConsentModule.NAME).isTurboModule)
    assertFalse(moduleInfos.getValue(ReactNativeGoogleMobileAdsAppOpenModule.NAME).isTurboModule)
    assertFalse(moduleInfos.getValue(ReactNativeGoogleMobileAdsInterstitialModule.NAME).isTurboModule)
    assertFalse(moduleInfos.getValue(ReactNativeGoogleMobileAdsRewardedModule.NAME).isTurboModule)
    assertFalse(moduleInfos.getValue(ReactNativeGoogleMobileAdsRewardedInterstitialModule.NAME).isTurboModule)
    assertEquals(
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      moduleInfos.getValue(ReactNativeGoogleMobileAdsNativeModule.NAME).isTurboModule,
    )
    assertEquals(
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      moduleInfos.getValue(ReactNativeGoogleMobileAdsPoolModule.NAME).isTurboModule,
    )
  }
}
