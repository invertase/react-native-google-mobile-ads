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

import type {
  AdPoolConfig,
  AdPoolPresetOverrides,
  DisplayPoolId,
  FullscreenPoolId,
} from '../types/AdPool';
import type { FullscreenAdFormat } from '../types/FullscreenAdFormat';
import { AdFormat } from '../types/AdFormat';

type DisplayPresetConfig<TAdUnitId extends string> = Omit<
  AdPoolConfig,
  'poolId' | 'formats' | 'adUnitId'
> & {
  poolId: DisplayPoolId<TAdUnitId>;
  formats: [AdFormat.NATIVE, AdFormat.BANNER];
  adUnitId: TAdUnitId;
};

type FullscreenPresetConfig<TFormat extends FullscreenAdFormat, TAdUnitId extends string> = Omit<
  AdPoolConfig,
  'poolId' | 'formats' | 'adUnitId'
> & {
  poolId: FullscreenPoolId<TFormat, TAdUnitId>;
  formats: [TFormat];
  adUnitId: TAdUnitId;
};

type DisplayPresetConfigCustomId<TAdUnitId extends string> = Omit<
  AdPoolConfig,
  'formats' | 'adUnitId'
> & {
  formats: [AdFormat.NATIVE, AdFormat.BANNER];
  adUnitId: TAdUnitId;
};

type FullscreenPresetConfigCustomId<
  TFormat extends FullscreenAdFormat,
  TAdUnitId extends string,
> = Omit<AdPoolConfig, 'formats' | 'adUnitId'> & {
  formats: [TFormat];
  adUnitId: TAdUnitId;
};

/**
 * Fullscreen buffer sized for this backend.
 *
 * Rewarded interstitial is accepted in the type for cross-platform presets,
 * but `AdPools.create` hard-errors on Android classic when
 * `fullscreenPreloadFormats[REWARDED_INTERSTITIAL]` is `unavailable` (reason
 * `'pool/format-preload-unsupported'`). Check that capability before create,
 * or catch the error.
 *
 * Default `bufferSize: 1`. Google recommends 2 per preload ID; pass
 * `{ bufferSize: 2 }` to ask for that depth. The app-wide cap that depth
 * competes for is server-delivered (`maxManagedPoolAds` reports `null`).
 * Depth 1 stays the default so create succeeds under a tight app-wide cap;
 * publishers that want Google's recommended depth opt in explicitly.
 *
 * Takes the same `AdPoolPresetOverrides` bag as `display`, including
 * `stalenessWindowMillis`. Pass request options as `{ requestOptions }`.
 * `formats` and `adUnitId` are not overridable: those come from the
 * positional parameters.
 */
function fullscreen<TFormat extends FullscreenAdFormat, TAdUnitId extends string>(
  format: TFormat,
  adUnitId: TAdUnitId,
  options: AdPoolPresetOverrides & { poolId: string },
): FullscreenPresetConfigCustomId<TFormat, TAdUnitId>;
function fullscreen<TFormat extends FullscreenAdFormat, TAdUnitId extends string>(
  format: TFormat,
  adUnitId: TAdUnitId,
  options?: AdPoolPresetOverrides,
): FullscreenPresetConfig<TFormat, TAdUnitId>;
function fullscreen<TFormat extends FullscreenAdFormat, TAdUnitId extends string>(
  format: TFormat,
  adUnitId: TAdUnitId,
  options?: AdPoolPresetOverrides,
): AdPoolConfig {
  return {
    poolId: `fullscreen-${format}-${adUnitId}`,
    formats: [format],
    adUnitId,
    bufferSize: 1,
    ...options,
  };
}

/**
 * Display pool (native + banner). Resolves to an emulated depth-1 pool
 * where no SDK preloader exists (`'pool/emulated-no-sdk-preloader'`).
 *
 * `formats` and `adUnitId` are fixed by this preset; override buffer, request
 * options, banner sizes, or `poolId` via `AdPoolPresetOverrides`.
 */
function display<TAdUnitId extends string>(
  adUnitId: TAdUnitId,
  options: AdPoolPresetOverrides & { poolId: string },
): DisplayPresetConfigCustomId<TAdUnitId>;
function display<TAdUnitId extends string>(
  adUnitId: TAdUnitId,
  options?: AdPoolPresetOverrides,
): DisplayPresetConfig<TAdUnitId>;
function display<TAdUnitId extends string>(
  adUnitId: TAdUnitId,
  options?: AdPoolPresetOverrides,
): AdPoolConfig {
  return {
    poolId: `display-${adUnitId}`,
    formats: [AdFormat.NATIVE, AdFormat.BANNER],
    adUnitId,
    bufferSize: 1,
    ...options,
  };
}

/**
 * Backend-aware pool config presets. Return plain AdPoolConfig objects;
 * AdPools.create validates them the same as hand-written config.
 *
 * Default `poolId` values are template literals (`display-${unit}`,
 * `fullscreen-${format}-${unit}`). Pass that same `poolId` (or the config
 * object) into `useAdPool` / `usePooledAd` so provider and consumer share one
 * typed id rather than hand-retyping the template.
 */
export const AdPoolPresets = {
  fullscreen,
  display,
} as const;
