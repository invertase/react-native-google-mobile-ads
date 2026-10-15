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

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import io.invertase.googlemobileads.ReactNativeGoogleMobileAdsCustomNative.Asset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Owned custom native helpers (backend-neutral). Does not assert Google auction / fill behavior.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsCustomNativeTest {
  private val custom = ReactNativeGoogleMobileAdsCustomNative

  @Test
  fun formatIdsAreKeptVerbatimAndDeduplicated() {
    val options =
      JavaOnlyMap.of(
        "customFormatIds",
        JavaOnlyArray.of("12345678", "AbC-99", "", "12345678", "  "),
      )
    assertEquals(listOf("12345678", "AbC-99"), custom.parseFormatIds(options, "customFormatIds"))
    assertEquals(emptyList<String>(), custom.parseFormatIds(JavaOnlyMap(), "customFormatIds"))
  }

  @Test
  fun clickHandlingDefaultsToApp() {
    assertTrue(custom.usesAppClickHandling(JavaOnlyMap(), "clickHandling"))
    assertTrue(custom.usesAppClickHandling(JavaOnlyMap.of("clickHandling", "app"), "clickHandling"))
    assertFalse(custom.usesAppClickHandling(JavaOnlyMap.of("clickHandling", "sdk"), "clickHandling"))
  }

  @Test
  fun assetsKeepExactCaseSensitiveNamesAndSkipNonTextNonImage() {
    val texts = mapOf("Calltoaction" to "Shop now", "calltoaction" to "twin")
    val images = mapOf("Secondaryimage" to Asset.Image("https://cdn.example.com/s.png", 2.0))
    val assets =
      custom.collectAssets(
        listOf("Calltoaction", "Secondaryimage", "calltoaction", "_videoMediaView", "EmptyImage"),
        text = { texts[it] },
        image = { if (it == "EmptyImage") Asset.Image("", 1.0) else images[it] },
      )
    assertEquals(listOf("Calltoaction", "Secondaryimage", "calltoaction"), assets.keys.toList())
    assertEquals(Asset.Text("Shop now"), assets["Calltoaction"])
    assertEquals(Asset.Text("twin"), assets["calltoaction"])
    assertEquals(Asset.Image("https://cdn.example.com/s.png", 2.0), assets["Secondaryimage"])
    assertFalse(assets.containsKey("CallToAction"))
    assertFalse(assets.containsKey("_videoMediaView"))
    assertFalse(assets.containsKey("EmptyImage"))
  }
}
