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

import { isArray, isObject, isString, isUndefined } from './common';
import type {
  CustomNativeAdRequestOptions,
  CustomNativeClickHandling,
} from './types/CustomNativeAd';
import { validateAdRequestOptions } from './validateAdRequestOptions';

/**
 * Validates a list of Ad Manager custom native format IDs.
 *
 * IDs are returned verbatim (no trimming or case changes): they must match Ad Manager exactly.
 */
export function validateCustomFormatIds(value: unknown, path: string): string[] {
  if (!isArray(value) || (value as unknown[]).length === 0) {
    throw new Error(`'${path}' expected a non-empty array of strings`);
  }
  const ids = value as unknown[];
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (!isString(id) || id.trim().length === 0) {
      throw new Error(`'${path}[${index}]' expected a non-empty string`);
    }
    if (seen.has(id)) {
      throw new Error(`'${path}' must not contain duplicates`);
    }
    seen.add(id);
  });
  return [...(ids as string[])];
}

export function validateCustomNativeAdRequestOptions(
  options: CustomNativeAdRequestOptions,
): CustomNativeAdRequestOptions & { clickHandling: CustomNativeClickHandling } {
  if (!isObject(options) || isArray(options)) {
    throw new Error("'options' expected an object value");
  }
  const base = validateAdRequestOptions(options);
  const out: CustomNativeAdRequestOptions & { clickHandling: CustomNativeClickHandling } = {
    ...base,
    customFormatIds: validateCustomFormatIds(options.customFormatIds, 'options.customFormatIds'),
    clickHandling: 'app',
  };

  // Runtime guard: types only admit 'app' | 'sdk', but JS callers can pass anything.
  const clickHandling = options.clickHandling as string | undefined;
  if (!isUndefined(clickHandling)) {
    if (clickHandling !== 'app' && clickHandling !== 'sdk') {
      throw new Error("'options.clickHandling' expected 'app' or 'sdk'");
    }
    out.clickHandling = clickHandling;
  }

  return out;
}
