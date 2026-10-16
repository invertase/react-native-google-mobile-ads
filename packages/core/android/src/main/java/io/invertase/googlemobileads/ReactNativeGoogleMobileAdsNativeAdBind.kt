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

import android.util.Log

/**
 * Narrow helper for delayed NativeAdView bind (#906): swallow only known GMA overlay re-parent
 * [IllegalStateException]s ("already has a parent" / reparent wording).
 */
internal object ReactNativeGoogleMobileAdsNativeAdBind {
  private const val TAG = "RNGoogleMobileAds"

  /**
   * Run [bind], swallowing only re-parent [IllegalStateException]s. Other ISEs are rethrown.
   * Returns true when bind completed without a swallowed exception.
   */
  fun runBindCatching(bind: () -> Unit): Boolean =
    try {
      bind()
      true
    } catch (error: IllegalStateException) {
      if (!isReparentIllegalState(error)) {
        throw error
      }
      Log.w(TAG, "Native ad bind skipped after IllegalStateException: ${error.message}")
      false
    }

  /** Whether [error] matches GMA overlay re-parent failures we treat as non-fatal (#906). */
  fun isReparentIllegalState(error: IllegalStateException): Boolean {
    val message = error.message?.lowercase() ?: return false
    return message.contains("already has a parent") ||
      message.contains("re-parent") ||
      message.contains("reparent")
  }
}
