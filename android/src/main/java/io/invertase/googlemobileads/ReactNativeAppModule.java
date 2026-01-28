package io.invertase.googlemobileads;

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

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import io.invertase.googlemobileads.common.RCTConvert;
import io.invertase.googlemobileads.common.ReactNativeEvent;
import io.invertase.googlemobileads.common.ReactNativeEventEmitter;
import io.invertase.googlemobileads.common.ReactNativeJSON;
import io.invertase.googlemobileads.common.ReactNativeMeta;
import io.invertase.googlemobileads.common.ReactNativePreferences;

public class ReactNativeAppModule extends NativeAppModuleSpec {
  public static final String NAME = NativeAppModuleSpec.NAME;

  ReactNativeAppModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public void initialize() {
    super.initialize();
    ReactNativeEventEmitter.getSharedInstance().attachReactContext(getReactApplicationContext());
  }

  @Override
  @ReactMethod
  public void initializeApp(ReadableMap options, ReadableMap appConfig, Promise promise) {
    promise.resolve(options);
  }

  @Override
  @ReactMethod
  public void setAutomaticDataCollectionEnabled(String appName, boolean enabled) {
    // No-op for ads module
  }

  @Override
  @ReactMethod
  public void deleteApp(String appName, Promise promise) {
    promise.resolve(null);
  }

  @Override
  @ReactMethod
  public void eventsNotifyReady(boolean ready) {
    ReactNativeEventEmitter emitter = ReactNativeEventEmitter.getSharedInstance();
    emitter.notifyJsReady(ready);
  }

  @Override
  @ReactMethod
  public void eventsGetListeners(Promise promise) {
    ReactNativeEventEmitter emitter = ReactNativeEventEmitter.getSharedInstance();
    promise.resolve(emitter.getListenersMap());
  }

  @Override
  @ReactMethod
  public void eventsPing(String eventName, ReadableMap eventBody, Promise promise) {
    ReactNativeEventEmitter emitter = ReactNativeEventEmitter.getSharedInstance();
    emitter.sendEvent(
        new ReactNativeEvent(eventName, RCTConvert.readableMapToWritableMap(eventBody)));
    promise.resolve(RCTConvert.readableMapToWritableMap(eventBody));
  }

  @Override
  @ReactMethod
  public void eventsAddListener(String eventName) {
    ReactNativeEventEmitter emitter = ReactNativeEventEmitter.getSharedInstance();
    emitter.addListener(eventName);
  }

  @Override
  @ReactMethod
  public void eventsRemoveListener(String eventName, boolean all) {
    ReactNativeEventEmitter emitter = ReactNativeEventEmitter.getSharedInstance();
    emitter.removeListener(eventName, all);
  }

  @Override
  @ReactMethod
  public void addListener(String eventName) {
    // Keep: Required for RN built in Event Emitter Calls.
  }

  @Override
  @ReactMethod
  public void removeListeners(double count) {
    // Keep: Required for RN built in Event Emitter Calls.
  }

  /** ------------------ META ------------------ */
  @Override
  @ReactMethod
  public void metaGetAll(Promise promise) {
    promise.resolve(ReactNativeMeta.getSharedInstance().getAll());
  }

  /** ------------------ JSON ------------------ */
  @Override
  @ReactMethod
  public void jsonGetAll(Promise promise) {
    promise.resolve(ReactNativeJSON.getSharedInstance().getAll());
  }

  /** ------------------ PREFERENCES ------------------ */
  @Override
  @ReactMethod
  public void preferencesSetBool(String key, boolean value, Promise promise) {
    ReactNativePreferences.getSharedInstance().setBooleanValue(key, value);
    promise.resolve(null);
  }

  @Override
  @ReactMethod
  public void preferencesSetString(String key, String value, Promise promise) {
    ReactNativePreferences.getSharedInstance().setStringValue(key, value);
    promise.resolve(null);
  }

  @Override
  @ReactMethod
  public void preferencesGetAll(Promise promise) {
    promise.resolve(ReactNativePreferences.getSharedInstance().getAll());
  }

  @Override
  @ReactMethod
  public void preferencesClearAll(Promise promise) {
    ReactNativePreferences.getSharedInstance().clearAll();
    promise.resolve(null);
  }
}
