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
  isPropertySet,
  isArray,
  isBoolean,
  isObject,
  isString,
  isUndefined,
  isValidUrl,
  isNumber,
} from './common';
import { version } from './version';
import { RequestOptions } from './types/RequestOptions';
import { NativeAdRequestOptions } from './types/NativeAdRequestOptions';

export function validateAdRequestOptions(options?: RequestOptions & NativeAdRequestOptions) {
  const out: RequestOptions & NativeAdRequestOptions = {
    requestAgent: `rn-invertase-${version}`,
  };

  if (isUndefined(options)) {
    return out;
  }

  if (!isObject(options)) {
    throw new Error("'options' expected an object value");
  }

  if (isPropertySet(options, 'requestNonPersonalizedAdsOnly')) {
    if (!isBoolean(options.requestNonPersonalizedAdsOnly)) {
      throw new Error("'options.requestNonPersonalizedAdsOnly' expected a boolean value");
    }

    out.requestNonPersonalizedAdsOnly = options.requestNonPersonalizedAdsOnly;
  }

  if (options.networkExtras) {
    if (!isObject(options.networkExtras)) {
      throw new Error("'options.networkExtras' expected an object of key/value pairs");
    }

    Object.entries(options.networkExtras).forEach(([key, value]) => {
      if (!isString(value)) {
        throw new Error(`'options.networkExtras' expected a string value for object key "${key}"`);
      }
    });

    out.networkExtras = options.networkExtras;
  }

  if (options.keywords) {
    if (!isArray(options.keywords)) {
      throw new Error("'options.keywords' expected an array containing string values");
    }

    for (let i = 0; i < options.keywords.length; i++) {
      const keyword = options.keywords[i];

      if (!isString(keyword)) {
        throw new Error("'options.keywords' expected an array containing string values");
      }
    }

    out.keywords = options.keywords;
  }

  if (options.contentUrl) {
    if (!isString(options.contentUrl)) {
      throw new Error("'options.contentUrl' expected a string value");
    }

    if (!isValidUrl(options.contentUrl)) {
      throw new Error("'options.contentUrl' expected a valid HTTP or HTTPS url.");
    }

    if (options.contentUrl.length > 512) {
      throw new Error("'options.contentUrl' maximum length of a content URL is 512 characters.");
    }

    out.contentUrl = options.contentUrl;
  }

  if (options.requestAgent) {
    if (!isString(options.requestAgent)) {
      throw new Error("'options.requestAgent' expected a string value");
    }

    out.requestAgent = options.requestAgent;
  }

  if (options.serverSideVerificationOptions) {
    if (!isObject(options.serverSideVerificationOptions)) {
      throw new Error(
        "'options.serverSideVerificationOptions' expected an object of key/value pairs",
      );
    }

    const ssvOptions = options.serverSideVerificationOptions;

    if (ssvOptions.userId && !isString(ssvOptions.userId)) {
      throw new Error("'options.serverSideVerificationOptions.userId' expected a string value");
    }

    if (ssvOptions.customData && !isString(ssvOptions.customData)) {
      throw new Error("'options.serverSideVerificationOptions.customData' expected a string value");
    }

    out.serverSideVerificationOptions = options.serverSideVerificationOptions;
  }

  if (options.customTargeting) {
    if (!isObject(options.customTargeting)) {
      throw new Error("'options.customTargeting' expected an object of key/value pairs");
    }
    out.customTargeting = options.customTargeting;
  }

  if (options.publisherProvidedId) {
    if (!isString(options.publisherProvidedId)) {
      throw new Error("'options.publisherProvidedId' expected a string value");
    }
    out.publisherProvidedId = options.publisherProvidedId;
  }

  if (!isUndefined(options?.adChoicesPlacement)) {
    if (!isNumber(options.adChoicesPlacement)) {
      throw new Error("'options.adChoicesPlacement' expected a number value");
    }
    out.adChoicesPlacement = options.adChoicesPlacement;
  }

  if (!isUndefined(options?.aspectRatio)) {
    if (!isNumber(options.aspectRatio)) {
      throw new Error("'options.aspectRatio' expected a number value");
    }
    out.aspectRatio = options.aspectRatio;
  }

  if (!isUndefined(options?.startVideoMuted)) {
    if (!isBoolean(options.startVideoMuted)) {
      throw new Error("'options.startVideoMuted' expected a boolean value");
    }
    out.startVideoMuted = options.startVideoMuted;
  }

  if (!isUndefined(options?.customControlsRequested)) {
    if (!isBoolean(options.customControlsRequested)) {
      throw new Error("'options.customControlsRequested' expected a boolean value");
    }
    out.customControlsRequested = options.customControlsRequested;
  }

  return out;
}
