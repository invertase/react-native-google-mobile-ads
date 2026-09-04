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

import { MultiFormatAdRequest } from '../ads/MultiFormatAdRequest';
import { NativeError } from '../internal/NativeError';
import type { AdError } from '../types/AdError';
import type {
  MultiFormatAdConfig,
  MultiFormatAdHandle,
  MultiFormatLoadResult,
} from '../types/MultiFormatAd';
import type { ResponseInfo } from '../types/ResponseInfo';

/**
 * Arguments to `useMultiFormatAd`: the shared request config plus its
 * automatic-load policy.
 *
 * One object, so the hook can grow new fields without a signature change, and
 * so it accepts exactly what `MultiFormatAdRequest.create` accepts.
 */
export type UseMultiFormatAdOptions = MultiFormatAdConfig & {
  /**
   * Controls **automatic** loading. Defaults to `true`.
   *
   * Set it to `false` while something the load depends on is still resolving,
   * such as consent or SDK initialization; the hook loads as soon as it flips
   * true. An explicit `load()` still works while `autoLoad` is false.
   */
  autoLoad?: boolean;
};

/**
 * Members present on every arm, so they are callable without narrowing.
 *
 * `load`, `retry`, and `release` keep the same identity for the life of the
 * hook instance, the same guarantee `usePooledAd` gives. The options object is
 * sampled when `load` runs (a ref updated each render), so a fresh inline
 * object each render — including `MultiFormatAdPresets.*(...)` called in the
 * render body — does not change `load`'s identity or re-fire an effect that
 * depends only on `[load]`. See the v17 reference "Callback identity and
 * argument freshness".
 */
type UseMultiFormatAdResultBase = {
  /**
   * The automatic-load policy the hook is acting on, after the default is
   * applied. Echoed so a permanent `'idle'` is diagnosable without putting
   * configuration inside the status union.
   */
  autoLoad: boolean;
  /**
   * The ad server's record of the most recent response, or `null` before the
   * first one. Populated on every outcome including `'no-fill'`, because a
   * response record is not a failure and so does not belong in `errors`.
   */
  responseInfo: ResponseInfo | null;
  /**
   * Issues the request and updates hook state. Never rejects: it resolves into
   * a `MultiFormatLoadResult` mirroring the state it just set, so the return
   * value is optional convenience for callers that want to load and render in
   * one handler, exactly like `usePooledAd().poll()`.
   *
   * Concurrent calls coalesce onto the in-flight load, same parity as
   * `usePooledAd().poll()`, so automatic loading and a manual call in the same
   * tick — or React StrictMode in development double-invoking an effect —
   * cannot issue two network loads from this hook instance. Joiners share the
   * promise started with the options current when the flight began; after it
   * settles, the next call samples the latest arguments.
   *
   * This library performed the load, so the observed time starts at hand-off
   * and aging is only possible afterwards, while the hook holds the handles. A
   * later `load()` destroys the handles from the previous one.
   */
  load: () => Promise<MultiFormatLoadResult>;
  /**
   * Fire-and-forget `load()`, for the call site it is named after: a retry
   * button on `'error'` or `'no-fill'`. Saves consumers writing their own
   * `useCallback` wrapper just to discard the promise.
   */
  retry: () => void;
  /**
   * Hands ownership of the current handles to the caller and clears hook state
   * to `{ status: 'idle', ads: [], errors: [] }` (among the current result
   * arms), so unmount cleanup will not destroy handles someone else now owns.
   * Returns an empty array when nothing is held. The caller then owns
   * `destroy()` and the staleness check on each handle: the policy timer lives
   * on the handle, not on the hook.
   *
   * Call `release()` before you `destroy()` handles yourself. While this hook
   * still owns them, do not call `handle.destroy()`: that leaves the hook able
   * to report `loaded` / `loaded-partial` with dead inventory (same ownership
   * rule as the inner `NativeAd` on a native arm).
   *
   * Ordering is guaranteed: calling `release()` immediately after `await
   * load()` returns the handles that load just produced, without waiting for a
   * render, so the implementation tracks them in a ref alongside state.
   */
  release: () => MultiFormatAdHandle[];
};

/**
 * Multi-format hook state, discriminated on `status`.
 *
 * Narrowing mirrors `MultiFormatLoadResult` for terminal arms: a `loaded` arm
 * cannot carry errors, a `no-fill` arm cannot carry handles or errors, and an
 * `error` arm cannot carry handles. `loaded-partial` is the arm where both
 * arrays are populated. Hook-only arms are `idle`, `loading`, and
 * `stale-by-policy`.
 */
export type UseMultiFormatAdResult = UseMultiFormatAdResultBase &
  (
    | { status: 'idle'; ads: never[]; errors: never[] }
    | { status: 'loading'; ads: MultiFormatAdHandle[]; errors: AdError[] }
    | { status: 'loaded'; ads: MultiFormatAdHandle[]; errors: never[] }
    | { status: 'loaded-partial'; ads: MultiFormatAdHandle[]; errors: AdError[] }
    | { status: 'no-fill'; ads: never[]; errors: never[] }
    | { status: 'error'; ads: never[]; errors: AdError[] }
    | { status: 'stale-by-policy'; ads: MultiFormatAdHandle[]; errors: AdError[] }
  );

/**
 * Status discriminant for `useMultiFormatAd`. Derived from
 * `UseMultiFormatAdResult` so the string union cannot drift from the result
 * arms.
 */
export type UseMultiFormatAdStatus = UseMultiFormatAdResult['status'];

type MultiFormatAdHookState = {
  status: UseMultiFormatAdStatus;
  ads: MultiFormatAdHandle[];
  errors: AdError[];
  responseInfo: ResponseInfo | null;
};

const initialMultiFormatAdState: MultiFormatAdHookState = {
  status: 'idle',
  ads: [],
  errors: [],
  responseInfo: null,
};

function toLoadResult(
  ads: MultiFormatAdHandle[],
  errors: AdError[],
  responseInfo: ResponseInfo | null,
): MultiFormatLoadResult {
  if (ads.length > 0 && errors.length === 0) {
    return { status: 'loaded', ads, errors: [] as never[], responseInfo };
  }
  if (ads.length > 0 && errors.length > 0) {
    return { status: 'loaded-partial', ads, errors, responseInfo };
  }
  if (errors.length === 0) {
    return { status: 'no-fill', ads: [] as never[], errors: [] as never[], responseInfo };
  }
  return { status: 'error', ads: [] as never[], errors, responseInfo };
}

function configError(message: string): AdError {
  const error = NativeError.fromEvent(
    { code: 'invalid-request', message },
    'googleMobileAds/multi-format',
  ) as AdError;
  error.reason = 'invalid-request';
  error.phase = 'load';
  return error;
}

/**
 * Multi-format request as a hook. One request, several eligible formats, one
 * winner (`requestCount` 1 in v1).
 *
 * Ownership, release ordering, never-reject load, load coalescing, and
 * `stale-by-policy` semantics match `usePooledAd`.
 */
export function useMultiFormatAd(options: UseMultiFormatAdOptions): UseMultiFormatAdResult {
  const autoLoad = options.autoLoad ?? true;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<MultiFormatAdHookState>(initialMultiFormatAdState);
  const adsRef = useRef<MultiFormatAdHandle[]>([]);
  const unsubsRef = useRef<Array<() => void>>([]);
  const inflightRef = useRef<Promise<MultiFormatLoadResult> | null>(null);
  const autoLoadedForRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      unsubsRef.current.forEach(unsub => {
        unsub();
      });
      unsubsRef.current = [];
      adsRef.current.forEach(handle => {
        handle.destroy();
      });
      adsRef.current = [];
    };
  }, []);

  const clearHeldAds = useCallback((destroy: boolean) => {
    unsubsRef.current.forEach(unsub => {
      unsub();
    });
    unsubsRef.current = [];
    const previous = adsRef.current;
    adsRef.current = [];
    if (destroy) {
      previous.forEach(handle => {
        handle.destroy();
      });
    }
    return previous;
  }, []);

  const watchStaleness = useCallback((handles: MultiFormatAdHandle[], priorErrors: AdError[]) => {
    unsubsRef.current.forEach(unsub => {
      unsub();
    });
    unsubsRef.current = handles.map(handle =>
      handle.onStaleByPolicy(() => {
        if (!mountedRef.current) {
          return;
        }
        // Destroy unrendered inventory; leave already-held handles in the array
        // only when still considered showable — for count-1, drop the stale one.
        const remaining = adsRef.current.filter(candidate => {
          if (candidate.adId !== handle.adId) {
            return true;
          }
          handle.destroy();
          return false;
        });
        adsRef.current = remaining;
        setState(previous => ({
          status: remaining.length === 0 ? 'stale-by-policy' : previous.status,
          ads: remaining,
          errors: priorErrors,
          responseInfo: previous.responseInfo,
        }));
      }),
    );
  }, []);

  const load = useCallback((): Promise<MultiFormatLoadResult> => {
    if (inflightRef.current) {
      return inflightRef.current;
    }

    setState(previousState => ({ ...previousState, status: 'loading' }));

    const flight = (async (): Promise<MultiFormatLoadResult> => {
      clearHeldAds(true);
      const {
        adUnitId,
        requestOptions,
        autoLoad: _ignored,
        ...rest
      } = optionsRef.current as UseMultiFormatAdOptions & Record<string, unknown>;
      void _ignored;
      void rest;

      let request: MultiFormatAdRequest;
      try {
        request = MultiFormatAdRequest.create({ adUnitId, requestOptions });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Invalid multi-format config';
        const mapped = configError(message);
        const result = toLoadResult([], [mapped], null);
        if (mountedRef.current) {
          setState(result);
        }
        return result;
      }

      const { ads, errors, responseInfo } = await request.load();

      if (!mountedRef.current) {
        ads.forEach(handle => {
          handle.destroy();
        });
        return toLoadResult([], [], responseInfo);
      }

      adsRef.current = ads;
      watchStaleness(ads, errors);
      const result = toLoadResult(ads, errors, responseInfo);
      setState(result);
      return result;
    })().finally(() => {
      inflightRef.current = null;
    });

    inflightRef.current = flight;
    return flight;
  }, [clearHeldAds, watchStaleness]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const release = useCallback((): MultiFormatAdHandle[] => {
    const released = clearHeldAds(false);
    setState(initialMultiFormatAdState);
    return released;
  }, [clearHeldAds]);

  // Automatic loading. Keyed by ad unit so it fires once per unit, covering
  // mount, a new unit, and `autoLoad` flipping true, without re-firing on every
  // fresh inline options object.
  const { adUnitId } = options;
  useEffect(() => {
    if (!autoLoad || autoLoadedForRef.current === adUnitId) {
      return;
    }
    autoLoadedForRef.current = adUnitId;
    void load();
  }, [adUnitId, autoLoad, load]);

  return {
    ...state,
    autoLoad,
    load,
    retry,
    release,
  } as UseMultiFormatAdResult;
}
