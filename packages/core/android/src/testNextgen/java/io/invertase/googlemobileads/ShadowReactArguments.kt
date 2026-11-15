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
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReadableNativeArray
import com.facebook.react.bridge.ReadableNativeMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.soloader.nativeloader.NativeLoader
import com.facebook.soloader.nativeloader.NativeLoaderDelegate
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.robolectric.annotation.RealObject
import java.util.IdentityHashMap

/**
 * Skips the React Native JNI load. [WritableNativeMap] class init calls this loader; unit tests
 * have no `reactnativejni_common` library. Must run before that class initializes.
 */
internal object ReactNativeJniUnitBypass {
  fun install() {
    if (!NativeLoader.isInitialized()) {
      NativeLoader.init(
        object : NativeLoaderDelegate {
          override fun loadLibrary(
            shortName: String,
            flags: Int,
          ): Boolean = true

          override fun getLibraryPath(shortName: String): String? = null

          override fun getSoSourcesVersion(): Int = 0
        },
      )
    }
    val loader = Class.forName("com.facebook.react.bridge.ReactNativeJniCommonSoLoader")
    val instance = loader.getField("INSTANCE").get(null)
    val initialized = loader.getDeclaredField("initialized")
    initialized.isAccessible = true
    initialized.setBoolean(instance, true)
  }
}

/**
 * [Arguments.createMap] returns a [com.facebook.react.bridge.JavaOnlyMap]. [Arguments.makeNativeMap]
 * is left real because callers cast its result to [WritableNativeMap]; the native map methods are
 * shadowed below so that cast does not need JNI.
 */
@Implements(value = Arguments::class, looseSignatures = true)
class ShadowReactArguments {
  companion object {
    init {
      ReactNativeJniUnitBypass.install()
    }

    @JvmStatic
    @Implementation
    fun createMap(): WritableMap = JavaOnlyMap()
  }
}

private object NativeMapBuckets {
  private val buckets = IdentityHashMap<Any, LinkedHashMap<String, Any?>>()

  fun of(instance: Any): LinkedHashMap<String, Any?> = buckets.getOrPut(instance) { LinkedHashMap() }
}

@Implements(WritableNativeMap::class)
class ShadowWritableNativeMap : ShadowReadableNativeMap() {
  @Implementation
  fun initHybrid() = Unit

  @Implementation
  fun putBoolean(
    key: String,
    value: Boolean,
  ) {
    NativeMapBuckets.of(real)[key] = value
  }

  @Implementation
  fun putDouble(
    key: String,
    value: Double,
  ) {
    NativeMapBuckets.of(real)[key] = value
  }

  @Implementation
  fun putInt(
    key: String,
    value: Int,
  ) {
    NativeMapBuckets.of(real)[key] = value.toDouble()
  }

  @Implementation
  fun putLong(
    key: String,
    value: Long,
  ) {
    NativeMapBuckets.of(real)[key] = value.toDouble()
  }

  @Implementation
  fun putNull(key: String) {
    NativeMapBuckets.of(real)[key] = null
  }

  @Implementation
  fun putString(
    key: String,
    value: String?,
  ) {
    NativeMapBuckets.of(real)[key] = value
  }

  @Implementation
  fun putNativeMap(
    key: String,
    value: ReadableNativeMap?,
  ) {
    NativeMapBuckets.of(real)[key] = value
  }

  @Implementation
  fun putNativeArray(
    key: String,
    value: ReadableNativeArray?,
  ) {
    NativeMapBuckets.of(real)[key] = value
  }

  @Implementation
  fun mergeNativeMap(source: ReadableNativeMap) = Unit
}

@Implements(ReadableNativeMap::class)
open class ShadowReadableNativeMap {
  @RealObject protected lateinit var real: ReadableNativeMap

  @Implementation
  fun importKeys(): Array<String> = NativeMapBuckets.of(real).keys.toTypedArray()

  @Implementation
  fun importValues(): Array<Any?> = NativeMapBuckets.of(real).values.toTypedArray()

  @Implementation
  fun importTypes(): Array<Any> = emptyArray()
}

@Implements(WritableNativeArray::class)
class ShadowWritableNativeArray {
  @Implementation
  fun initHybrid() = Unit

  @Implementation
  fun pushNull() = Unit

  @Implementation
  fun pushBoolean(value: Boolean) = Unit

  @Implementation
  fun pushDouble(value: Double) = Unit

  @Implementation
  fun pushInt(value: Int) = Unit

  @Implementation
  fun pushLong(value: Long) = Unit

  @Implementation
  fun pushString(value: String?) = Unit

  @Implementation
  fun pushNativeArray(array: ReadableNativeArray?) = Unit

  @Implementation
  fun pushNativeMap(map: ReadableNativeMap?) = Unit
}
