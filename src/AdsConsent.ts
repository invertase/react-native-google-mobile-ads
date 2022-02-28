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

import { hasOwnProperty, isArray, isBoolean, isObject, isString } from './common';
import { NativeModules } from 'react-native';
import { AdsConsentDebugGeography } from './AdsConsentDebugGeography';
import { AdsConsentInterface } from './types/AdsConsent.interface';

const native = NativeModules.RNGoogleMobileAdsConsentModule;

export const AdsConsent: AdsConsentInterface = {
  /**
   *
   * @param {Object} [options]
   * @param {AdsConsentDebugGeography} [options.debugGeography]
   * @param {Boolean} [options.tagForUnderAgeOfConsent]
   * @param {Array<String>} [options.testDeviceIdentifiers]
   * @returns {{ status: Number, isConsentFormAvailable: Boolean }}
   */
  requestInfoUpdate(options = {}) {
    if (!isObject(options)) {
      throw new Error("AdsConsent.requestInfoUpdate(*) 'options' expected an object value.");
    }

    if (
      hasOwnProperty(options, 'debugGeography') &&
      options.debugGeography !== AdsConsentDebugGeography.DISABLED &&
      options.debugGeography !== AdsConsentDebugGeography.EEA &&
      options.debugGeography !== AdsConsentDebugGeography.NOT_EEA
    ) {
      throw new Error(
        "AdsConsent.requestInfoUpdate(*) 'options.debugGeography' expected one of AdsConsentDebugGeography.DISABLED, AdsConsentDebugGeography.EEA or AdsConsentDebugGeography.NOT_EEA.",
      );
    }

    if (
      hasOwnProperty(options, 'tagForUnderAgeOfConsent') &&
      !isBoolean(options.tagForUnderAgeOfConsent)
    ) {
      throw new Error(
        "AdsConsent.requestInfoUpdate(*) 'options.tagForUnderAgeOfConsent' expected a boolean value.",
      );
    }

    if (hasOwnProperty(options, 'testDeviceIdentifiers')) {
      if (!isArray(options.testDeviceIdentifiers)) {
        throw new Error(
          "AdsConsent.requestInfoUpdate(*) 'options.testDeviceIdentifiers' expected an array of string values.",
        );
      }

      for (const deviceId of options.testDeviceIdentifiers ?? []) {
        if (!isString(deviceId)) {
          throw new Error(
            "AdsConsent.requestInfoUpdate(*) 'options.testDeviceIdentifiers' expected an array of string values.",
          );
        }
      }
    }

    return native.requestInfoUpdate(options);
  },

  /**
   *
   * @returns {{ status: Number }}
   */
  showForm() {
    return native.showForm();
  },

  /**
   *
   */
  reset() {
    return native.reset();
  },
};
