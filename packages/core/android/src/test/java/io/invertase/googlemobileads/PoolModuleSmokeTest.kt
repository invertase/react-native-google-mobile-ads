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
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE)
class PoolModuleSmokeTest {
  @Test
  fun poolModuleNameMatchesTurboModule() {
    assertEquals("RNGoogleMobileAdsPoolModule", ReactNativeGoogleMobileAdsPoolModule.NAME)
    assertEquals("google_mobile_ads_pool_event", ReactNativeGoogleMobileAdsPoolModule.GOOGLE_MOBILE_ADS_EVENT_POOL)
    assertNotNull(ReactNativeGoogleMobileAdsPoolModule::class.java)
  }

  @Test
  fun slotTrackerAdoptCommitsAd() {
    val tracker = FullscreenRequestSlotTracker<String>()
    val generation = tracker.adopt(7, "polled-ad")
    assertEquals(1, generation)
    assertEquals("polled-ad", tracker.get(7))
    tracker.destroy(7)
    assertEquals(null, tracker.get(7))
  }
}
