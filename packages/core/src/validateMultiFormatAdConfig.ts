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

import { BannerAdSize } from './BannerAdSize';
import { isArray, isNumber, isObject, isString, isUndefined } from './common';
import { AdFormat } from './types/AdFormat';
import type {
  MultiFormatAdConfig,
  MultiFormatAdFormat,
  MultiFormatAdRequestOptions,
} from './types/MultiFormatAd';
import type { MultiFormatBannerSize } from './types/MultiFormatBannerSize';
import { validateAdRequestOptions } from './validateAdRequestOptions';

const ALLOWED_FORMATS: ReadonlySet<string> = new Set([AdFormat.NATIVE, AdFormat.BANNER]);

const FIXED_BANNER_SIZES: ReadonlySet<string> = new Set([
  BannerAdSize.BANNER,
  BannerAdSize.FULL_BANNER,
  BannerAdSize.LARGE_BANNER,
  BannerAdSize.LEADERBOARD,
  BannerAdSize.MEDIUM_RECTANGLE,
  BannerAdSize.WIDE_SKYSCRAPER,
]);

const ILLEGAL_BANNER_SIZES: ReadonlySet<string> = new Set([
  'ANCHORED_ADAPTIVE_BANNER',
  'LARGE_ANCHORED_ADAPTIVE_BANNER',
  'INLINE_ADAPTIVE_BANNER',
  'FLUID',
]);

function isCustomSizeString(value: string): boolean {
  return /^[0-9]+x[0-9]+$/.test(value);
}

function assertBannerSize(size: unknown, index: number): MultiFormatBannerSize {
  if (isObject(size) && !isArray(size)) {
    const width = (size as { width?: unknown }).width;
    const height = (size as { height?: unknown }).height;
    if (!isNumber(width) || !isNumber(height) || width <= 0 || height <= 0) {
      throw new Error(
        `'requestOptions.bannerSizes[${index}]' expected { width, height } with positive numbers`,
      );
    }
    return { width, height };
  }

  if (!isString(size)) {
    throw new Error(
      `'requestOptions.bannerSizes[${index}]' expected a fixed GAM size string or { width, height }`,
    );
  }

  if (ILLEGAL_BANNER_SIZES.has(size)) {
    throw new Error(
      `'requestOptions.bannerSizes[${index}]' adaptive and FLUID sizes are illegal in multi-format requests`,
    );
  }

  if (FIXED_BANNER_SIZES.has(size) || isCustomSizeString(size)) {
    return size as MultiFormatBannerSize;
  }

  throw new Error(
    `'requestOptions.bannerSizes[${index}]' expected a fixed GAM size, "WxH", or { width, height }`,
  );
}

function normalizeBannerSize(size: MultiFormatBannerSize): string {
  if (typeof size === 'string') {
    return size;
  }
  return `${size.width}x${size.height}`;
}

/**
 * Validates and normalizes a multi-format request config.
 *
 * Hard-errors match the approved freeze: empty formats, banner without sizes,
 * illegal sizes, requestCount other than 1, banner without ad-manager, AdMob
 * unit ids when banner is requested.
 *
 * `bannerSizes` are normalized to wire strings (`BANNER`, `320x50`, …) for the
 * native bridge.
 */
export function validateMultiFormatAdConfig(config: MultiFormatAdConfig): {
  adUnitId: string;
  requestOptions: Omit<MultiFormatAdRequestOptions, 'bannerSizes' | 'formats' | 'requestCount'> & {
    formats: MultiFormatAdFormat[];
    bannerSizes?: string[];
    requestCount: 1;
  };
} {
  if (!isObject(config) || isArray(config)) {
    throw new Error("'config' expected an object");
  }
  if (!isString(config.adUnitId) || config.adUnitId.length === 0) {
    throw new Error("'adUnitId' expected a non-empty string");
  }

  const options = config.requestOptions;
  if (!isObject(options) || isArray(options)) {
    throw new Error("'requestOptions' expected an object");
  }

  if (!isArray(options.formats) || options.formats.length === 0) {
    throw new Error("'requestOptions.formats' expected a non-empty array");
  }

  const formats: MultiFormatAdFormat[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < options.formats.length; i++) {
    const format = options.formats[i];
    if (!isString(format) || !ALLOWED_FORMATS.has(format)) {
      throw new Error(
        `'requestOptions.formats[${i}]' expected '${AdFormat.NATIVE}' or '${AdFormat.BANNER}'`,
      );
    }
    if (seen.has(format)) {
      throw new Error(`'requestOptions.formats' must not contain duplicates`);
    }
    seen.add(format);
    formats.push(format);
  }

  // Runtime guard: types only admit `1`, but cast configs can smuggle other values.
  const requestCount = options.requestCount as number | undefined;
  if (!isUndefined(requestCount) && requestCount !== 1) {
    throw new Error("'requestOptions.requestCount' must be 1 in v1");
  }

  const wantsBanner = formats.includes(AdFormat.BANNER);
  const adServer = options.adServer as string | undefined;
  if (wantsBanner) {
    if (adServer !== 'ad-manager') {
      throw new Error(
        "'requestOptions.adServer' must be 'ad-manager' when formats includes banner",
      );
    }
    if (config.adUnitId.startsWith('ca-app-pub-')) {
      throw new Error(
        "'adUnitId' AdMob units cannot request banner in a multi-format AdLoader request",
      );
    }
    if (!isArray(options.bannerSizes) || options.bannerSizes.length === 0) {
      throw new Error(
        "'requestOptions.bannerSizes' expected a non-empty array when formats includes banner",
      );
    }
  } else if (!isUndefined(options.bannerSizes) && !isArray(options.bannerSizes)) {
    throw new Error("'requestOptions.bannerSizes' expected an array when provided");
  }

  if (!isUndefined(adServer) && adServer !== 'ad-manager') {
    throw new Error("'requestOptions.adServer' expected 'ad-manager' when provided");
  }

  const base = validateAdRequestOptions(options);
  const normalized: Omit<
    MultiFormatAdRequestOptions,
    'bannerSizes' | 'formats' | 'requestCount'
  > & {
    formats: MultiFormatAdFormat[];
    bannerSizes?: string[];
    requestCount: 1;
  } = {
    ...base,
    formats,
    requestCount: 1,
  };

  if (wantsBanner) {
    // bannerSizes non-empty array already enforced above when wantsBanner.
    const bannerSizes = options.bannerSizes as MultiFormatBannerSize[];
    normalized.adServer = 'ad-manager';
    normalized.bannerSizes = bannerSizes.map((size, index) =>
      normalizeBannerSize(assertBannerSize(size, index)),
    );
  }

  if (!isUndefined(options.stalenessWindowMillis)) {
    if (
      !isNumber(options.stalenessWindowMillis) ||
      !Number.isFinite(options.stalenessWindowMillis) ||
      options.stalenessWindowMillis <= 0
    ) {
      throw new Error("'requestOptions.stalenessWindowMillis' expected a positive number");
    }
    normalized.stalenessWindowMillis = options.stalenessWindowMillis;
  }

  return { adUnitId: config.adUnitId, requestOptions: normalized };
}
