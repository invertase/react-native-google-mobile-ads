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
import com.google.android.gms.ads.AdSize
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Multi-format request option parsing — no AdLoader / auction asserts.
 * Uses JavaOnlyMap/Array to avoid React Native Arguments bridge init.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MultiFormatRequestParserTest {
  @Test
  fun parseFormats_readsNativeAndBanner() {
    val options =
      JavaOnlyMap.of(
        "formats",
        JavaOnlyArray.of("native", "banner"),
      )

    val parsed = MultiFormatRequestParser.parseFormats(options)
    assertEquals(listOf("native", "banner"), parsed)
    assertTrue(MultiFormatRequestParser.wantsNative(parsed))
    assertTrue(MultiFormatRequestParser.wantsBanner(parsed))
  }

  @Test
  fun parseFormats_emptyWhenMissing() {
    val parsed = MultiFormatRequestParser.parseFormats(JavaOnlyMap())
    assertTrue(parsed.isEmpty())
    assertFalse(MultiFormatRequestParser.wantsNative(parsed))
    assertFalse(MultiFormatRequestParser.wantsBanner(parsed))
  }

  @Test
  fun parseBannerSizes_mapsNamedAndCustom() {
    val options =
      JavaOnlyMap.of(
        "bannerSizes",
        JavaOnlyArray.of("BANNER", "MEDIUM_RECTANGLE", "320x50"),
      )

    val parsed = MultiFormatRequestParser.parseBannerSizes(options)
    assertEquals(3, parsed.size)
    assertEquals(AdSize.BANNER, parsed[0])
    assertEquals(AdSize.MEDIUM_RECTANGLE, parsed[1])
    assertEquals(320, parsed[2].width)
    assertEquals(50, parsed[2].height)
  }

  @Test
  fun parseBannerSizes_emptyWhenMissing() {
    assertTrue(MultiFormatRequestParser.parseBannerSizes(JavaOnlyMap()).isEmpty())
  }
}
