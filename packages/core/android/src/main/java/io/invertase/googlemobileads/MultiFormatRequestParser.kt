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

import com.facebook.react.bridge.ReadableMap
import com.google.android.gms.ads.AdSize

/**
 * Package-visible helpers for count-1 multi-format [AdLoader] request options.
 *
 * Does not talk to the Google Mobile Ads network.
 */
internal object MultiFormatRequestParser {
  fun parseFormats(requestOptions: ReadableMap): List<String> {
    if (!requestOptions.hasKey("formats") || requestOptions.isNull("formats")) {
      return emptyList()
    }
    val array = requestOptions.getArray("formats") ?: return emptyList()
    val formats = ArrayList<String>(array.size())
    for (i in 0 until array.size()) {
      val value = array.getString(i) ?: continue
      if (value.isNotEmpty()) {
        formats.add(value)
      }
    }
    return formats
  }

  fun parseBannerSizes(requestOptions: ReadableMap): List<AdSize> {
    if (!requestOptions.hasKey("bannerSizes") || requestOptions.isNull("bannerSizes")) {
      return emptyList()
    }
    val array = requestOptions.getArray("bannerSizes") ?: return emptyList()
    val sizes = ArrayList<AdSize>(array.size())
    for (i in 0 until array.size()) {
      val value = array.getString(i) ?: continue
      if (value.isNotEmpty()) {
        sizes.add(ReactNativeGoogleMobileAdsCommon.stringToAdSize(value))
      }
    }
    return sizes
  }

  fun wantsNative(formats: List<String>): Boolean = formats.any { it.equals("native", ignoreCase = true) }

  fun wantsBanner(formats: List<String>): Boolean = formats.any { it.equals("banner", ignoreCase = true) }
}
