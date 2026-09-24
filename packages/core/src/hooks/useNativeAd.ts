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

import { useCallback, useEffect, useRef, useState } from 'react';
import useDeepCompareEffect from 'use-deep-compare-effect';

import { NativeAd } from '../ads/native-ad/NativeAd';
import type { AdError } from '../types/AdError';
import type { NativeAdRequestOptions } from '../types/NativeAdRequestOptions';

/**
 * Options object accepted by `useNativeAd`.
 *
 * Options-form only: there is no positional overload.
 */
export type UseNativeAdOptions = {
  /**
   * The ad unit to load.
   *
   * `null` means there is no ad unit yet, so no request is issued and `status`
   * stays `'idle'`. Useful when the unit arrives from remote config. Changing
   * this value, including to or from `null`, destroys any owned `NativeAd`.
   */
  adUnitId: string | null;
  /**
   * Request options forwarded to `NativeAd.createForAdRequest`. Changing them
   * destroys any owned `NativeAd` and, when `autoLoad` is true, loads again.
   */
  requestOptions?: NativeAdRequestOptions;
  /**
   * Controls **automatic** loading. Defaults to `true`.
   *
   * Set it to `false` to wait for something the load depends on, such as
   * consent or SDK initialization; the hook loads as soon as it flips true.
   * Turning it back off stops future automatic loads. It does not destroy the
   * ad and does not cancel a load already in flight, because neither platform
   * exposes load cancellation.
   *
   * An explicit `retry()` still works while `autoLoad` is false.
   */
  autoLoad?: boolean;
};

/**
 * Where the native ad request is right now. Exactly one value applies at a time.
 *
 * Words match the fullscreen options-form vocabulary where they apply to a
 * load-only surface: `'idle'`, `'loading'`, `'loaded'`, `'no-fill'`, `'error'`.
 * There is no `'showing'` / `'closed'` — native ads are rendered in-tree, not
 * presented as a fullscreen overlay.
 *
 * `'no-fill'` is not a failure. Load-phase `no-fill` and `mediation-no-fill`
 * both land here, matching `useFullScreenAd` / `MultiFormatAdRequest`.
 */
export type UseNativeAdStatus = 'idle' | 'loading' | 'loaded' | 'no-fill' | 'error';

type UseNativeAdResultBase = {
  /**
   * The automatic-load policy the hook is acting on, after the default is
   * applied. Echoed so `'idle'` can be interpreted against the current policy.
   */
  autoLoad: boolean;
  /**
   * Alias for an explicit load, named for the call site it is written at:
   * retrying after `'error'` or `'no-fill'`. Also used for the first load when
   * `autoLoad` is false. Automatic loading never retries on its own.
   *
   * Concurrent calls with the same request identity coalesce onto one
   * in-flight `createForAdRequest`, so StrictMode double effects do not burn
   * two ads.
   */
  retry: () => void;
  /**
   * Destroys the owned `NativeAd` (if any) and returns `status` to `'idle'`.
   * Does not issue a new request; call `retry()` to load again.
   */
  destroy: () => void;
};

type UseNativeAdOutcome = {
  [Status in UseNativeAdStatus]: {
    status: Status;
    nativeAd: Status extends 'loaded' ? NativeAd : null;
    error: Status extends 'no-fill' | 'error' ? AdError : null;
  };
}[UseNativeAdStatus];

/**
 * Result of `useNativeAd`, discriminated by `status`.
 *
 * A `'no-fill'` populates `error` because the platform delivers one. Other
 * failures use `'error'`. Every other status carries `error: null`.
 */
export type UseNativeAdResult = UseNativeAdResultBase & UseNativeAdOutcome;

type NativeAdHookState = {
  status: UseNativeAdStatus;
  nativeAd: NativeAd | null;
  error: AdError | null;
};

const initialState: NativeAdHookState = {
  status: 'idle',
  nativeAd: null,
  error: null,
};

function isLoadNoFill(error: AdError): boolean {
  return (
    (error.reason === 'no-fill' || error.reason === 'mediation-no-fill') && error.phase === 'load'
  );
}

/**
 * React Hook for Native Ads.
 *
 * Owns the `NativeAd` lifecycle so callers do not leak inventory when a
 * component unmounts before `createForAdRequest` resolves, or when the ad unit
 * / request identity changes. Late resolutions after cleanup destroy the
 * returned ad and never publish it.
 *
 * Loads as soon as it can, unless `autoLoad` is `false`. Read `status` for the
 * request's current position; `nativeAd` is non-null only when `status` is
 * `'loaded'`.
 *
 * #### Example
 *
 * ```jsx
 * const { status, nativeAd, retry } = useNativeAd({
 *   adUnitId: TestIds.NATIVE,
 *   autoLoad: consentReady,
 * });
 *
 * if (status === 'loaded' && nativeAd) {
 *   return <NativeAdView nativeAd={nativeAd} />;
 * }
 * if (status === 'error' || status === 'no-fill') {
 *   return <Button title="Retry" onPress={retry} />;
 * }
 * return null;
 * ```
 */
export function useNativeAd(options: UseNativeAdOptions): UseNativeAdResult {
  const autoLoad = options.autoLoad ?? true;
  const { adUnitId } = options;
  const requestOptions = options.requestOptions ?? {};

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<NativeAdHookState>(initialState);
  const nativeAdRef = useRef<NativeAd | null>(null);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const inflightRef = useRef<Promise<void> | null>(null);
  const inflightSignatureRef = useRef<string | null>(null);

  const requestSignature = JSON.stringify({ adUnitId, requestOptions }, (_key, value: unknown) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = (value as Record<string, unknown>)[key];
        return sorted;
      }, {});
  });
  const requestSignatureRef = useRef(requestSignature);
  requestSignatureRef.current = requestSignature;

  const destroyHeld = useCallback(() => {
    const held = nativeAdRef.current;
    nativeAdRef.current = null;
    held?.destroy();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      inflightRef.current = null;
      inflightSignatureRef.current = null;
      destroyHeld();
    };
  }, [destroyHeld]);

  const load = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }
    const unitId = optionsRef.current.adUnitId;
    if (unitId === null) {
      return;
    }

    const flightSignature = requestSignatureRef.current;
    if (inflightRef.current && inflightSignatureRef.current === flightSignature) {
      return;
    }

    const flightGeneration = generationRef.current;
    inflightSignatureRef.current = flightSignature;

    destroyHeld();
    setState({ status: 'loading', nativeAd: null, error: null });

    let flight: Promise<void>;
    try {
      flight = NativeAd.createForAdRequest(unitId, optionsRef.current.requestOptions)
        .then(ad => {
          if (
            !mountedRef.current ||
            flightGeneration !== generationRef.current ||
            requestSignatureRef.current !== flightSignature
          ) {
            ad.destroy();
            return;
          }
          nativeAdRef.current = ad;
          setState({ status: 'loaded', nativeAd: ad, error: null });
        })
        .catch((caught: unknown) => {
          if (
            !mountedRef.current ||
            flightGeneration !== generationRef.current ||
            requestSignatureRef.current !== flightSignature
          ) {
            return;
          }
          const error = caught as AdError;
          setState({
            status: isLoadNoFill(error) ? 'no-fill' : 'error',
            nativeAd: null,
            error,
          });
        })
        .finally(() => {
          if (inflightRef.current === flight) {
            inflightRef.current = null;
            inflightSignatureRef.current = null;
          }
        });
    } catch (caught: unknown) {
      inflightSignatureRef.current = null;
      const error = caught as AdError;
      setState({
        status: isLoadNoFill(error) ? 'no-fill' : 'error',
        nativeAd: null,
        error,
      });
      return;
    }

    inflightRef.current = flight;
  }, [destroyHeld]);

  const retry = useCallback(() => {
    load();
  }, [load]);

  const destroy = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }
    generationRef.current += 1;
    inflightRef.current = null;
    inflightSignatureRef.current = null;
    destroyHeld();
    setState(initialState);
  }, [destroyHeld]);

  // Identity supersession only. Changing `adUnitId` or `requestOptions`
  // content invalidates any in-flight load so a late resolve destroys that
  // NativeAd instead of publishing it. `autoLoad` is policy, not identity —
  // it is intentionally not a dependency here (mirrors `useFullScreenAd`).
  useDeepCompareEffect(() => {
    generationRef.current += 1;
    inflightRef.current = null;
    inflightSignatureRef.current = null;
    destroyHeld();
    setState(initialState);
  }, [adUnitId, requestOptions, destroyHeld]);

  // Automatic loading. Covers mount, a new request identity, and `autoLoad`
  // flipping true. Flipping it false only gates future automatic loads — it
  // does not destroy a held ad and does not cancel a load already in flight.
  useEffect(() => {
    if (!autoLoad || adUnitId === null) {
      return;
    }
    if (nativeAdRef.current || inflightRef.current) {
      return;
    }
    load();
  }, [autoLoad, adUnitId, requestSignature, load]);

  return {
    ...state,
    autoLoad,
    retry,
    destroy,
  } as UseNativeAdResult;
}
