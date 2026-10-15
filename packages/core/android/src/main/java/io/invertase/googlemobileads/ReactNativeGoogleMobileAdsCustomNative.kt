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

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap

/**
 * Backend-neutral helpers for Google Ad Manager custom native ads (classic and Next-Gen).
 *
 * The library only reports clicks to the SDK (`performClick(assetName)`). With app click handling
 * the SDK then calls the custom click listener with the asset name instead of navigating, and the
 * library forwards that to JS as `custom_click`; where the user goes next is the app's decision.
 */
object ReactNativeGoogleMobileAdsCustomNative {
  const val EVENT_CUSTOM_CLICK = "custom_click"

  /** Text or image asset value. Names are never normalized. */
  sealed class Asset {
    data class Text(
      val text: String,
    ) : Asset()

    data class Image(
      val url: String,
      val scale: Double,
    ) : Asset()
  }

  fun parseFormatIds(
    requestOptions: ReadableMap,
    key: String,
  ): List<String> {
    if (!requestOptions.hasKey(key) || requestOptions.isNull(key)) {
      return emptyList()
    }
    val array: ReadableArray = requestOptions.getArray(key) ?: return emptyList()
    val ids = LinkedHashSet<String>()
    for (i in 0 until array.size()) {
      val value = array.getString(i) ?: continue
      if (value.isNotBlank()) {
        ids.add(value)
      }
    }
    return ids.toList()
  }

  /** `true` unless `clickHandling` (or the given key) is exactly `"sdk"`. */
  fun usesAppClickHandling(
    requestOptions: ReadableMap,
    key: String,
  ): Boolean = !(requestOptions.hasKey(key) && requestOptions.getString(key) == "sdk")

  /**
   * Collects text and image assets in SDK order. A name that is neither (for example the video
   * asset) is skipped here but still listed in `availableAssetNames`.
   */
  fun collectAssets(
    assetNames: Collection<String>,
    text: (String) -> CharSequence?,
    image: (String) -> Asset.Image?,
  ): LinkedHashMap<String, Asset> {
    val assets = LinkedHashMap<String, Asset>()
    for (name in assetNames) {
      val value = text(name)
      if (value != null) {
        assets[name] = Asset.Text(value.toString())
        continue
      }
      val img = image(name)
      if (img != null && img.url.isNotEmpty()) {
        assets[name] = img
      }
    }
    return assets
  }

  fun assetsToWritableMap(assets: Map<String, Asset>): WritableMap {
    val map = Arguments.createMap()
    for ((name, asset) in assets) {
      val row = Arguments.createMap()
      when (asset) {
        is Asset.Text -> {
          row.putString("type", "text")
          row.putString("text", asset.text)
        }
        is Asset.Image -> {
          row.putString("type", "image")
          val image = Arguments.createMap()
          image.putString("url", asset.url)
          image.putDouble("scale", asset.scale)
          row.putMap("image", image)
        }
      }
      map.putMap(name, row)
    }
    return map
  }

  fun clickEventData(assetName: String): WritableMap {
    val data = Arguments.createMap()
    data.putString("assetName", assetName)
    return data
  }
}
