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

import {
  hasOwnProperty,
  isArray,
  isBoolean,
  isObject,
  isString,
  isUndefined,
  isValidUrl,
} from './common';
import { NativeModules } from 'react-native';
import { AdsConsentDebugGeography } from './AdsConsentDebugGeography';
import { AdsConsentStatus } from './AdsConsentStatus';
import { AdsConsentInterface } from './types/AdsConsent.interface';

const native = NativeModules.RNGoogleMobileAdsConsentModule;

export const AdsConsent: AdsConsentInterface = {
  /**
   *
   * @param publisherIds
   * @returns {*}
   */
  requestInfoUpdate(publisherIds) {
    if (!isArray(publisherIds)) {
      throw new Error(
        "AdsConsent.requestInfoUpdate(*) 'publisherIds' expected an array of string values.",
      );
    }

    if (publisherIds.length === 0) {
      throw new Error(
        "AdsConsent.requestInfoUpdate(*) 'publisherIds' list of publisher IDs cannot be empty.",
      );
    }

    for (let i = 0; i < publisherIds.length; i++) {
      if (!isString(publisherIds[i])) {
        throw new Error(
          `AdsConsent.requestInfoUpdate(*) 'publisherIds[${i}]' expected a string value.`,
        );
      }
    }

    return native.requestInfoUpdate(publisherIds);
  },

  /**
   *
   * @param options
   * @returns {*}
   */
  showForm(options) {
    if (!isUndefined(options) && !isObject(options)) {
      throw new Error("AdsConsent.showForm(*) 'options' expected an object value.");
    }

    if (!isValidUrl(options.privacyPolicy)) {
      throw new Error(
        "AdsConsent.showForm(*) 'options.privacyPolicy' expected a valid HTTP or HTTPS URL.",
      );
    }

    if (hasOwnProperty(options, 'withPersonalizedAds') && !isBoolean(options.withPersonalizedAds)) {
      throw new Error(
        "AdsConsent.showForm(*) 'options.withPersonalizedAds' expected a boolean value.",
      );
    }

    if (
      hasOwnProperty(options, 'withNonPersonalizedAds') &&
      !isBoolean(options.withNonPersonalizedAds)
    ) {
      throw new Error(
        "AdsConsent.showForm(*) 'options.withNonPersonalizedAds' expected a boolean value.",
      );
    }

    if (hasOwnProperty(options, 'withAdFree') && !isBoolean(options.withAdFree)) {
      throw new Error("AdsConsent.showForm(*) 'options.withAdFree' expected a boolean value.");
    }

    if (!options.withPersonalizedAds && !options.withNonPersonalizedAds && !options.withAdFree) {
      throw new Error(
        "AdsConsent.showForm(*) 'options' form requires at least one option to be enabled.",
      );
    }

    return native.showForm(options);
  },

  /**
   *
   */
  getAdProviders() {
    return native.getAdProviders();
  },

  /**
   *
   * @param geography
   */
  setDebugGeography(geography) {
    if (
      geography !== AdsConsentDebugGeography.DISABLED &&
      geography !== AdsConsentDebugGeography.EEA &&
      geography !== AdsConsentDebugGeography.NOT_EEA
    ) {
      throw new Error(
        "AdsConsent.setDebugGeography(*) 'geography' expected one of AdsConsentDebugGeography.DISABLED, AdsConsentDebugGeography.EEA or AdsConsentDebugGeography.NOT_EEA.",
      );
    }

    return native.setDebugGeography(geography);
  },

  /**
   *
   */
  getStatus() {
    return native.getStatus();
  },

  /**
   *
   * @param status
   */
  setStatus(status) {
    if (
      status !== AdsConsentStatus.UNKNOWN &&
      status !== AdsConsentStatus.NON_PERSONALIZED &&
      status !== AdsConsentStatus.PERSONALIZED
    ) {
      throw new Error(
        "AdsConsent.setStatus(*) 'status' expected one of AdsConsentStatus.UNKNOWN, AdsConsentStatus.NON_PERSONALIZED or AdsConsentStatus.PERSONALIZED.",
      );
    }

    return native.setStatus(status);
  },

  /**
   *
   * @param tag
   */
  setTagForUnderAgeOfConsent(tag) {
    if (!isBoolean(tag)) {
      throw new Error("AdsConsent.setTagForUnderAgeOfConsent(*) 'tag' expected a boolean value.");
    }

    return native.setTagForUnderAgeOfConsent(tag);
  },

  /**
   *
   * @param deviceIds
   */
  addTestDevices(deviceIds) {
    if (!isArray(deviceIds)) {
      throw new Error(
        "AdsConsent.addTestDevices(*) 'deviceIds' expected an array of string values.",
      );
    }

    for (let i = 0; i < deviceIds.length; i++) {
      if (!isString(deviceIds[i])) {
        throw new Error(
          "AdsConsent.addTestDevices(*) 'deviceIds' expected an array of string values.",
        );
      }
    }

    return native.addTestDevices(deviceIds);
  },
};
