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
import com.facebook.react.bridge.WritableMap
import com.google.android.libraries.ads.mobile.sdk.common.AdSourceResponseInfo
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.MediationAdError
import com.google.android.libraries.ads.mobile.sdk.common.PrecisionType
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo

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
      val asString = emptyToNull(allowlistedExtraRaw(bundle, nativeKey)) ?: continue
      extras[jsKey] = asString
    }
    return extras
  }

  /**
   * Read an allowlisted extra as text without the deprecated untyped [Bundle.get] on the
   * common string path. Falls back to [Bundle.get] only when a non-string value is present:
   * platform `BaseBundle.get(String)` is `@Deprecated` (API 33+) with no untyped replacement.
   */
  private fun allowlistedExtraRaw(
    bundle: Bundle,
    key: String,
  ): String? {
    if (!bundle.containsKey(key)) {
      return null
    }
    bundle.getString(key)?.let {
      return it
    }
    @Suppress("DEPRECATION")
    val raw = bundle.get(key) ?: return null
    return raw.toString()
  }

  private fun adapterErrorMap(adError: MediationAdError?): Map<String, Any?>? {
    if (adError == null) return null
    return mapOf(
      "domain" to (adError.domain ?: ""),
      "code" to adError.code,
      "message" to (adError.message ?: ""),
    )
  }

  private fun adapterResponseMap(
    info: AdSourceResponseInfo,
    forceSuccess: Boolean = false,
  ): Map<String, Any?> {
    val adError = if (forceSuccess) null else info.adError
    return linkedMapOf(
      "adapterClassName" to info.adapterClassName,
      "adSourceName" to emptyToNull(info.name),
      "adSourceId" to emptyToNull(info.id),
      "adSourceInstanceName" to emptyToNull(info.instanceName),
      "adSourceInstanceId" to emptyToNull(info.instanceId),
      "latencyMillis" to info.latencyMillis.toDouble(),
      "outcome" to if (adError == null) "success" else "error",
      "adError" to adapterErrorMap(adError),
    )
  }

  @JvmStatic
  @JvmOverloads
  fun toPlainMap(
    responseInfo: ResponseInfo?,
    compact: Boolean = false,
  ): Map<String, Any?>? {
    if (responseInfo == null) return null
    val map =
      linkedMapOf<String, Any?>(
        "responseId" to emptyToNull(responseInfo.responseId),
        "adapterClassName" to emptyToNull(responseInfo.adapterClassName),
        "loadedAdapterResponse" to
          responseInfo.loadedAdSourceResponseInfo?.let {
            adapterResponseMap(it, forceSuccess = true)
          },
      )
    if (!compact) {
      map["adapterResponses"] = responseInfo.adSourceResponses.map(::adapterResponseMap)
    }
    map["extras"] = allowlistedExtrasMap(responseInfo.responseExtras)
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
  ): WritableMap? = toPlainMap(responseInfo, compact)?.let(Arguments::makeNativeMap)

  @JvmStatic
  fun paidEventPlainMap(
    adValue: AdValue,
    responseInfo: ResponseInfo?,
  ): Map<String, Any?> =
    linkedMapOf<String, Any?>(
      "value" to 1e-6 * adValue.valueMicros,
      "precision" to precisionValue(adValue.precisionType).toDouble(),
      "currency" to adValue.currencyCode,
      "valueMicros" to adValue.valueMicros.toString(),
    ).apply {
      toPlainMap(responseInfo, compact = true)?.let {
        put("responseInfo", it)
      }
    }

  /**
   * Paid event payload: `{ currency, precision, value, valueMicros, responseInfo? }`.
   * Public key is always `currency` (not `currencyCode`).
   */
  @JvmStatic
  fun paidEventPayload(
    adValue: AdValue,
    responseInfo: ResponseInfo?,
  ): WritableMap = Arguments.makeNativeMap(paidEventPlainMap(adValue, responseInfo))

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

  private fun precisionValue(value: PrecisionType): Int =
    when (value) {
      PrecisionType.UNKNOWN -> 0
      PrecisionType.ESTIMATED -> 1
      PrecisionType.PUBLISHER_PROVIDED -> 2
      PrecisionType.PRECISE -> 3
    }
}
