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

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Red→green for #870 / #755: NativeAd load must settle (resolve or reject), never no-op.
 * Also documents AdLoader retention until settle (GC hang without a strong ref).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsNativeAdLoadTest {
  @Test
  fun blankResponseIdMustRejectNotHang() {
    val nullOutcome = ReactNativeGoogleMobileAdsNativeAdLoad.outcomeForLoadedResponseId(null)
    assertTrue(
      "null responseId must reject (historic hang was silent return)",
      nullOutcome is ReactNativeGoogleMobileAdsNativeAdLoad.Outcome.Reject,
    )
    val reject = nullOutcome as ReactNativeGoogleMobileAdsNativeAdLoad.Outcome.Reject
    assertEquals(ReactNativeGoogleMobileAdsNativeAdLoad.MISSING_RESPONSE_ID_CODE, reject.code)
    assertEquals(ReactNativeGoogleMobileAdsNativeAdLoad.MISSING_RESPONSE_ID_MESSAGE, reject.message)

    val blank = ReactNativeGoogleMobileAdsNativeAdLoad.outcomeForLoadedResponseId("   ")
    assertTrue(blank is ReactNativeGoogleMobileAdsNativeAdLoad.Outcome.Reject)
  }

  @Test
  fun validResponseIdResolves() {
    val outcome = ReactNativeGoogleMobileAdsNativeAdLoad.outcomeForLoadedResponseId("resp-1")
    assertTrue(outcome is ReactNativeGoogleMobileAdsNativeAdLoad.Outcome.Resolve)
    assertEquals(
      "resp-1",
      (outcome as ReactNativeGoogleMobileAdsNativeAdLoad.Outcome.Resolve).responseId,
    )
  }

  @Test
  fun loaderRetentionHoldsUntilClearedAfterSettle() {
    val retention = ReactNativeGoogleMobileAdsNativeAdLoad.LoaderRetention()
    val loader = Any()
    assertFalse(retention.isRetained())

    retention.retain(loader)
    assertTrue(
      "AdLoader must stay strongly held while load is in flight (#870 GC hang)",
      retention.isRetained(),
    )
    assertSame(loader, retention.get())

    // Production clears only after promise settle — dropping earlier is the hang.
    retention.clear()
    assertFalse(retention.isRetained())
    assertNull(retention.get())
  }

  @Test
  fun onceOnlySettleAllowsFirstCallerOnly() {
    val settled = ReactNativeGoogleMobileAdsNativeAdLoad.OnceOnlySettle()
    assertFalse(settled.isSettled())
    assertTrue(
      "first dual-callback path must win the settle race",
      settled.trySettle(),
    )
    assertTrue(settled.isSettled())
    assertFalse(
      "second success/failure callback must not settle again (double-settle)",
      settled.trySettle(),
    )
    assertTrue(settled.isSettled())
  }
}
