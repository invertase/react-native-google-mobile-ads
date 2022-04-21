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

import { NativeModules } from 'react-native';

const { RNGoogleMobileAdsAdInspectorModule } = NativeModules;

interface AdInspectorModule {
  openAdInspector: () => Promise<void>;
}

/**
 * Ad inspector is an in-app overlay that enables authorized devices to perform real-time analysis of test ad requests directly within a mobile app.
 *
 * @see https://developers.google.com/ad-manager/mobile-ads-sdk/android/ad-inspector
 */
export class AdInspector {
  private static native = RNGoogleMobileAdsAdInspectorModule as AdInspectorModule;

  /**
   * Opens the Ad Inspector.
   * The promise will resolve when the inspector is closed.
   * Also, the promise will reject if ad inspector is closed due to an error.
   */
  static openAdInspector() {
    return AdInspector.native.openAdInspector();
  }
}
