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
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Owned mapper/helper coverage for [ReactNativeGoogleMobileAdsCommon].
 *
 * Does not assert Google Mobile Ads auction, fill, or adapter behavior.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsCommonTest {
  @Test
  fun isAdManagerUnit_detectsSlashPrefix() {
    assertTrue(ReactNativeGoogleMobileAdsCommon.isAdManagerUnit("/1234/unit"))
    assertFalse(ReactNativeGoogleMobileAdsCommon.isAdManagerUnit("ca-app-pub-xxx"))
    assertFalse(ReactNativeGoogleMobileAdsCommon.isAdManagerUnit(null))
  }

  @Test
  fun stringToAdSize_parsesCustomAndNamedSizes() {
    val custom = ReactNativeGoogleMobileAdsCommon.stringToAdSize("320x50")
    assertEquals(320, custom.width)
    assertEquals(50, custom.height)

    assertEquals(AdSize.BANNER, ReactNativeGoogleMobileAdsCommon.stringToAdSize("BANNER"))
    assertEquals(AdSize.MEDIUM_RECTANGLE, ReactNativeGoogleMobileAdsCommon.stringToAdSize("medium_rectangle"))
    assertEquals(AdSize.LEADERBOARD, ReactNativeGoogleMobileAdsCommon.stringToAdSize("LEADERBOARD"))
    assertEquals(AdSize.FLUID, ReactNativeGoogleMobileAdsCommon.stringToAdSize("FLUID"))
    assertEquals(AdSize.BANNER, ReactNativeGoogleMobileAdsCommon.stringToAdSize("unknown-size"))
  }

  @Test
  fun getCodeAndMessageFromAdError_mapsOwnedCodes() {
    assertMapped(AdRequest.ERROR_CODE_INTERNAL_ERROR, "internal-error")
    assertMapped(AdRequest.ERROR_CODE_INVALID_REQUEST, "invalid-request")
    assertMapped(AdRequest.ERROR_CODE_NETWORK_ERROR, "network-error")
    assertMapped(AdRequest.ERROR_CODE_NO_FILL, "no-fill")
    assertMapped(AdRequest.ERROR_CODE_APP_ID_MISSING, "app-id-missing")
    assertMapped(AdRequest.ERROR_CODE_MEDIATION_NO_FILL, "mediation-no-fill")
    assertMapped(AdRequest.ERROR_CODE_INVALID_AD_STRING, "invalid-ad-string")
    assertMapped(AdRequest.ERROR_CODE_REQUEST_ID_MISMATCH, "request-id-mismatch")
    assertMapped(999, "unknown")
  }

  @Test
  fun reasonFromLegacyCode_mirrorsJsVocabulary() {
    assertEquals("no-fill", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode("no-fill"))
    assertEquals("no-fill", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode("error-code-no-fill"))
    assertEquals("network-error", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode("error-code-network-error"))
    assertEquals("app-id-missing", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode("application-identifier-missing"))
    assertEquals("invalid-ad-string", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode("received-invalid-ad-string"))
    assertEquals("internal-error", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode("internal"))
    assertEquals("unknown", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode(null))
    assertEquals("unknown", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode(""))
    assertEquals("mediation-no-fill", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode("error-code-mediation-no-fill"))
    assertEquals("custom", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode("custom"))
  }

  @Test
  fun bannerErrorCodeParts_fillPreviouslyMissingDefaultBranch() {
    // Pure code/message mapping — avoids React Native Arguments bridge init.
    val noFill = ReactNativeGoogleMobileAdsCommon.bannerErrorCodeParts(AdRequest.ERROR_CODE_NO_FILL)
    assertEquals("error-code-no-fill", noFill[0])
    assertEquals("no-fill", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode(noFill[0]))

    val appId = ReactNativeGoogleMobileAdsCommon.bannerErrorCodeParts(AdRequest.ERROR_CODE_APP_ID_MISSING)
    assertEquals("error-code-app-id-missing", appId[0])
    assertEquals("app-id-missing", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode(appId[0]))

    val mediation = ReactNativeGoogleMobileAdsCommon.bannerErrorCodeParts(AdRequest.ERROR_CODE_MEDIATION_NO_FILL)
    assertEquals("error-code-mediation-no-fill", mediation[0])

    val invalidAd = ReactNativeGoogleMobileAdsCommon.bannerErrorCodeParts(AdRequest.ERROR_CODE_INVALID_AD_STRING)
    assertEquals("error-code-invalid-ad-string", invalidAd[0])

    val mismatch = ReactNativeGoogleMobileAdsCommon.bannerErrorCodeParts(AdRequest.ERROR_CODE_REQUEST_ID_MISMATCH)
    assertEquals("error-code-request-id-mismatch", mismatch[0])

    val unknown = ReactNativeGoogleMobileAdsCommon.bannerErrorCodeParts(999)
    assertEquals("error-code-unknown", unknown[0])
    assertEquals("unknown", ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode(unknown[0]))
  }

  @Test
  fun eventConstants_matchOwnedWireNames() {
    assertEquals("loaded", ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_LOADED)
    assertEquals("error", ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_ERROR)
    assertEquals("google_mobile_ads_interstitial_event", ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_INTERSTITIAL)
  }

  private fun assertMapped(
    errorCode: Int,
    expectedCode: String,
  ) {
    val error = AdError(errorCode, "detail-$errorCode", "test-domain")
    val mapped = ReactNativeGoogleMobileAdsCommon.getCodeAndMessageFromAdError(error)
    assertEquals(expectedCode, mapped[0])
    assertEquals("detail-$errorCode", mapped[1])
    assertEquals(
      ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode(expectedCode),
      ReactNativeGoogleMobileAdsCommon.reasonFromLegacyCode(mapped[0]),
    )
  }
}
