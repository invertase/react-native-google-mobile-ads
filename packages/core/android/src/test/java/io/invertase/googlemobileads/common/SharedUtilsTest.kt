package io.invertase.googlemobileads.common

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

import android.graphics.Point
import android.graphics.Rect
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Owned helper coverage for [SharedUtils].
 *
 * Does not assert Google Mobile Ads auction, fill, or adapter behavior.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class SharedUtilsTest {
  @Test
  fun rectToIntArray_handlesNullEmptyAndValues() {
    assertArrayEquals(intArrayOf(), SharedUtils.rectToIntArray(null))
    assertArrayEquals(intArrayOf(), SharedUtils.rectToIntArray(Rect()))
    assertArrayEquals(intArrayOf(1, 2, 3, 4), SharedUtils.rectToIntArray(Rect(1, 2, 3, 4)))
  }

  @Test
  fun pointToIntArray_handlesNullAndValues() {
    assertArrayEquals(intArrayOf(), SharedUtils.pointToIntArray(null))
    assertArrayEquals(intArrayOf(7, 9), SharedUtils.pointToIntArray(Point(7, 9)))
  }

  @Test
  fun pointsToIntsList_mapsArray() {
    val points = arrayOf(Point(1, 2), Point(3, 4))
    val mapped = SharedUtils.pointsToIntsList(points)
    assertEquals(2, mapped.size)
    assertArrayEquals(intArrayOf(1, 2), mapped[0])
    assertArrayEquals(intArrayOf(3, 4), mapped[1])
    assertTrue(SharedUtils.pointsToIntsList(null).isEmpty())
  }

  @Test
  fun getUri_defaultsMissingSchemeToFile() {
    val withScheme = SharedUtils.getUri("https://example.com/a")
    assertEquals("https", withScheme.scheme)
    assertEquals("example.com", withScheme.host)

    val fileUri = SharedUtils.getUri("/tmp/ads-fixture.json")
    assertEquals("file", fileUri.scheme)
  }

  @Test
  fun timestampToUTC_formatsEpochSeconds() {
    assertEquals("1970-01-01T00:00:00Z", SharedUtils.timestampToUTC(0))
    assertEquals("2020-01-01T00:00:00Z", SharedUtils.timestampToUTC(1577836800))
  }
}
