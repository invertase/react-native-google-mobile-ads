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

import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.google.android.libraries.ads.mobile.sdk.common.AgeRestrictedTreatment
import com.google.android.libraries.ads.mobile.sdk.common.RequestConfiguration
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy

/**
 * Maps JS request-configuration fields onto Next-Gen [AgeRestrictedTreatment]
 * via [ReactNativeGoogleMobileAdsModule.setRequestConfiguration].
 *
 * Asserts the [RequestConfiguration] produced by that path. Under Robolectric the
 * Next-Gen [com.google.android.libraries.ads.mobile.sdk.MobileAds] static setters
 * require a real SDK initialize, so ART is read from the module's pending config
 * (same object later applied to MobileAds when the gate opens).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactNativeGoogleMobileAdsModuleRequestConfigurationTest {
  private lateinit var module: ReactNativeGoogleMobileAdsModule

  @Before
  fun setUp() {
    NextGenMobileAdsGate.resetForTests()
    module = ReactNativeGoogleMobileAdsModule(BridgeReactContext(RuntimeEnvironment.getApplication()))
  }

  @After
  fun tearDown() {
    NextGenMobileAdsGate.resetForTests()
  }

  @Test
  fun ageRestrictedTreatment_childMapsToChild() {
    assertAgeRestrictedTreatment(
      JavaOnlyMap.of("ageRestrictedTreatment", "child"),
      AgeRestrictedTreatment.CHILD,
    )
  }

  @Test
  fun ageRestrictedTreatment_teenMapsToTeen() {
    assertAgeRestrictedTreatment(
      JavaOnlyMap.of("ageRestrictedTreatment", "teen"),
      AgeRestrictedTreatment.TEEN,
    )
  }

  @Test
  fun ageRestrictedTreatment_unspecifiedMapsToUnspecified() {
    assertAgeRestrictedTreatment(
      JavaOnlyMap.of("ageRestrictedTreatment", "unspecified"),
      AgeRestrictedTreatment.UNSPECIFIED,
    )
  }

  @Test
  fun legacyTfcdTrueMapsToChild() {
    assertAgeRestrictedTreatment(
      JavaOnlyMap.of("tagForChildDirectedTreatment", true),
      AgeRestrictedTreatment.CHILD,
    )
  }

  @Test
  fun legacyTfuaTrueMapsToTeen() {
    assertAgeRestrictedTreatment(
      JavaOnlyMap.of("tagForUnderAgeOfConsent", true),
      AgeRestrictedTreatment.TEEN,
    )
  }

  @Test
  fun legacyBothFalseMapsToUnspecified() {
    assertAgeRestrictedTreatment(
      JavaOnlyMap.of(
        "tagForChildDirectedTreatment",
        false,
        "tagForUnderAgeOfConsent",
        false,
      ),
      AgeRestrictedTreatment.UNSPECIFIED,
    )
  }

  @Test
  fun ageRestrictedTreatmentKeyWinsOverLegacyTfcdTfua() {
    assertAgeRestrictedTreatment(
      JavaOnlyMap.of(
        "ageRestrictedTreatment",
        "teen",
        "tagForChildDirectedTreatment",
        true,
        "tagForUnderAgeOfConsent",
        true,
      ),
      AgeRestrictedTreatment.TEEN,
    )
  }

  private fun assertAgeRestrictedTreatment(
    requestConfiguration: ReadableMap,
    expected: AgeRestrictedTreatment,
  ) {
    module.setRequestConfiguration(requestConfiguration, noOpPromise())
    assertEquals(1, NextGenMobileAdsGate.pendingActionCount())
    assertEquals(expected, pendingRequestConfiguration().ageRestrictedTreatment)
  }

  private fun pendingRequestConfiguration(): RequestConfiguration {
    val field =
      ReactNativeGoogleMobileAdsModule::class.java.getDeclaredField("pendingRequestConfiguration")
    field.isAccessible = true
    return checkNotNull(field.get(module) as RequestConfiguration?)
  }

  private fun noOpPromise(): Promise =
    Proxy.newProxyInstance(
      Promise::class.java.classLoader,
      arrayOf(Promise::class.java),
    ) { _, _, _ -> null } as Promise
}
