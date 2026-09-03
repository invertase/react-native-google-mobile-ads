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
 *
 * During `loading`, previously held handles and prior load errors may still be
 * present until the in-flight load settles and supersedes them.
 * `stale-by-policy` retains prior load `errors` and may still list
 * already-rendered handles.
 *
 * Status words follow the multi-format **load** vocabulary (`loading`,
 * `loaded`, `loaded-partial`), not the pool/poll vocabulary (`polling`,
 * `filled`). That is deliberate: each hook's status words mirror the surface it
 * observes, so terminal arms here mirror `MultiFormatLoadResult`, just as
 * `UsePooledAdStatus` mirrors `PollResult` and `UseFullScreenAdStatus` mirrors
 * the `AdEventType` lifecycle. Shared words (`idle`, `no-fill`, `error`,
 * `stale-by-policy`) mean the same thing across hooks; in-flight and success
 * words do not.
 *
 * `loaded-partial` exists because one request can return both a usable handle
 * and load-time errors. The SDK does not say which format (if any) each error
 * belongs to, so `ads` and `errors` can both be non-empty on the same result.
 *
 * `no-fill` and `error` are split so a clean no-fill does not masquerade as a
 * failure with an empty `errors` array. `stale-by-policy` is not an error
 * either, the same split `usePooledAd` makes; when it fires after
 * `loaded-partial`, prior load `errors` are retained rather than discarded.
 *
 * There is no `'consumed'` arm: multi-format handles are banner/native and have
 * no `show()`. Fullscreen consumption lives on `usePooledAd` only.
 *
 * **Ownership:** while this hook holds handles, do not call `handle.destroy()`.
 * Call `release()` first if you need to own destruction, or leave destruction
 * to the hook (unmount, superseding load, or stale unrendered eviction).
 */
export type UseMultiFormatAdResult = UseMultiFormatAdResultBase &
  (
    | { status: 'idle'; ads: never[]; errors: never[] }
    | { status: 'loading'; ads: MultiFormatAdHandle[]; errors: AdError[] }
    /** At least one handle, no errors. */
    | { status: 'loaded'; ads: MultiFormatAdHandle[]; errors: never[] }
    /** At least one handle plus at least one error. */
    | { status: 'loaded-partial'; ads: MultiFormatAdHandle[]; errors: AdError[] }
    /**
     * Request completed, no handles, nothing failed. Routine ad-server
     * outcome, so `errors` is empty. Read `responseInfo` for the response id.
     */
    | { status: 'no-fill'; ads: never[]; errors: never[] }
    /** No handles, and at least one leg actually failed. */
    | { status: 'error'; ads: never[]; errors: AdError[] }
    /**
     * Every held handle crossed the publisher's staleness window while the hook
     * owned it, so `ads` is empty of showable inventory. Not an error. Call
     * `load()` for fresh inventory.
     *
     * Per-handle rather than all-or-nothing: one handle going stale drops only
     * that handle. Unrendered handles are destroyed; already-rendered
     * banner/native handles are left in place until release or unmount.
     * Load-time `errors` from a prior `loaded-partial` are retained.
     */
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

/**
 * Multi-format request as a hook. One request, several eligible formats, one
 * winner (`requestCount` 1 in v1).
 *
 * Loads on its own as soon as `autoLoad` allows it, so the common case needs no
 * effect at the call site:
 *
 * ```jsx
 * const { status, ads, retry } = useMultiFormatAd({
 *   adUnitId: UNIT,
 *   requestOptions: MultiFormatAdPresets.nativeOrBanner([BannerAdSize.MEDIUM_RECTANGLE]),
 *   autoLoad: consentReady,
 * });
 * ```
 *
 * Ownership, release ordering, never-reject load, load coalescing, and
 * `stale-by-policy` semantics match `usePooledAd`. Status vocabulary does not,
 * for the reason given on `UseMultiFormatAdResult`.
 *
 * Stub: load resolves `{ status: 'no-fill', ads: [], errors: [], responseInfo: null }`.
 * Callback identity, automatic loading, and per-instance coalescing match the
 * documented contract, so StrictMode double-invoke behaves as the reference
 * describes.
 */
export function useMultiFormatAd(options: UseMultiFormatAdOptions): UseMultiFormatAdResult {
  const autoLoad = options.autoLoad ?? true;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<MultiFormatAdHookState>(initialMultiFormatAdState);
  const inflightRef = useRef<Promise<MultiFormatLoadResult> | null>(null);
  const autoLoadedForRef = useRef<string | null>(null);

  const load = useCallback((): Promise<MultiFormatLoadResult> => {
    void optionsRef.current.adUnitId;
    void optionsRef.current.requestOptions;
    if (inflightRef.current) {
      return inflightRef.current;
    }
    setState(previousState => ({ ...previousState, status: 'loading' }));
    const result: MultiFormatLoadResult = {
      status: 'no-fill',
      ads: [],
      errors: [],
      responseInfo: null,
    };
    const flight = Promise.resolve(result)
      .then(nextState => {
        setState(nextState);
        return nextState;
      })
      .finally(() => {
        inflightRef.current = null;
      });
    inflightRef.current = flight;
    return flight;
  }, []);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const release = useCallback((): MultiFormatAdHandle[] => {
    setState(initialMultiFormatAdState);
    return [];
  }, []);

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
