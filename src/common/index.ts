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

import { Platform } from 'react-native';
import { isString } from './validate';

export * from './path';
export * from './promise';
export * from './validate';

export { ReferenceBase } from './ReferenceBase';

export function isError(value: unknown) {
  if (Object.prototype.toString.call(value) === '[object Error]') {
    return true;
  }

  return value instanceof Error;
}

export function hasOwnProperty(target: unknown, property: PropertyKey) {
  return Object.hasOwnProperty.call(target, property);
}

/**
 * Remove a trailing forward slash from a string if it exists
 *
 * @param string
 * @returns {*}
 */
export function stripTrailingSlash(string: string) {
  if (!isString(string)) {
    return string;
  }
  return string.endsWith('/') ? string.slice(0, -1) : string;
}

export const isIOS = Platform.OS === 'ios';

export const isAndroid = Platform.OS === 'android';

export function tryJSONParse(string: string) {
  try {
    return string && JSON.parse(string);
  } catch (jsonError) {
    return string;
  }
}

export function tryJSONStringify(data: unknown) {
  try {
    return JSON.stringify(data);
  } catch (jsonError) {
    return null;
  }
}
