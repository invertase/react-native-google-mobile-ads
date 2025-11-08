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

import android.app.Activity;
import android.content.Context;

import com.facebook.react.bridge.*;

import io.invertase.googlemobileads.interfaces.ContextProvider;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;

import javax.annotation.Nonnull;

public class ReactNativeModule implements ContextProvider {
  private ReactApplicationContext context;

  public ReactNativeModule(ReactApplicationContext reactContext) {
    this.context = reactContext;
  }

  public static void rejectPromiseWithCodeAndMessage(Promise promise, String code, String message) {
    WritableMap userInfoMap = Arguments.createMap();
    userInfoMap.putString("code", code);
    userInfoMap.putString("message", message);
    promise.reject(code, message, userInfoMap);
  }

  public ReactContext getContext() {
    return context;
  }


  public Context getApplicationContext() {
    return context.getApplicationContext();
  }

  public Activity getActivity() {
    return context.getCurrentActivity();
  }
}
