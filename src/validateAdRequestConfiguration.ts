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

import { isPropertySet, isArray, isBoolean, isObject } from './common';
import { MaxAdContentRating } from './MaxAdContentRating';
import { RequestConfiguration } from './types/RequestConfiguration';

export function validateAdRequestConfiguration(requestConfiguration: RequestConfiguration) {
  const out: RequestConfiguration = {};

  if (!isObject(requestConfiguration)) {
    throw new Error("'requestConfiguration' expected an object value");
  }

  if (requestConfiguration.maxAdContentRating) {
    if (
      requestConfiguration.maxAdContentRating !== MaxAdContentRating.G &&
      requestConfiguration.maxAdContentRating !== MaxAdContentRating.PG &&
      requestConfiguration.maxAdContentRating !== MaxAdContentRating.T &&
      requestConfiguration.maxAdContentRating !== MaxAdContentRating.MA
    ) {
      throw new Error(
        "'requestConfiguration.maxAdContentRating' expected on of MaxAdContentRating.G, MaxAdContentRating.PG, MaxAdContentRating.T or MaxAdContentRating.MA",
      );
    }

    out.maxAdContentRating = requestConfiguration.maxAdContentRating;
  }

  if (isPropertySet(requestConfiguration, 'tagForChildDirectedTreatment')) {
    if (!isBoolean(requestConfiguration.tagForChildDirectedTreatment)) {
      throw new Error(
        "'requestConfiguration.tagForChildDirectedTreatment' expected a boolean value",
      );
    }

    out.tagForChildDirectedTreatment = requestConfiguration.tagForChildDirectedTreatment;
  }

  if (isPropertySet(requestConfiguration, 'tagForUnderAgeOfConsent')) {
    if (!isBoolean(requestConfiguration.tagForUnderAgeOfConsent)) {
      throw new Error("'requestConfiguration.tagForUnderAgeOfConsent' expected a boolean value");
    }

    out.tagForUnderAgeOfConsent = requestConfiguration.tagForUnderAgeOfConsent;
  }

  if (isPropertySet(requestConfiguration, 'testDeviceIdentifiers')) {
    if (!isArray(requestConfiguration.testDeviceIdentifiers)) {
      throw new Error("'requestConfiguration.testDeviceIdentifiers' expected an array value");
    }

    out.testDeviceIdentifiers = requestConfiguration.testDeviceIdentifiers;
  }

  return out;
}
