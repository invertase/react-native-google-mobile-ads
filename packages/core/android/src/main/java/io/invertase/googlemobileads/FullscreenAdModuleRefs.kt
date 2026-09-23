package io.invertase.googlemobileads

import com.facebook.react.bridge.Promise
import io.invertase.googlemobileads.common.ReactNativeModule
import java.util.concurrent.ConcurrentHashMap

/**
 * TurboModule / New Architecture paths may not expose legacy `getNativeModule`
 * lookups; fullscreen format modules self-register for pool poll adoption.
 */
internal object FullscreenAdModuleRefs {
  private val modules = ConcurrentHashMap<String, ReactNativeGoogleMobileAdsFullScreenAdModule<*>>()

  fun register(module: ReactNativeGoogleMobileAdsFullScreenAdModule<*>) {
    modules[module.name] = module
  }

  fun unregister(name: String) {
    modules.remove(name)
  }

  fun get(name: String): ReactNativeGoogleMobileAdsFullScreenAdModule<*>? = modules[name]

  /** Prefer self-registration (TurboModule); fall back to legacy `getNativeModule`. */
  fun resolve(
    name: String,
    legacy: () -> ReactNativeGoogleMobileAdsFullScreenAdModule<*>?,
  ): ReactNativeGoogleMobileAdsFullScreenAdModule<*>? = get(name) ?: legacy()
}

/** Shared by classic and next-gen pool poll paths. */
internal fun adoptPolledFullscreenAdOrReject(
  moduleName: String,
  legacy: () -> ReactNativeGoogleMobileAdsFullScreenAdModule<*>?,
  reqId: Int,
  adUnitId: String,
  ad: Any,
  promise: Promise,
  onSuccess: () -> Unit,
): Boolean {
  val module = FullscreenAdModuleRefs.resolve(moduleName, legacy)
  if (module == null) {
    ReactNativeModule.rejectPromiseWithCodeAndMessage(
      promise,
      "pool/adopt-module-missing",
      "Fullscreen module '$moduleName' unavailable for pooled ad adoption.",
    )
    return false
  }
  module.adoptPolledAdAny(reqId, adUnitId, ad)
  onSuccess()
  return true
}
