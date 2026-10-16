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

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Policy for #906: swallow only known GMA re-parent IllegalStateException messages.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReactNativeGoogleMobileAdsNativeAdBindTest {
  @Test
  fun isReparentIllegalState_matchesAlreadyHasAParent() {
    assertTrue(
      ReactNativeGoogleMobileAdsNativeAdBind.isReparentIllegalState(
        IllegalStateException("The specified child already has a parent. You must call removeView() on the child's parent first."),
      ),
    )
  }

  @Test
  fun isReparentIllegalState_matchesReparentWording() {
    assertTrue(
      ReactNativeGoogleMobileAdsNativeAdBind.isReparentIllegalState(
        IllegalStateException("Cannot re-parent overlay view"),
      ),
    )
    assertTrue(
      ReactNativeGoogleMobileAdsNativeAdBind.isReparentIllegalState(
        IllegalStateException("Failed to reparent media overlay"),
      ),
    )
  }

  @Test
  fun isReparentIllegalState_rejectsUnrelatedMessage() {
    assertFalse(
      ReactNativeGoogleMobileAdsNativeAdBind.isReparentIllegalState(
        IllegalStateException("Native ad view is destroyed"),
      ),
    )
    assertFalse(
      ReactNativeGoogleMobileAdsNativeAdBind.isReparentIllegalState(
        IllegalStateException(null as String?),
      ),
    )
  }

  @Test
  fun runBindCatching_returnsTrueOnSuccess() {
    var ran = false
    assertTrue(
      ReactNativeGoogleMobileAdsNativeAdBind.runBindCatching {
        ran = true
      },
    )
    assertTrue(ran)
  }

  @Test
  fun runBindCatching_swallowsReparentIllegalStateException() {
    assertFalse(
      ReactNativeGoogleMobileAdsNativeAdBind.runBindCatching {
        throw IllegalStateException("The specified child already has a parent")
      },
    )
  }

  @Test(expected = IllegalStateException::class)
  fun runBindCatching_rethrowsOtherIllegalStateException() {
    ReactNativeGoogleMobileAdsNativeAdBind.runBindCatching {
      throw IllegalStateException("Native ad view is destroyed")
    }
  }
}
