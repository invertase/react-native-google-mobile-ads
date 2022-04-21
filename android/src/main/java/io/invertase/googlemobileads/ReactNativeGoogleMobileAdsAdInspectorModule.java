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

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.google.android.gms.ads.AdInspectorError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.OnAdInspectorClosedListener;

import io.invertase.googlemobileads.common.ReactNativeModule;

public class ReactNativeGoogleMobileAdsAdInspectorModule extends ReactNativeModule {
  private static final String SERVICE = "RNGoogleMobileAdsAdInspectorModule";

  public ReactNativeGoogleMobileAdsAdInspectorModule(ReactApplicationContext reactContext) {
    super(reactContext, SERVICE);
  }

  @ReactMethod
  public void openAdInspector(Promise promise) {
    MobileAds.openAdInspector(getApplicationContext(), new OnAdInspectorClosedListener() {
      @Override
      public void onAdInspectorClosed(@Nullable AdInspectorError adInspectorError) {
        if (adInspectorError != null) {
          String code = "";
          switch (adInspectorError.getCode()) {
            case AdInspectorError.ERROR_CODE_INTERNAL_ERROR:
              code = "INTERNAL_ERROR";
              break;
            case AdInspectorError.ERROR_CODE_FAILED_TO_LOAD:
              code = "FAILED_TO_LOAD";
              break;
            case AdInspectorError.ERROR_CODE_NOT_IN_TEST_MODE:
              code = "NOT_IN_TEST_MODE";
              break;
            case AdInspectorError.ERROR_CODE_ALREADY_OPEN:
              code = "ALREADY_OPEN";
              break;
          }
          rejectPromiseWithCodeAndMessage(
            promise,
            code,
            adInspectorError.getMessage());
        }
        promise.resolve(null);
      }
    });
  }
}
