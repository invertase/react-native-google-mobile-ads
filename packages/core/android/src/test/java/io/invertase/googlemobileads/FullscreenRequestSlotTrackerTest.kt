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
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Owned lifecycle slot tracker — no Google auction/fill asserts.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class FullscreenRequestSlotTrackerTest {
  @Test
  fun commitSucceedsForCurrentGeneration() {
    val tracker = FullscreenRequestSlotTracker<String>()
    val gen = tracker.beginLoad(1)
    assertTrue(tracker.tryCommit(1, gen, "ad"))
    assertEquals("ad", tracker.get(1))
    assertEquals(1, tracker.size())
  }

  @Test
  fun destroyInvalidatesInFlightCommit() {
    val tracker = FullscreenRequestSlotTracker<String>()
    val gen = tracker.beginLoad(7)
    tracker.destroy(7)
    assertFalse(tracker.tryCommit(7, gen, "late"))
    assertNull(tracker.get(7))
    assertEquals(0, tracker.size())
  }

  @Test
  fun newerLoadInvalidatesOlderCommit() {
    val tracker = FullscreenRequestSlotTracker<String>()
    val first = tracker.beginLoad(3)
    val second = tracker.beginLoad(3)
    assertFalse(tracker.tryCommit(3, first, "stale"))
    assertTrue(tracker.tryCommit(3, second, "fresh"))
    assertEquals("fresh", tracker.get(3))
  }

  @Test
  fun evictDropsHolderWithoutBlockingReload() {
    val tracker = FullscreenRequestSlotTracker<String>()
    val gen = tracker.beginLoad(2)
    assertTrue(tracker.tryCommit(2, gen, "shown"))
    tracker.evict(2)
    assertNull(tracker.get(2))
    val reload = tracker.beginLoad(2)
    assertTrue(tracker.tryCommit(2, reload, "next"))
    assertEquals("next", tracker.get(2))
  }
}
