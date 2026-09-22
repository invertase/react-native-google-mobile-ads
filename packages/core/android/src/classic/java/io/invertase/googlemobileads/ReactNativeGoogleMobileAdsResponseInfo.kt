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

import android.os.Bundle
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdValue
import com.google.android.gms.ads.AdapterResponseInfo
import com.google.android.gms.ads.ResponseInfo

/**
 * Serializes classic Google Mobile Ads [ResponseInfo] into the approved JS
 * `ResponseInfo` / `PaidResponseInfo` shape. Omits credentials, arbitrary extras,
 * and debug dumps.
 */
object ReactNativeGoogleMobileAdsResponseInfo {
  private val EXTRAS_ALLOWLIST =
    mapOf(
      "mediation_group_name" to "mediationGroupName",
      "mediation_ab_test_name" to "mediationAbTestName",
      "mediation_ab_test_variant" to "mediationAbTestVariant",
      "creative_id" to "creativeId",
      "line_item_id" to "lineItemId",
    )

  /**
   * Normalize empty / blank source strings to null for the JS contract.
   */
  @JvmStatic
  fun emptyToNull(value: String?): String? {
    if (value == null) {
      return null
    }
    val trimmed = value.trim()
    return if (trimmed.isEmpty()) null else trimmed
  }

  /**
   * Allowlist-only extras as a plain map (unit-testable without RN bridge init).
   */
  @JvmStatic
  fun allowlistedExtrasMap(bundle: Bundle?): Map<String, String> {
    if (bundle == null) {
      return emptyMap()
    }
    val extras = linkedMapOf<String, String>()
    for ((nativeKey, jsKey) in EXTRAS_ALLOWLIST) {
      if (!bundle.containsKey(nativeKey)) {
        continue
      }
      val raw = bundle.get(nativeKey) ?: continue
      val asString = emptyToNull(raw.toString()) ?: continue
      extras[jsKey] = asString
    }
    return extras
  }

  /**
   * Allowlist-only extras. Unknown keys are dropped; values coerced to strings.
   */
  @JvmStatic
  fun allowlistedExtras(bundle: Bundle?): WritableMap {
    val extras = Arguments.createMap()
    for ((jsKey, value) in allowlistedExtrasMap(bundle)) {
      extras.putString(jsKey, value)
    }
    return extras
  }

  @JvmStatic
  fun adapterErrorMap(adError: AdError?): WritableMap? {
    if (adError == null) {
      return null
    }
    val map = Arguments.createMap()
    map.putString("domain", adError.domain ?: "")
    map.putInt("code", adError.code)
    map.putString("message", adError.message ?: "")
    return map
  }

  @JvmStatic
  fun adapterResponseMap(
    info: AdapterResponseInfo,
    forceSuccess: Boolean = false,
  ): WritableMap {
    val map = Arguments.createMap()
    map.putString("adapterClassName", info.adapterClassName)
    putNullableString(map, "adSourceName", emptyToNull(info.adSourceName))
    putNullableString(map, "adSourceId", emptyToNull(info.adSourceId))
    putNullableString(map, "adSourceInstanceName", emptyToNull(info.adSourceInstanceName))
    putNullableString(map, "adSourceInstanceId", emptyToNull(info.adSourceInstanceId))
    map.putDouble("latencyMillis", info.latencyMillis.toDouble())

    val adError = if (forceSuccess) null else info.adError
    if (adError == null) {
      map.putString("outcome", "success")
      map.putNull("adError")
    } else {
      map.putString("outcome", "error")
      map.putMap("adError", adapterErrorMap(adError))
    }
    return map
  }

  /**
   * Full waterfall snapshot, or compact paid snapshot (omits `adapterResponses`).
   * Returns null when [responseInfo] is null.
   */
  @JvmStatic
  @JvmOverloads
  fun toWritableMap(
    responseInfo: ResponseInfo?,
    compact: Boolean = false,
  ): WritableMap? {
    if (responseInfo == null) {
      return null
    }

    val map = Arguments.createMap()
    putNullableString(map, "responseId", emptyToNull(responseInfo.responseId))
    putNullableString(map, "adapterClassName", emptyToNull(responseInfo.mediationAdapterClassName))

    val loaded = responseInfo.loadedAdapterResponseInfo
    if (loaded == null) {
      map.putNull("loadedAdapterResponse")
    } else {
      map.putMap("loadedAdapterResponse", adapterResponseMap(loaded, forceSuccess = true))
    }

    if (!compact) {
      val rows: WritableArray = Arguments.createArray()
      for (row in responseInfo.adapterResponses) {
        rows.pushMap(adapterResponseMap(row))
      }
      map.putArray("adapterResponses", rows)
    }

    map.putMap("extras", allowlistedExtras(responseInfo.responseExtras))
    return map
  }

  /**
   * Paid event payload: `{ currency, precision, value, valueMicros, responseInfo? }`.
   * Public key is always `currency` (not `currencyCode`).
   */
  @JvmStatic
  fun paidEventPayload(
    adValue: AdValue,
    responseInfo: ResponseInfo?,
  ): WritableMap {
    val payload = Arguments.createMap()
    payload.putDouble("value", 1e-6 * adValue.valueMicros)
    payload.putDouble("precision", adValue.precisionType.toDouble())
    payload.putString("currency", adValue.currencyCode)
    payload.putString("valueMicros", adValue.valueMicros.toString())
    toWritableMap(responseInfo, compact = true)?.let {
      payload.putMap("responseInfo", it)
    }
    return payload
  }

  /**
   * Strip `adapterResponses` from a full snapshot map (for tests / dict transforms).
   */
  @JvmStatic
  fun toCompactMap(full: WritableMap): WritableMap {
    @Suppress("UNCHECKED_CAST")
    val hash = HashMap(full.toHashMap() as Map<String, Any?>)
    hash.remove("adapterResponses")
    return Arguments.makeNativeMap(hash)
  }

  private fun putNullableString(
    map: WritableMap,
    key: String,
    value: String?,
  ) {
    if (value == null) {
      map.putNull(key)
    } else {
      map.putString(key, value)
    }
  }
}
