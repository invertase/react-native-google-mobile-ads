package com.invertase.rngmatesting

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

/**
 * Pattern C example-only TurboModule. Seed probe seams for later FEAT
 * (expiry / delayed-attach / ResponseInfo) — no product ads SDK calls.
 */
class NativeRNGMATestingModule(
  reactContext: ReactApplicationContext,
) : NativeRNGMATestingSpec(reactContext) {
  @Volatile
  private var debugInventoryTtlMs: Long = TTL_UNSET

  override fun ping(promise: Promise) {
    promise.resolve("ok:android")
  }

  override fun setDebugInventoryTtlMs(
    ttlMs: Double,
    promise: Promise,
  ) {
    debugInventoryTtlMs =
      if (ttlMs <= 0.0) {
        TTL_UNSET
      } else {
        ttlMs.toLong()
      }
    promise.resolve(true)
  }

  override fun getDebugInventoryTtlMs(promise: Promise) {
    promise.resolve(debugInventoryTtlMs.toDouble())
  }

  override fun supportsDelayedBannerAttach(promise: Promise) {
    // Classic Android documents load-unattached-then-attach (P-reparent-and / G9).
    promise.resolve(true)
  }

  override fun getResponseInfoFixtureJson(
    kind: String,
    promise: Promise,
  ) {
    val json = responseInfoFixtureJson(kind)
    if (json == null) {
      promise.reject(
        "rngma-testing/unknown-fixture",
        "Unknown ResponseInfo fixture kind: $kind (expected loaded|no-fill|paid-compact)",
      )
      return
    }
    promise.resolve(json)
  }

  companion object {
    const val NAME = NativeRNGMATestingSpec.NAME
    private const val TTL_UNSET = -1L

    fun responseInfoFixtureJson(kind: String): String? =
      when (kind) {
        "loaded" ->
          """
          {"responseId":"fixture-loaded-response","adapterClassName":"com.google.ads.mediation.admob.AdMobAdapter","loadedAdapterResponse":{"adapterClassName":"com.google.ads.mediation.admob.AdMobAdapter","adSourceName":"AdMob Network","adSourceId":"fixture-source","adSourceInstanceName":null,"adSourceInstanceId":null,"latencyMillis":42,"outcome":"success","adError":null},"adapterResponses":[{"adapterClassName":"com.google.ads.mediation.admob.AdMobAdapter","adSourceName":"AdMob Network","adSourceId":"fixture-source","adSourceInstanceName":null,"adSourceInstanceId":null,"latencyMillis":42,"outcome":"success","adError":null}],"extras":{"creativeId":"fixture-creative"}}
          """.trimIndent()
        "no-fill" ->
          """
          {"responseId":null,"adapterClassName":null,"loadedAdapterResponse":null,"adapterResponses":[{"adapterClassName":"com.google.ads.mediation.admob.AdMobAdapter","adSourceName":"AdMob Network","adSourceId":"fixture-source","adSourceInstanceName":null,"adSourceInstanceId":null,"latencyMillis":18,"outcome":"error","adError":{"code":3,"message":"No fill."}}],"extras":{}}
          """.trimIndent()
        "paid-compact" ->
          """
          {"responseId":"fixture-paid-response","adapterClassName":"com.google.ads.mediation.admob.AdMobAdapter","loadedAdapterResponse":{"adapterClassName":"com.google.ads.mediation.admob.AdMobAdapter","adSourceName":"AdMob Network","adSourceId":"fixture-source","adSourceInstanceName":null,"adSourceInstanceId":null,"latencyMillis":42,"outcome":"success","adError":null},"extras":{"creativeId":"fixture-creative"}}
          """.trimIndent()
        else -> null
      }
  }
}
