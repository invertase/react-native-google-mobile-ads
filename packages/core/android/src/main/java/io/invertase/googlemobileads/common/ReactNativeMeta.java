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

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

public class ReactNativeMeta {
  private static final String TAG = "MetaProvider";
  private static final String META_PREFIX = "rngooglemobileads";
  private static ReactNativeMeta sharedInstance = new ReactNativeMeta();

  public static ReactNativeMeta getSharedInstance() {
    return sharedInstance;
  }

  private Bundle getMetaData() {
    try {
      Context context = ReactNativeApp.getApplicationContext();
      PackageManager packageManager = context.getPackageManager();

      if (packageManager == null) return null;

      ApplicationInfo applicationInfo =
          packageManager.getApplicationInfo(context.getPackageName(), PackageManager.GET_META_DATA);

      if (applicationInfo != null) return applicationInfo.metaData;
    } catch (PackageManager.NameNotFoundException exception) {
      // do nothing
    }

    return null;
  }

  public boolean contains(String key) {
    Bundle metaData = getMetaData();
    if (metaData == null) return false;
    return metaData.containsKey(META_PREFIX + key);
  }

  public boolean getBooleanValue(String key, boolean defaultValue) {
    Bundle metaData = getMetaData();
    if (metaData == null) return defaultValue;
    return metaData.getBoolean(META_PREFIX + key, defaultValue);
  }

  public String getStringValue(String key, String defaultValue) {
    Bundle metaData = getMetaData();
    if (metaData == null) return defaultValue;
    return metaData.getString(META_PREFIX + key, defaultValue);
  }

  public WritableMap getAll() {
    Bundle metaData = getMetaData();
    WritableMap map = Arguments.createMap();
    if (metaData == null) return map;

    for (String key : metaData.keySet()) {
      if (key.startsWith(META_PREFIX)) {
        Object value = metaData.get(key);
        if (value == null) {
          map.putNull(key);
        } else if (value instanceof String) {
          map.putString(key, (String) value);
        } else if (value instanceof Boolean) {
          map.putBoolean(key, (Boolean) value);
        }
      }
    }

    return map;
  }
}
