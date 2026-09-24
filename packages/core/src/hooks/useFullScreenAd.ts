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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import useDeepCompareEffect from 'use-deep-compare-effect';

import { AdEventType } from '../AdEventType';
import { AppOpenAd } from '../ads/AppOpenAd';
import { InterstitialAd } from '../ads/InterstitialAd';
import { RewardedAd } from '../ads/RewardedAd';
import { RewardedInterstitialAd } from '../ads/RewardedInterstitialAd';
import { warnOnce } from '../internal/warnOnce';
import { RewardedAdEventType } from '../RewardedAdEventType';
import type { AdError } from '../types/AdError';
import { AdShowOptions } from '../types/AdShowOptions';
import { AdStates, AdHookReturns } from '../types/AdStates';
import type { PaidEvent } from '../types';
import type { RequestOptions } from '../types/RequestOptions';
import type { ResponseInfo } from '../types/ResponseInfo';
import { RewardedAdReward } from '../types/RewardedAdReward';

/** Any ad the fullscreen hooks can drive. */
export type FullScreenAd = AppOpenAd | InterstitialAd | RewardedAd | RewardedInterstitialAd;

/**
 * Options object accepted by the second call form of every fullscreen ad hook.
 *
 * Passing this instead of a positional ad unit id opts into the v17 shape:
 * the hook loads on its own, `status` reports where the ad is, and separate
 * fields report what has happened to it.
 */
export type FullScreenAdHookOptions = {
  /**
   * The ad unit to load.
   *
   * `null` means there is no ad unit yet, so no ad instance is created and
   * `status` stays `'idle'`. Useful when the unit arrives from remote config.
   * Changing this value, including to or from `null`, replaces the underlying
   * ad instance and therefore destroys the previous one.
   */
  adUnitId: string | null;
  /**
   * Request options forwarded to the underlying `createForAdRequest`.
   * Changing them replaces and destroys the previous ad instance.
   */
  requestOptions?: RequestOptions;
  /**
   * Controls **automatic** loading. Defaults to `true`.
   *
   * Set it to `false` to wait for something the load depends on, such as
   * consent or SDK initialization; the hook loads as soon as it flips true.
   * Turning it back off stops future automatic loads. It does not destroy the
   * ad and does not cancel a load already in flight, because neither platform
   * exposes load cancellation.
   *
   * An explicit `load()` or `retry()` still works while `autoLoad` is false.
   */
  autoLoad?: boolean;
};

/**
 * Where the ad is right now. Exactly one value applies at a time.
 *
 * These words mirror the surface this hook observes, the `AdEventType`
 * lifecycle, the same way `UsePooledAdStatus` mirrors `PollResult` and
 * `UseMultiFormatAdStatus` mirrors `MultiFormatLoadResult`. They are not
 * synonyms across hooks: `'closed'` here is the dismissal of a shown ad and
 * does **not** destroy anything, whereas `usePooledAd`'s `'consumed'` fires
 * when the show promise fulfills and the hook destroys the spent ad.
 *
 * `'no-fill'` is not a failure. Load-phase `no-fill` and `mediation-no-fill`
 * both land here, matching `MultiFormatAdRequest`. Show-phase failures stay
 * `'error'` even when the reason looks like inventory.
 */
export type UseFullScreenAdStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'showing'
  | 'closed'
  | 'no-fill'
  | 'error';

/**
 * Result of the options call form.
 *
 * Two kinds of member, on purpose. `status` answers **where this ad is right
 * now** and is mutually exclusive. The fields below it answer **what has
 * happened to this ad** and accumulate, because those facts overlap: a user
 * can click an ad and then dismiss it, and a paid event can arrive at any
 * point. Collapsing both questions into one word would throw information away.
 *
 * Every accumulating field resets when the next `load()` starts, when
 * `adUnitId` or `requestOptions` changes, and when options-form `destroy()`
 * returns the hook to `'idle'`.
 */
type UseFullScreenAdResultBase = {
  /**
   * The automatic-load policy the hook is acting on, after the default is
   * applied.
   *
   * Echoed so `'idle'` can be interpreted against the current policy.
   * `autoLoad: false` means automatic loading is off. After options-form
   * `destroy()`, status remains `'idle'` even when this is true, until an
   * explicit `load()` or `retry()`.
   */
  autoLoad: boolean;
  /** Whether the user clicked this ad. Stays true after dismissal. */
  clicked: boolean;
  /** Whether this ad recorded an impression. */
  impression: boolean;
  /** Payload of the last impression-level revenue event for this ad. */
  revenue: PaidEvent | null;
  /** Response metadata captured when this ad loaded. */
  responseInfo: ResponseInfo | null;
  /**
   * The reward item. Populated at load with what the ad advertises, and
   * populated again when the user earns it. Read `earnedReward` to tell those
   * apart.
   */
  reward: RewardedAdReward | null;
  /** Whether the user earned the reward. */
  earnedReward: boolean;
  /**
   * Loads the ad and moves `status` to `'loading'`.
   *
   * `load`, `retry`, `show`, and `destroy` keep the same identity for the hook
   * lifetime. They sample the latest ad instance when called, so identity or
   * request changes do not leave event handlers calling a retired instance.
   *
   * Concurrent calls coalesce, so an automatic load and a manual one in the
   * same tick issue a single request. That is what keeps React StrictMode's
   * double-invoked effects from burning two ads in development.
   *
   * Returns `void` deliberately: this hook never transfers ownership, so a
   * promise could only hand back what the next render already carries.
   */
  load: () => void;
  /**
   * Shows a loaded ad. Press-safe: unsafe presses are a no-op. Absorbs BOTH
   * failure channels of `MobileAd.show()` — the synchronous throw (destroyed /
   * invalid options) and the promise rejection (not loaded / already requested
   * / platform decline) — so neither escapes an `onPress`. This path
   * synthesizes no hook state; an `AdError` appears only if an ad event
   * arrives. The imperative `MobileAd.show()` keeps that two-channel contract
   * for direct callers (see its source).
   */
  show: (showOptions?: AdShowOptions) => void;
  /**
   * Destroys the current native ad.
   *
   * Options form: also creates a fresh instance with the same current
   * `adUnitId` and `requestOptions` (no instance while `adUnitId` is `null`)
   * and returns `status` to `'idle'`. `destroy()` itself does not load. When
   * `autoLoad` is true, the replacement is still not loaded automatically;
   * a later explicit `load()` or `retry()` loads it.
   *
   * Positional arguments and `useFullScreenAd(ad)` keep their existing
   * ownership: they destroy the current instance and do not create a
   * replacement.
   */
  destroy: () => void;
  /**
   * Alias for `load`, named for the call site it is written at: retrying after
   * `'error'` or `'no-fill'`. Automatic loading never retries on its own,
   * because an unprompted retry loop is a request storm.
   */
  retry: () => void;
};

type UseFullScreenAdOutcome = {
  [Status in UseFullScreenAdStatus]: {
    status: Status;
    error: Status extends 'no-fill' | 'error' ? AdError : null;
  };
}[UseFullScreenAdStatus];

/**
 * The options-form result, discriminated by `status`.
 *
 * A `'no-fill'` populates `error` because the platform delivers one, and its
 * `responseInfo.responseId` identifies the empty response. Other failures use
 * `'error'`. Every other status carries `error: null`.
 */
export type UseFullScreenAdResult = UseFullScreenAdResultBase & UseFullScreenAdOutcome;

/** Runtime and type shape for fullscreen formats that cannot carry rewards. */
export type UseFullScreenAdResultWithoutReward = Omit<
  UseFullScreenAdResultBase,
  'reward' | 'earnedReward'
> &
  UseFullScreenAdOutcome;

/** Internal accumulating state, richer than either public shape. */
type FullScreenAdCoreState = {
  status: UseFullScreenAdStatus;
  /**
   * Sticky "an ad is ready" flag for the legacy `isLoaded`, which stays true
   * across `OPENED` and only clears on dismissal. `status === 'loaded'` is the
   * mutually exclusive reading of the same event.
   */
  loaded: boolean;
  /** Sticky, for the legacy `isOpened`, which stays true after dismissal. */
  opened: boolean;
  clicked: boolean;
  impression: boolean;
  error: AdError | null;
  revenue: PaidEvent | null;
  reward: RewardedAdReward | null;
  earnedReward: boolean;
  responseInfo: ResponseInfo | null;
};

const initialCoreState: FullScreenAdCoreState = {
  status: 'idle',
  loaded: false,
  opened: false,
  clicked: false,
  impression: false,
  error: null,
  revenue: null,
  reward: null,
  earnedReward: false,
  responseInfo: null,
};

/**
 * Merges a partial update, returning the state it was given when that update
 * says nothing new.
 *
 * Every reset dispatches the whole `initialCoreState`, and most of those land
 * on a hook that is already idle: mount, a new ad instance, and `destroy()` on
 * an untouched ad. An unconditional spread allocates a state object that
 * differs only by identity, which React then has to render and commit.
 * Comparing just the keys the update carries keeps real partial updates —
 * `{ clicked: true }` and friends — publishing as they always have, and the
 * shared `initialCoreState` is only ever read here, never written.
 */
function mergeCoreState(
  prevState: FullScreenAdCoreState,
  update: Partial<FullScreenAdCoreState>,
): FullScreenAdCoreState {
  for (const key of Object.keys(update) as (keyof FullScreenAdCoreState)[]) {
    if (!Object.is(prevState[key], update[key])) {
      return { ...prevState, ...update } as FullScreenAdCoreState;
    }
  }
  return prevState;
}

type FullScreenAdCore = {
  state: FullScreenAdCoreState;
  load: () => void;
  show: (showOptions?: AdShowOptions) => void;
  destroy: () => void;
};

/**
 * The single lifecycle implementation behind both call forms.
 *
 * Both shapes are produced by mapping this state, rather than by branching to
 * two hook implementations. That is deliberate: calling a different set of
 * hooks depending on the argument shape would change hook order whenever a
 * caller moves `adUnitId` between a string and `null`, which React reports as
 * "Rendered more hooks than during the previous render".
 */
function useFullScreenAdCore(
  ad: FullScreenAd | null,
  autoLoad: boolean,
  destroyCurrent?: () => FullScreenAd | null | undefined,
  committedConfigRef?: { current: NormalizedHookArgs },
): FullScreenAdCore {
  // One updater behind every dispatch site, so the equality bail-out applies to
  // all of them. `useState` rather than `useReducer` because only the state
  // updater path lets React drop an update that resolves to the state it
  // already has; a reducer that returns its argument still renders once.
  const [state, setState] = useState(initialCoreState);
  const dispatch = useCallback((update: Partial<FullScreenAdCoreState>) => {
    setState(prevState => mergeCoreState(prevState, update));
  }, []);

  const inFlightRef = useRef(false);
  const loadedRef = useRef(false);
  const autoLoadedForRef = useRef<FullScreenAd | null>(null);
  const adRef = useRef(ad);
  adRef.current = ad;
  const mountedRef = useRef(false);
  const destroyCurrentRef = useRef(destroyCurrent);
  destroyCurrentRef.current = destroyCurrent;

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(() => {
    const currentAd = adRef.current;
    if (!mountedRef.current || !currentAd || inFlightRef.current || loadedRef.current) {
      return;
    }
    inFlightRef.current = true;
    loadedRef.current = false;
    dispatch({ ...initialCoreState, status: 'loading' });
    currentAd.load();
  }, []);

  const show = useCallback((showOptions?: AdShowOptions) => {
    if (!mountedRef.current) {
      return;
    }
    const currentAd = adRef.current;
    if (!currentAd) {
      return;
    }
    // `MobileAd.show()` uses two failure channels (see its source): it THROWS
    // synchronously for destroyed / invalid-options, and its promise REJECTS
    // for not-loaded / already-requested / platform-decline. This callback is
    // written at `onPress`, so it must absorb BOTH — the try/catch swallows
    // the synchronous throw, the `.catch()` swallows the rejection — leaving
    // an unsafe press a no-op with no unhandled rejection. Ad events stay the
    // failure channel, so nothing here writes hook state.
    try {
      void Promise.resolve(currentAd.show(showOptions)).catch(() => undefined);
    } catch {
      // Not showable / misused; the state that says so already rendered, and
      // the imperative `MobileAd.show()` is where that throw surfaces loudly.
    }
  }, []);

  const destroy = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }
    if (destroyCurrentRef.current) {
      const replacement = destroyCurrentRef.current();
      if (replacement !== undefined) {
        adRef.current = replacement;
        inFlightRef.current = false;
        loadedRef.current = false;
        const committed = committedConfigRef?.current;
        if (committed?.form === 'options' && committed.autoLoad && replacement) {
          autoLoadedForRef.current = replacement;
        }
        dispatch(initialCoreState);
      }
      return;
    }
    adRef.current?.destroy();
  }, []);

  useEffect(() => {
    dispatch(initialCoreState);
    inFlightRef.current = false;
    loadedRef.current = false;
    if (!ad) {
      return;
    }
    const unsubscribe = (ad as RewardedAd).addAdEventsListener(({ type, payload }) => {
      if (!mountedRef.current || adRef.current !== ad) {
        return;
      }
      switch (type) {
        case AdEventType.LOADED:
          inFlightRef.current = false;
          loadedRef.current = true;
          dispatch({ status: 'loaded', loaded: true, responseInfo: ad.responseInfo ?? null });
          break;
        case AdEventType.OPENED:
          dispatch({ status: 'showing', opened: true });
          break;
        case AdEventType.PAID:
          dispatch({ revenue: payload as PaidEvent });
          break;
        case AdEventType.CLOSED:
          loadedRef.current = false;
          dispatch({ status: 'closed', loaded: false });
          break;
        case AdEventType.CLICKED:
          dispatch({ clicked: true });
          break;
        case AdEventType.ERROR: {
          inFlightRef.current = false;
          loadedRef.current = false;
          const error = payload as AdError;
          // A no-fill is a routine ad-server outcome, not a defect, so it gets
          // its own status. Match MultiFormatAdRequest: both `no-fill` and
          // `mediation-no-fill` on the load path. Show failures are always
          // failures, even when the reason looks like inventory.
          const isNoFill =
            (error.reason === 'no-fill' || error.reason === 'mediation-no-fill') &&
            error.phase === 'load';
          dispatch({
            status: isNoFill ? 'no-fill' : 'error',
            error,
            loaded: false,
            responseInfo: error.responseInfo ?? null,
          });
          break;
        }
        case AdEventType.IMPRESSION:
          dispatch({ impression: true });
          break;
        case RewardedAdEventType.LOADED:
          inFlightRef.current = false;
          loadedRef.current = true;
          dispatch({
            status: 'loaded',
            loaded: true,
            reward: payload as RewardedAdReward,
            responseInfo: ad.responseInfo ?? null,
          });
          break;
        case RewardedAdEventType.EARNED_REWARD:
          dispatch({ earnedReward: true, reward: payload as RewardedAdReward });
          break;
      }
    });
    return () => {
      unsubscribe();
    };
  }, [ad]);

  // Automatic loading, options form only. Fires once per ad instance, so it
  // covers mount, a new ad unit, and `autoLoad` flipping true, while never
  // re-firing after the ad is spent. Reloading a dismissed ad on its own would
  // produce fills nobody asked for and depress match rate.
  useEffect(() => {
    if (!autoLoad || !ad || autoLoadedForRef.current === ad) {
      return;
    }
    autoLoadedForRef.current = ad;
    load();
  }, [ad, autoLoad, load]);

  return { state, load, show, destroy };
}

/** Legacy positional shape. Unchanged from v16 in both fields and behaviour. */
function toLegacyResult(core: FullScreenAdCore, ad: FullScreenAd | null): AdHookReturns {
  const { state } = core;
  const legacyState: AdStates = {
    isLoaded: state.loaded,
    isOpened: state.opened,
    isClicked: state.clicked,
    isClosed: state.status === 'closed',
    error: state.error ?? undefined,
    revenue: state.revenue ?? undefined,
    reward: state.reward ?? undefined,
    isEarnedReward: state.earnedReward,
  };
  return {
    ...legacyState,
    responseInfo: ad?.responseInfo ?? null,
    isShowing: state.opened && state.status !== 'closed',
    load: core.load,
    show: core.show,
    destroy: core.destroy,
  };
}

/** Options-form shape: one status plus the facts that accumulate around it. */
function toOptionsResult(
  core: FullScreenAdCore,
  autoLoad: boolean,
  includeRewardFields: boolean,
): UseFullScreenAdResult | UseFullScreenAdResultWithoutReward {
  const { state } = core;
  const outcome: UseFullScreenAdOutcome =
    state.status === 'no-fill' || state.status === 'error'
      ? { status: state.status, error: state.error as AdError }
      : { status: state.status, error: null };
  const result = {
    ...outcome,
    autoLoad,
    clicked: state.clicked,
    impression: state.impression,
    revenue: state.revenue,
    responseInfo: state.responseInfo,
    load: core.load,
    show: core.show,
    destroy: core.destroy,
    retry: core.load,
  };
  return includeRewardFields
    ? { ...result, reward: state.reward, earnedReward: state.earnedReward }
    : result;
}

type NormalizedHookArgs = {
  form: 'legacy' | 'options';
  adUnitId: string | null;
  requestOptions: RequestOptions;
  autoLoad: boolean;
};

type ManagedFullScreenAd = {
  ad: FullScreenAd;
  ownedByOptions: boolean;
  destroyed: boolean;
};

function destroyManagedAd(record: ManagedFullScreenAd): void {
  if (record.destroyed) {
    return;
  }
  record.destroyed = true;
  record.ad.destroy();
}

/**
 * Resolves either call form to one config.
 *
 * Discriminates on the options object rather than on `typeof x === 'string'`,
 * because `adUnitId: null` is a supported positional value. A `string` test
 * would route `useInterstitialAd(null)` into the options form.
 */
function normalizeHookArgs(
  idOrOptions: string | null | FullScreenAdHookOptions,
  requestOptions: RequestOptions,
): NormalizedHookArgs {
  if (typeof idOrOptions === 'object' && idOrOptions !== null) {
    return {
      form: 'options',
      adUnitId: idOrOptions.adUnitId,
      requestOptions: idOrOptions.requestOptions ?? {},
      autoLoad: idOrOptions.autoLoad ?? true,
    };
  }
  return { form: 'legacy', adUnitId: idOrOptions, requestOptions, autoLoad: true };
}

/**
 * Shared body for the four fullscreen hooks: normalize the arguments, own one
 * ad instance, run one lifecycle, and map the result to the requested shape.
 */
export function useFullScreenAdForm(
  hookName: string,
  createAd: (adUnitId: string, requestOptions: RequestOptions) => FullScreenAd,
  idOrOptions: string | null | FullScreenAdHookOptions,
  requestOptions: RequestOptions,
  includeRewardFields: true,
): AdHookReturns | UseFullScreenAdResult;
export function useFullScreenAdForm(
  hookName: string,
  createAd: (adUnitId: string, requestOptions: RequestOptions) => FullScreenAd,
  idOrOptions: string | null | FullScreenAdHookOptions,
  requestOptions: RequestOptions,
  includeRewardFields: false,
): Omit<AdHookReturns, 'reward' | 'isEarnedReward'> | UseFullScreenAdResultWithoutReward;
export function useFullScreenAdForm(
  hookName: string,
  createAd: (adUnitId: string, requestOptions: RequestOptions) => FullScreenAd,
  idOrOptions: string | null | FullScreenAdHookOptions,
  requestOptions: RequestOptions,
  includeRewardFields: boolean,
): AdHookReturns | UseFullScreenAdResult | UseFullScreenAdResultWithoutReward {
  const config = normalizeHookArgs(idOrOptions, requestOptions);

  // Sampled from a ref so the factory is not an effect dependency; the four
  // call sites pass a module-level function, so its identity never matters.
  const createAdRef = useRef(createAd);
  createAdRef.current = createAd;

  const [ad, setAd] = useState<FullScreenAd | null>(null);
  const managedAdRef = useRef<ManagedFullScreenAd | null>(null);
  // Destructive operations sample this snapshot, which is written only when a
  // render commits. `adRef` still tracks the current instance for load/show.
  const committedConfigRef = useRef(config);
  const { adUnitId } = config;

  // Ownership and the destructive snapshot follow the committed call form, not
  // create-time provenance and not a discarded render. This is a layout effect
  // because identity supersession and unmount cleanup are passive: every layout
  // effect of a commit flushes before any passive effect of that commit, so a
  // commit that changes the form and the identity together has the incoming
  // form in place before supersession reads it. A render that never commits
  // never runs this, so the last committed tree keeps its own ownership and
  // destroy() still recreates (or does not) from that tree's arguments.
  useLayoutEffect(() => {
    committedConfigRef.current = config;
    const currentRecord = managedAdRef.current;
    if (currentRecord) {
      currentRecord.ownedByOptions = config.form === 'options';
    }
  });

  useDeepCompareEffect(() => {
    const nextAd = adUnitId !== null ? createAdRef.current(adUnitId, config.requestOptions) : null;
    const previousRecord = managedAdRef.current;

    if (previousRecord?.ownedByOptions && previousRecord.ad !== nextAd) {
      destroyManagedAd(previousRecord);
    }

    managedAdRef.current = nextAd
      ? {
          ad: nextAd,
          ownedByOptions: config.form === 'options',
          destroyed: false,
        }
      : null;
    setAd(nextAd);
  }, [adUnitId, config.requestOptions]);

  const destroyCurrent = useCallback(() => {
    const currentRecord = managedAdRef.current;
    if (currentRecord) {
      destroyManagedAd(currentRecord);
    }
    const committed = committedConfigRef.current;
    if (committed.form !== 'options') {
      return undefined;
    }
    if (committed.adUnitId === null) {
      return null;
    }
    const replacement = createAdRef.current(committed.adUnitId, committed.requestOptions);
    managedAdRef.current = {
      ad: replacement,
      ownedByOptions: true,
      destroyed: false,
    };
    setAd(replacement);
    return replacement;
  }, []);

  const core = useFullScreenAdCore(
    ad,
    config.form === 'options' && config.autoLoad,
    destroyCurrent,
    committedConfigRef,
  );

  useEffect(
    () => () => {
      const currentRecord = managedAdRef.current;
      managedAdRef.current = null;
      if (currentRecord?.ownedByOptions) {
        destroyManagedAd(currentRecord);
      }
    },
    [],
  );

  useEffect(() => {
    if (config.form !== 'legacy') {
      return;
    }
    warnOnce(
      `deprecated-positional-${hookName}`,
      `${hookName}(adUnitId, requestOptions) is deprecated and will be removed in v18. ` +
        `Pass an options object instead: ${hookName}({ adUnitId, requestOptions, autoLoad }). ` +
        `See the v17 migration guide.`,
    );
  }, [config.form, hookName]);

  return config.form === 'options'
    ? toOptionsResult(core, config.autoLoad, includeRewardFields)
    : toLegacyResult(core, ad);
}

/**
 * Drives an ad instance the caller already created.
 *
 * Internal to the four fullscreen hooks. Kept for the imperative-instance case
 * and returns the legacy shape.
 */
export function useFullScreenAd(ad: FullScreenAd | null): AdHookReturns {
  const core = useFullScreenAdCore(ad, false);
  return toLegacyResult(core, ad);
}
