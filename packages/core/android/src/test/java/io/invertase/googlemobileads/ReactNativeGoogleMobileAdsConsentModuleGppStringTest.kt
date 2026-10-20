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

import android.content.SharedPreferences
import android.preference.PreferenceManager
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.Promise
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy

/**
 * Neutral (classic+nextgen) coverage for [ReactNativeGoogleMobileAdsConsentModule.getGppString]:
 * the IAB GPP in-app spec stores `IABGPP_HDR_GppString` in the app's default SharedPreferences.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsConsentModuleGppStringTest {
  private lateinit var module: ReactNativeGoogleMobileAdsConsentModule
  private lateinit var defaultPreferences: SharedPreferences

  @Before
  fun setUp() {
    val application = RuntimeEnvironment.getApplication()
    module = ReactNativeGoogleMobileAdsConsentModule(BridgeReactContext(application))
    @Suppress("DEPRECATION") // The GPP spec names android.preference.PreferenceManager's default store.
    defaultPreferences = PreferenceManager.getDefaultSharedPreferences(application)
  }

  @After
  fun tearDown() {
    defaultPreferences.edit().clear().commit()
  }

  @Test
  fun getGppString_resolvesStoredGppString() {
    defaultPreferences.edit().putString("IABGPP_HDR_GppString", GPP_STRING).commit()

    assertEquals(GPP_STRING, resolvedValueOf { module.getGppString(it) })
  }

  @Test
  fun getGppString_resolvesNullWhenNoGppStringIsStored() {
    assertNull(resolvedValueOf { module.getGppString(it) })
  }

  private fun resolvedValueOf(call: (Promise) -> Unit): Any? {
    var resolved: Any? = null
    var settled = false
    val promise =
      Proxy.newProxyInstance(
        Promise::class.java.classLoader,
        arrayOf(Promise::class.java),
      ) { _, method, args ->
        if (method.name == "resolve") {
          resolved = args?.firstOrNull()
          settled = true
        } else if (method.name.startsWith("reject")) {
          throw AssertionError("promise rejected: ${args?.joinToString()}")
        }
        null
      } as Promise
    call(promise)
    assertTrue("promise settled synchronously", settled)
    return resolved
  }

  private companion object {
    const val GPP_STRING = "DBABMA~CPXxRfAPXxRfAAfKABENB-CgAAAAAAAAAAYgAAAAAAAA"
  }
}
