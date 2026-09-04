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

import android.util.SparseArray
import android.util.SparseIntArray

/**
 * Per-requestId generation + holder for fullscreen ads.
 *
 * Bumping the generation invalidates in-flight load callbacks (destroy / new load)
 * so a late success cannot reinsert after disposal. Terminal events (closed /
 * fail-to-show) only evict the held ad without bumping, so the same requestId
 * can reload.
 */
internal class FullscreenRequestSlotTracker<T> {
  private val generations = SparseIntArray()
  private val ads = SparseArray<T>()

  fun beginLoad(requestId: Int): Int {
    val generation = generations.get(requestId, 0) + 1
    generations.put(requestId, generation)
    ads.remove(requestId)
    return generation
  }

  fun tryCommit(
    requestId: Int,
    generation: Int,
    ad: T,
  ): Boolean {
    if (generations.get(requestId, 0) != generation) {
      return false
    }
    ads.put(requestId, ad)
    return true
  }

  fun get(requestId: Int): T? = ads.get(requestId)

  /**
   * Commit a already-loaded (e.g. polled) ad under a fresh requestId, bumping
   * generation so any prior in-flight load for that id is invalidated.
   */
  fun adopt(
    requestId: Int,
    ad: T,
  ): Int {
    val generation = generations.get(requestId, 0) + 1
    generations.put(requestId, generation)
    ads.put(requestId, ad)
    return generation
  }

  /** Explicit JS/native destroy — invalidates in-flight loads and drops the holder. */
  fun destroy(requestId: Int) {
    generations.put(requestId, generations.get(requestId, 0) + 1)
    ads.remove(requestId)
  }

  /** Closed / fail-to-show — drop the holder so reload can reuse the requestId. */
  fun evict(requestId: Int) {
    ads.remove(requestId)
  }

  fun clear() {
    generations.clear()
    ads.clear()
  }

  fun size(): Int = ads.size()

  fun generation(requestId: Int): Int = generations.get(requestId, 0)
}
