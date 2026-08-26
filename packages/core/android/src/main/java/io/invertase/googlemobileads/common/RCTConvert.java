package io.invertase.googlemobileads.common;

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

import android.util.Log;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import java.util.List;
import java.util.Map;
import javax.annotation.Nullable;

/** Utilities to convert to and from React Native bridge formats. */
public class RCTConvert {
  private static String TAG = "RCTConvert";

  /**
   * Takes a value and calls the appropriate setter for its type on the target map + key
   *
   * @param key String key to set on target map
   * @param value Object value to set on target map
   * @param map WritableMap target map to write the value to
   */
  @SuppressWarnings("unchecked")
  public static WritableMap mapPutValue(String key, @Nullable Object value, WritableMap map) {
    if (value == null) {
      map.putNull(key);
      return map;
    }

    String type = value.getClass().getName();

    switch (type) {
      case "java.lang.Boolean":
        map.putBoolean(key, (Boolean) value);
        break;
      case "java.lang.Long":
        Long longVal = (Long) value;
        map.putDouble(key, (double) longVal);
        break;
      case "java.lang.Float":
        float floatVal = (float) value;
        map.putDouble(key, (double) floatVal);
        break;
      case "java.lang.Double":
        map.putDouble(key, (Double) value);
        break;
      case "java.lang.Integer":
        map.putInt(key, (int) value);
        break;
      case "java.lang.String":
        map.putString(key, (String) value);
        break;
      case "org.json.JSONObject$1":
        map.putString(key, value.toString());
        break;
      default:
        if (List.class.isAssignableFrom(value.getClass())) {
          map.putArray(key, Arguments.makeNativeArray((List<Object>) value));
        } else if (Map.class.isAssignableFrom(value.getClass())) {
          WritableMap childMap = Arguments.createMap();
          Map<String, Object> valueMap = (Map<String, Object>) value;

          for (Map.Entry<String, Object> entry : valueMap.entrySet()) {
            mapPutValue(entry.getKey(), entry.getValue(), childMap);
          }

          map.putMap(key, childMap);
        } else {
          Log.d(TAG, "utils:mapPutValue:unknownType:" + type);
          map.putNull(key);
        }
    }

    return map;
  }

  // TODO Remove me - also in SharedUtils
  public static WritableMap readableMapToWritableMap(ReadableMap map) {
    WritableMap writableMap = Arguments.createMap();
    // https://github.com/facebook/react-native/blob/main/ReactAndroid/src/main/java/com/facebook/react/bridge/WritableNativeMap.java#L58
    writableMap.merge(map);
    return writableMap;
  }

  public static Map<String, Object> toHashMap(ReadableMap readableMap) {
    // https://github.com/facebook/react-native/blob/main/ReactAndroid/src/main/java/com/facebook/react/bridge/ReadableNativeMap.java#L263
    return readableMap.toHashMap();
  }

  public static List<Object> toArrayList(ReadableArray readableArray) {
    // https://github.com/facebook/react-native/blob/main/ReactAndroid/src/main/java/com/facebook/react/bridge/ReadableNativeArray.java#L140
    return readableArray.toArrayList();
  }
}
