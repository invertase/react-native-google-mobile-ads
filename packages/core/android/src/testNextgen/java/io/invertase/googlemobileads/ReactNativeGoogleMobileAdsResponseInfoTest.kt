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

import android.os.Bundle
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.PrecisionType
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Owned ResponseInfo helper coverage (no Google auction/fill asserts).
 * Avoids React Native Arguments bridge init in unit tests.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsResponseInfoTest {
  @Test
  fun emptyToNull_normalizesBlank() {
    assertNull(ReactNativeGoogleMobileAdsResponseInfo.emptyToNull(null))
    assertNull(ReactNativeGoogleMobileAdsResponseInfo.emptyToNull(""))
    assertNull(ReactNativeGoogleMobileAdsResponseInfo.emptyToNull("   "))
    assertEquals("AdMob", ReactNativeGoogleMobileAdsResponseInfo.emptyToNull("AdMob"))
  }

  @Test
  fun allowlistedExtrasMap_keepsOnlyKnownKeys() {
    val bundle = Bundle()
    bundle.putString("mediation_group_name", "group-a")
    bundle.putString("creative_id", "creative-1")
    bundle.putString("line_item_id", "line-9")
    bundle.putString("secret_credential", "should-drop")
    bundle.putInt("mediation_ab_test_variant", 7)
    bundle.putString("mediation_ab_test_name", "")

    val extras = ReactNativeGoogleMobileAdsResponseInfo.allowlistedExtrasMap(bundle)
    assertEquals("group-a", extras["mediationGroupName"])
    assertEquals("creative-1", extras["creativeId"])
    assertEquals("line-9", extras["lineItemId"])
    assertEquals("7", extras["mediationAbTestVariant"])
    assertFalse(extras.containsKey("secret_credential"))
    assertFalse(extras.containsKey("mediationAbTestName"))
  }

  @Test
  fun allowlistedExtrasMap_emptyBundle() {
    val extras = ReactNativeGoogleMobileAdsResponseInfo.allowlistedExtrasMap(null)
    assertTrue(extras.isEmpty())
  }

  @Test
  fun fullAndPaidShapesPreserveResponseInfoContract() {
    val responseInfo =
      ResponseInfo(
        "adapter.class",
        "response-id",
        Bundle(),
        null,
        emptyList(),
      )

    val full = ReactNativeGoogleMobileAdsResponseInfo.toPlainMap(responseInfo).orEmpty()
    assertEquals("response-id", full["responseId"])
    assertTrue(full.containsKey("adapterResponses"))

    val paid =
      ReactNativeGoogleMobileAdsResponseInfo.paidEventPlainMap(
        AdValue(PrecisionType.PRECISE, 1_500_000, "USD"),
        responseInfo,
      )
    val compact = paid["responseInfo"] as Map<*, *>
    assertEquals("response-id", compact["responseId"])
    assertFalse(compact.containsKey("adapterResponses"))
    assertEquals("USD", paid["currency"])
    assertEquals("1500000", paid["valueMicros"])
  }
}
