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

import android.annotation.SuppressLint
import android.widget.FrameLayout
import com.facebook.react.bridge.ReactContext
import com.facebook.react.views.view.ReactViewGroup

/** Classic backend shell; icon ads require Next-Gen. */
@SuppressLint("ViewConstructor")
class ReactNativeGoogleMobileAdsIconAdView(
  private val context: ReactContext,
) : FrameLayout(context) {
  val viewGroup = ReactViewGroup(context)

  init {
    isSaveFromParentEnabled = false
    addView(viewGroup)
  }

  fun setRequestId(requestId: Int?) {
    // No-op on classic.
  }

  fun registerAsset(
    assetType: String,
    reactTag: Int,
  ) {
    // No-op on classic.
  }

  fun destroy() {
    removeAllViews()
  }
}
