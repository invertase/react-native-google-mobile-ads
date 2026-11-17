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

import { isObject, isOneOf, isUndefined } from './common';
import type { PictureInPictureAdShowOptions } from './types/PictureInPictureAdShowOptions';

const POSITIONS = ['default', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
const SCOPES = ['screen', 'application'];

export function validatePictureInPictureAdShowOptions(
  showOptions?: PictureInPictureAdShowOptions,
): PictureInPictureAdShowOptions {
  if (isUndefined(showOptions)) {
    return {};
  }
  if (!isObject(showOptions)) {
    throw new Error("'options' expected an object value.");
  }

  const options: PictureInPictureAdShowOptions = {};
  if ('position' in showOptions) {
    if (!isOneOf(showOptions.position, POSITIONS)) {
      throw new Error(
        "'options.position' expected one of default, topLeft, topRight, bottomLeft, bottomRight.",
      );
    }
    options.position = showOptions.position;
  }
  if ('presentationScope' in showOptions) {
    if (!isOneOf(showOptions.presentationScope, SCOPES)) {
      throw new Error("'options.presentationScope' expected one of screen, application.");
    }
    options.presentationScope = showOptions.presentationScope;
  }
  return options;
}