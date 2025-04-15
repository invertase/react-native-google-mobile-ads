package io.invertase.googlemobileads

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReadableMap

abstract class NativeGoogleMobileAdsNativeModuleSpec(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  abstract fun load(adUnitId: String, requestOptions: ReadableMap, promise: Promise)
  abstract fun destroy(responseId: String)
}
