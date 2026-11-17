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

import { isBoolean, isNumber, isObject, isOneOf, isPropertySet, isUndefined } from './common';
import { validateAdRequestOptions } from './validateAdRequestOptions';
import type { SwipeableInterstitialAdRequestOptions } from './types/SwipeableInterstitialAdRequestOptions';

const SWIPE_DIRECTIONS = ['left', 'right', 'up', 'down'] as const;

export function validateSwipeableInterstitialAdRequestOptions(
  options?: SwipeableInterstitialAdRequestOptions,
) {
  const base = validateAdRequestOptions(options);

  if (isUndefined(options)) {
    return base;
  }

  if (!isObject(options)) {
    throw new Error("'options' expected an object value");
  }

  const out: SwipeableInterstitialAdRequestOptions = { ...base };

  if (isPropertySet(options, 'maxScreenHoldDurationSeconds')) {
    if (!isNumber(options.maxScreenHoldDurationSeconds)) {
      throw new Error("'options.maxScreenHoldDurationSeconds' expected a number value.");
    }
    if (options.maxScreenHoldDurationSeconds < 0) {
      throw new Error("'options.maxScreenHoldDurationSeconds' expected a non-negative number.");
    }
    out.maxScreenHoldDurationSeconds = options.maxScreenHoldDurationSeconds;
  }

  if (isPropertySet(options, 'adSize')) {
    if (!isObject(options.adSize)) {
      throw new Error("'options.adSize' expected an object with width and height.");
    }
    const adSize: { width: number; height: number } = options.adSize as {
      width: number;
      height: number;
    };
    const { width, height } = adSize;
    if (!isNumber(width) || !isNumber(height) || width <= 0 || height <= 0) {
      throw new Error("'options.adSize' expected positive numeric width and height.");
    }
    out.adSize = { width, height };
  }

  if (isPropertySet(options, 'requestCustomClickGesture')) {
    if (!isBoolean(options.requestCustomClickGesture)) {
      throw new Error("'options.requestCustomClickGesture' expected a boolean value.");
    }
    out.requestCustomClickGesture = options.requestCustomClickGesture;
  }

  if (isPropertySet(options, 'customClickSwipeGesture')) {
    if (!isObject(options.customClickSwipeGesture)) {
      throw new Error("'options.customClickSwipeGesture' expected an object value.");
    }
    const gesture: NonNullable<SwipeableInterstitialAdRequestOptions['customClickSwipeGesture']> =
      options.customClickSwipeGesture as NonNullable<
        SwipeableInterstitialAdRequestOptions['customClickSwipeGesture']
      >;
    const { direction, tapsAllowed } = gesture;
    if (!isOneOf(direction, [...SWIPE_DIRECTIONS])) {
      throw new Error(
        "'options.customClickSwipeGesture.direction' expected one of left, right, up, down.",
      );
    }
    if (isPropertySet(gesture, 'tapsAllowed')) {
      if (!isBoolean(tapsAllowed)) {
        throw new Error("'options.customClickSwipeGesture.tapsAllowed' expected a boolean value.");
      }
    }
    out.customClickSwipeGesture = {
      direction,
      ...(isPropertySet(gesture, 'tapsAllowed') ? { tapsAllowed } : {}),
    };
  }

  return out;
}
