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

import { isBoolean, isUndefined, isNumber } from './common';
import { validateAdRequestOptions } from './validateAdRequestOptions';
import type { NativeAdRequestOptions } from './types/NativeAdRequestOptions';

export function validateNativeAdRequestOptions(
  options?: NativeAdRequestOptions,
): NativeAdRequestOptions {
  const base = validateAdRequestOptions(options);
  const out: NativeAdRequestOptions = { ...base };

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

  return out;
}
