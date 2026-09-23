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

import com.google.android.gms.ads.AdError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertThrows
import org.junit.Test

class ReactNativeGoogleMobileAdsCommonTest {
  @Test
  fun getCodeAndMessageFromAdError_mapsOwnedCodes() {
    assertMapped(0, "internal-error")
    assertMapped(1, "invalid-request")
    assertMapped(2, "network-error")
    assertMapped(3, "no-fill")
    assertMapped(8, "app-id-missing")
    assertMapped(9, "mediation-no-fill")
    assertMapped(10, "invalid-ad-string")
    assertMapped(11, "request-id-mismatch")
    assertMapped(999, "unknown")
  }

  @Test
  fun initializationErrorMapper_acceptsStructuredAdErrorOnly() {
    assertNotNull(
      ReactNativeGoogleMobileAdsCommon::class.java.getMethod(
        "initializationErrorToMap",
        AdError::class.java,
      ),
    )
    assertThrows(NoSuchMethodException::class.java) {
      ReactNativeGoogleMobileAdsCommon::class.java.getMethod(
        "initializationErrorToMap",
        String::class.java,
      )
    }
  }

  private fun assertMapped(
    errorCode: Int,
    expectedCode: String,
  ) {
    val error = AdError(errorCode, "detail-$errorCode", "test-domain")
    val mapped = ReactNativeGoogleMobileAdsCommon.getCodeAndMessageFromAdError(error)
    assertEquals(expectedCode, mapped[0])
    assertEquals("detail-$errorCode", mapped[1])
  }
}
