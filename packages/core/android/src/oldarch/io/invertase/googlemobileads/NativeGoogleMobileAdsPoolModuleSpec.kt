package io.invertase.googlemobileads

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReadableMap

abstract class NativeGoogleMobileAdsPoolModuleSpec(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  abstract fun poolStart(
    preloadId: String,
    format: String,
    adUnitId: String,
    bufferSize: Double,
    requestOptions: ReadableMap,
    promise: Promise,
  )

  abstract fun poolGetAvailability(
    preloadId: String,
    format: String,
    promise: Promise,
  )

  abstract fun poolPeekResponseInfo(
    preloadId: String,
    format: String,
    promise: Promise,
  )

  abstract fun poolPoll(
    preloadId: String,
    format: String,
    requestId: Double,
    adUnitId: String,
    promise: Promise,
  )

  abstract fun poolDestroy(
    preloadId: String,
    format: String,
  )

  abstract fun addListener(eventName: String)

  abstract fun removeListeners(count: Double)
}
