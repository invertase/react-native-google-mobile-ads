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

import { isArray, isNumber, isObject, isString, isUndefined } from './common';
import { getAdCapabilities } from './capabilities/getAdCapabilities';
import { resolveStalenessWindow } from './internal/adExpiry';
import { NativeError } from './internal/NativeError';
import type { AdError, AdErrorReason } from './types/AdError';
import { AdFormat } from './types/AdFormat';
import type { AdPoolConfig, AdPoolDegradeReason, AdPoolResolvedConfig } from './types/AdPool';
import type { FullscreenAdFormat } from './types/FullscreenAdFormat';
import { validateAdRequestOptions } from './validateAdRequestOptions';

/** Google-selected PreloadConfiguration default when `bufferSize` is omitted. */
export const GOOGLE_DEFAULT_POOL_BUFFER_SIZE = 2;

/**
 * Documented classic app-wide managed-pool default (P-poolcap-ios = 6).
 * Not reported on `maxManagedPoolAds` (always null: server-delivered).
 */
export const DOCUMENTED_APP_WIDE_POOL_CAP = 6;

const FULLSCREEN_FORMATS: ReadonlySet<string> = new Set([
  AdFormat.APP_OPEN,
  AdFormat.INTERSTITIAL,
  AdFormat.REWARDED,
  AdFormat.REWARDED_INTERSTITIAL,
]);

const DISPLAY_FORMATS: ReadonlySet<string> = new Set([AdFormat.BANNER, AdFormat.NATIVE]);

export function createPoolAdError(reason: AdErrorReason, message: string): AdError {
  const error = NativeError.fromEvent({ code: reason, message }, 'googleMobileAds/pool') as AdError;
  error.reason = reason;
  error.phase = 'load';
  return error;
}

function isFullscreenFormat(format: string): format is FullscreenAdFormat {
  return FULLSCREEN_FORMATS.has(format);
}

/**
 * Validates an AdPoolConfig for classic fullscreen SDK-managed pools (FEAT-05).
 *
 * Hard-errors on impossible configs. Loud-degrades are reserved for display
 * emulation (FEAT-06); fullscreen buffer sizes are not coerced.
 */
export function validateAdPoolConfig(config: AdPoolConfig): AdPoolResolvedConfig {
  if (!isObject(config) || isArray(config)) {
    throw createPoolAdError('invalid-request', "'config' expected an object");
  }
  if (!isString(config.poolId) || config.poolId.length === 0) {
    throw createPoolAdError('invalid-request', "'poolId' expected a non-empty string");
  }
  if (!isString(config.adUnitId) || config.adUnitId.length === 0) {
    throw createPoolAdError('invalid-request', "'adUnitId' expected a non-empty string");
  }
  if (!isArray(config.formats) || config.formats.length === 0) {
    throw createPoolAdError('invalid-request', "'formats' expected a non-empty array");
  }

  const formats = config.formats as string[];
  const seen = new Set<string>();
  for (let i = 0; i < formats.length; i++) {
    const format = formats[i];
    if (!isString(format)) {
      throw createPoolAdError('invalid-request', `'formats[${i}]' expected a string AdFormat`);
    }
    if (seen.has(format)) {
      throw createPoolAdError('invalid-request', "'formats' must not contain duplicates");
    }
    seen.add(format);
  }

  const hasFullscreen = formats.some(f => FULLSCREEN_FORMATS.has(f));
  const hasDisplay = formats.some(f => DISPLAY_FORMATS.has(f));
  if (hasFullscreen && hasDisplay) {
    throw createPoolAdError(
      'invalid-request',
      "'formats' cannot mix fullscreen and display formats in one pool",
    );
  }
  if (hasDisplay) {
    throw createPoolAdError(
      'pool/format-preload-unsupported',
      'Display (banner/native) pools require emulated preload (FEAT-06); classic SDK preloader is fullscreen-only',
    );
  }
  if (!hasFullscreen) {
    throw createPoolAdError(
      'pool/format-preload-unsupported',
      "'formats' expected a fullscreen AdFormat for classic preload pools",
    );
  }
  if (formats.length !== 1 || !isFullscreenFormat(formats[0])) {
    throw createPoolAdError(
      'invalid-request',
      'Classic fullscreen pools accept exactly one fullscreen format',
    );
  }

  const format = formats[0];
  const caps = getAdCapabilities();
  const formatSupport = caps.fullscreenPreloadFormats[format];
  if (formatSupport === 'unavailable') {
    throw createPoolAdError(
      'pool/format-preload-unsupported',
      `Format '${format}' is unavailable for SDK-managed preload on backend '${caps.backend}'`,
    );
  }

  if (!isUndefined(config.bufferSize)) {
    if (
      !isNumber(config.bufferSize) ||
      !Number.isFinite(config.bufferSize) ||
      config.bufferSize < 1
    ) {
      throw createPoolAdError(
        'invalid-request',
        "'bufferSize' expected a number >= 1 when provided",
      );
    }
  }

  if (!isUndefined(config.pollTimeoutMillis)) {
    if (
      !isNumber(config.pollTimeoutMillis) ||
      !Number.isFinite(config.pollTimeoutMillis) ||
      config.pollTimeoutMillis < 0
    ) {
      throw createPoolAdError(
        'invalid-request',
        "'pollTimeoutMillis' expected a non-negative number when provided",
      );
    }
  }

  if (!isUndefined(config.stalenessWindowMillis)) {
    if (
      !isNumber(config.stalenessWindowMillis) ||
      !Number.isFinite(config.stalenessWindowMillis) ||
      config.stalenessWindowMillis <= 0
    ) {
      throw createPoolAdError(
        'invalid-request',
        "'stalenessWindowMillis' expected a positive number when provided",
      );
    }
  }

  if (!isUndefined(config.adServer)) {
    const adServer = config.adServer as string;
    if (adServer !== 'ad-manager' && adServer !== 'admob') {
      throw createPoolAdError(
        'invalid-request',
        "'adServer' expected 'ad-manager' or 'admob' when provided",
      );
    }
  }

  const requestOptions = validateAdRequestOptions(config.requestOptions);
  const { stalenessWindowMillis, stalenessWindowSource } = resolveStalenessWindow({
    stalenessWindowMillis: config.stalenessWindowMillis,
    format: format === AdFormat.APP_OPEN ? 'app_open' : 'other',
  });

  const requestedBufferSize = config.bufferSize;
  // Fullscreen: do not coerce buffer size (Decision 2026-08-19). Omitted → Google default 2.
  const effectiveBufferSize =
    typeof requestedBufferSize === 'number' ? requestedBufferSize : GOOGLE_DEFAULT_POOL_BUFFER_SIZE;

  const degradeReasons: AdPoolDegradeReason[] = [];

  const resolved: AdPoolResolvedConfig = {
    ...config,
    formats: [format],
    requestOptions,
    requestedBufferSize,
    effectiveBufferSize,
    effectiveStalenessWindowMillis: stalenessWindowMillis,
    effectiveStalenessWindowSource: stalenessWindowSource,
    degraded: degradeReasons.length > 0,
    degradeReasons,
  };

  return resolved;
}
