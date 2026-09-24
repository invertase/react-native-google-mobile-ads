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

import { AdEventType } from '../AdEventType';
import { AppOpenAd } from '../ads/AppOpenAd';
import type { AdError } from '../types/AdError';
import { AdStalenessGuidanceMillis } from '../types/AdExpiry';
import type { RequestOptions } from '../types/RequestOptions';
import { isFullscreenAdPresenting } from '../internal/fullscreenAdPresence';

import { useForeground } from './useForeground';

/**
 * Options for {@link useAppOpenAdManager}.
 *
 * Options-form only: there is no positional overload. Keep {@link useAppOpenAd}
 * for one-shot load/show; this hook owns Google's AppOpenAdManager lifecycle
 * (preload, 4-hour freshness, warm-foreground show, reload after close).
 */
export type UseAppOpenAdManagerOptions = {
  /**
   * The ad unit to manage.
   *
   * `null` means there is no unit yet, so no request is issued and `status`
   * stays `'idle'`. Changing this value destroys any owned `AppOpenAd`.
   */
  adUnitId: string | null;
  /**
   * Request options forwarded to `AppOpenAd.createForAdRequest`. Changing them
   * destroys any owned ad and, when `autoLoad` is true, loads again.
   */
  requestOptions?: RequestOptions;
  /**
   * Controls **automatic** preloading. Defaults to `true`.
   *
   * This is the master "may I issue an ad request" switch. While `false` — set
   * it so until consent / SDK init is ready — **no** path issues a load: not
   * the automatic preload, not a warm foreground, not
   * {@link UseAppOpenAdManagerResult.showAdIfAvailable}, and not a post-close
   * reload. Warm foreground and `showAdIfAvailable` still *show* an ad that is
   * already held and fresh, but they never *start* a request while it is
   * `false`. Flip it to `true` once consent is resolved to begin preloading.
   */
  autoLoad?: boolean;
};

/**
 * Where the managed app-open ad is right now. Vocabulary matches the
 * fullscreen options-form hooks where applicable.
 */
export type UseAppOpenAdManagerStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'showing'
  | 'closed'
  | 'no-fill'
  | 'error';

/**
 * Result of {@link useAppOpenAdManager}.
 *
 * - `status` — current lifecycle position.
 * - `showAdIfAvailable` — Google's show-if-ready entry point (call from a cold
 *   start loading screen; warm foreground is handled by the hook).
 * - `isShowing` — mirrors the sample `isShowingAd` guard: true from the show
 *   request until the ad closes or fails to show. Warm-foreground ads overlay
 *   the running app, so do not swap the app tree out because of it.
 */
export type UseAppOpenAdManagerResult = {
  status: UseAppOpenAdManagerStatus;
  showAdIfAvailable: () => void;
  isShowing: boolean;
};

const EMPTY_REQUEST_OPTIONS: RequestOptions = {};

function isLoadNoFill(error: AdError): boolean {
  return (
    (error.reason === 'no-fill' || error.reason === 'mediation-no-fill') && error.phase === 'load'
  );
}

function requestSignatureOf(adUnitId: string | null, requestOptions: RequestOptions): string {
  return JSON.stringify({ adUnitId, requestOptions }, (_key, value: unknown) => {
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
}

/**
 * App-open **manager** hook aligned with Google's `AppOpenAdManager` sample and
 * app-open guidance.
 *
 * Behaviour:
 * - Preloads via manual `AppOpenAd.createForAdRequest` + `load()` (cross-backend).
 * - Treats inventory as invalid more than four hours after load
 *   (`AdStalenessGuidanceMillis.APP_OPEN`).
 * - Auto-shows on **warm** foreground only, via {@link useForeground}
 *   (background → active). Does **not** auto-show on the very first cold start
 *   — call `showAdIfAvailable()` from your loading screen for that path.
 * - On Android a foreground return caused by another library
 *   fullscreen ad Activity (interstitial / rewarded / app-open) dismissing does
 *   **not** trigger the warm-foreground auto-show, so two fullscreen ads never
 *   stack back-to-back. A real home / app-switcher return still shows. See
 *   `internal/fullscreenAdPresence.ts`.
 * - Guards with `isShowing`; reloads after `CLOSED` and show-phase errors.
 *
 * #### Consent
 *
 * While `autoLoad` is `false`, no path starts an ad request, so keep it
 * `false` until consent is resolved. Passing `adUnitId: null` (or not mounting
 * the hook) also prevents every load.
 *
 * #### Inventory source
 *
 * Every backend uses `AppOpenAd.createForAdRequest`. Android Next-Gen also
 * exposes SDK-managed app-open preload (`AppOpenAdPreloader` / `AdPools`
 * fullscreen app-open); composing this manager with that preloader is not yet
 * supported and is not required for a correct manager.
 *
 * #### Example
 *
 * ```jsx
 * const { status, showAdIfAvailable, isShowing } = useAppOpenAdManager({
 *   adUnitId: TestIds.APP_OPEN,
 *   autoLoad: consentReady,
 * });
 *
 * // Cold start loading screen (after the first launch, if you follow Google's
 * // "don't show on the very first app start" guidance yourself):
 * useEffect(() => {
 *   if (assetsReady && consentReady) {
 *     showAdIfAvailable();
 *   }
 * }, [assetsReady, consentReady, showAdIfAvailable]);
 * // Hold a loading screen only for this cold-start pass, and never make it
 * // wait on consent: if consent is unresolved, skip the offer and continue.
 * // Keep the app tree mounted while a warm-foreground ad shows.
 * ```
 */
export function useAppOpenAdManager(
  options: UseAppOpenAdManagerOptions,
): UseAppOpenAdManagerResult {
  const autoLoad = options.autoLoad ?? true;
  const { adUnitId } = options;
  const requestOptions = options.requestOptions ?? EMPTY_REQUEST_OPTIONS;
  const requestSignature = requestSignatureOf(adUnitId, requestOptions);

  const [status, setStatus] = useState<UseAppOpenAdManagerStatus>('idle');
  const [isShowing, setIsShowing] = useState(false);

  const adRef = useRef<AppOpenAd | null>(null);
  const loadTimeRef = useRef(0);
  const isLoadingRef = useRef(false);
  const isShowingRef = useRef(false);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const clearReloadTimer = useCallback(() => {
    if (reloadTimerRef.current !== null) {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }
  }, []);

  const destroyHeld = useCallback(() => {
    const held = adRef.current;
    adRef.current = null;
    loadTimeRef.current = 0;
    isLoadingRef.current = false;
    held?.destroy();
  }, []);

  const isAdAvailable = useCallback((): boolean => {
    if (!adRef.current || loadTimeRef.current <= 0) {
      return false;
    }
    return Date.now() - loadTimeRef.current < AdStalenessGuidanceMillis.APP_OPEN;
  }, []);

  const attachAndLoadRef = useRef<(() => void) | null>(null);

  const scheduleReload = useCallback(() => {
    clearReloadTimer();
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      if (mountedRef.current && optionsRef.current.adUnitId !== null) {
        attachAndLoadRef.current?.();
      }
    }, 0);
  }, [clearReloadTimer]);

  const attachAndLoad = useCallback(() => {
    const unitId = optionsRef.current.adUnitId;
    if (unitId === null) {
      return;
    }
    // AO-1: `autoLoad` is the master "may I issue an ad request" switch. While
    // it is false — e.g. before consent / SDK init — NO path may start a load:
    // not the automatic preload, not a warm foreground, not showAdIfAvailable,
    // and not a post-close reload. showAdIfAvailable and warm-foreground then
    // only *show* an ad that is already held and fresh; otherwise they no-op.
    // This is what stops an ad request from firing before consent is resolved,
    // rather than relying on the caller to also gate on `adUnitId`.
    if (!(optionsRef.current.autoLoad ?? true)) {
      return;
    }
    // Do not load when a fresh ad is already held or a load is in flight.
    if (isLoadingRef.current || isAdAvailable()) {
      return;
    }

    const flightGeneration = generationRef.current;
    destroyHeld();
    isLoadingRef.current = true;
    setStatus('loading');

    let ad: AppOpenAd;
    try {
      ad = AppOpenAd.createForAdRequest(unitId, optionsRef.current.requestOptions);
    } catch {
      isLoadingRef.current = false;
      setStatus('error');
      return;
    }

    adRef.current = ad;
    ad.addAdEventsListener(({ type, payload }) => {
      if (
        !mountedRef.current ||
        flightGeneration !== generationRef.current ||
        adRef.current !== ad
      ) {
        return;
      }

      switch (type) {
        case AdEventType.LOADED:
          isLoadingRef.current = false;
          loadTimeRef.current = Date.now();
          setStatus('loaded');
          break;
        case AdEventType.OPENED:
          isShowingRef.current = true;
          setIsShowing(true);
          setStatus('showing');
          break;
        case AdEventType.CLOSED: {
          isShowingRef.current = false;
          setIsShowing(false);
          setStatus('closed');
          // Discard the spent ad and preload the next opportunity.
          destroyHeld();
          generationRef.current += 1;
          scheduleReload();
          break;
        }
        case AdEventType.ERROR: {
          const error = payload as AdError;
          const wasShowing = isShowingRef.current;
          isLoadingRef.current = false;
          isShowingRef.current = false;
          setIsShowing(false);

          if (wasShowing || error.phase === 'show') {
            // Show failure: discard and reload (Google AppOpenAdManager).
            setStatus('error');
            destroyHeld();
            generationRef.current += 1;
            scheduleReload();
            break;
          }

          setStatus(isLoadNoFill(error) ? 'no-fill' : 'error');
          destroyHeld();
          break;
        }
        default:
          break;
      }
    });

    ad.load();
  }, [destroyHeld, isAdAvailable, scheduleReload]);

  attachAndLoadRef.current = attachAndLoad;

  const showAdIfAvailable = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }
    // If the app open ad is already showing, do not show again.
    if (isShowingRef.current) {
      return;
    }

    const ad = adRef.current;
    const fresh =
      ad !== null &&
      loadTimeRef.current > 0 &&
      Date.now() - loadTimeRef.current < AdStalenessGuidanceMillis.APP_OPEN;

    if (!fresh) {
      // Missing or stale (>4h): do not show; ensure a reload.
      if (ad !== null && loadTimeRef.current > 0) {
        // Stale held inventory — discard before reload. Reset status to 'idle'
        // so a consumer never observes 'loaded' with no ad actually held:
        // attachAndLoad() overwrites this with 'loading' if it proceeds, but
        // no-ops (leaving 'idle') when the AO-1 gate is closed (autoLoad false)
        // or adUnitId is null.
        generationRef.current += 1;
        destroyHeld();
        setStatus('idle');
      }
      attachAndLoad();
      return;
    }

    isShowingRef.current = true;
    setIsShowing(true);
    void Promise.resolve(ad.show()).catch(() => {
      // Show promise rejection: clear guard and reload via the same path as a
      // show-phase ERROR event when the platform declines without an event.
      if (!mountedRef.current) {
        return;
      }
      isShowingRef.current = false;
      setIsShowing(false);
      setStatus('error');
      generationRef.current += 1;
      destroyHeld();
      attachAndLoad();
    });
  }, [attachAndLoad, destroyHeld]);

  // Warm foreground only — useForeground fires on background → active, never
  // on the initial cold-start `active` AppState. Cold start remains app-owned
  // via showAdIfAvailable() from a loading screen.
  //
  // AO-2: On Android, AppState background → active ALSO fires when a library
  // fullscreen ad Activity (interstitial / rewarded / another app-open) merely
  // dismisses — GMA renders each fullscreen ad in its own Activity, which
  // backgrounds the host ReactActivity. Auto-showing an app-open ad in that
  // window stacks two fullscreen ads back-to-back (a Google policy / UX
  // problem). Suppress the warm-foreground auto-show while any library
  // fullscreen ad is presenting (or within the brief grace window armed on the
  // ad's CLOSED, to absorb the AppState settle around that CLOSED event). This
  // is scoped to the automatic path only: caller-driven showAdIfAvailable()
  // (cold start) and the generic public useForeground hook are intentionally
  // unaffected. A genuine home / app-switcher return happens outside that
  // window and still shows. Mirrors Google's AppOpenAdManager
  // (ProcessLifecycleOwner) intent.
  const showOnWarmForeground = useCallback(() => {
    if (isFullscreenAdPresenting()) {
      return;
    }
    showAdIfAvailable();
  }, [showAdIfAvailable]);

  useForeground(showOnWarmForeground);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      isShowingRef.current = false;
      // Leave a pending reload timer armed: its callback no-ops on
      // `!mountedRef.current`. Clearing here would make that guard unreachable.
      destroyHeld();
    };
  }, [destroyHeld]);

  // Identity supersession.
  useDeepCompareEffect(() => {
    generationRef.current += 1;
    isShowingRef.current = false;
    setIsShowing(false);
    clearReloadTimer();
    destroyHeld();
    setStatus('idle');
  }, [adUnitId, requestOptions, clearReloadTimer, destroyHeld]);

  // Automatic preload. `requestSignature` keeps content-equality deps stable so
  // a status-only re-render does not burn another create/load.
  useEffect(() => {
    if (!autoLoad || adUnitId === null) {
      return;
    }
    attachAndLoad();
  }, [autoLoad, adUnitId, requestSignature, attachAndLoad]);

  return {
    status,
    showAdIfAvailable,
    isShowing,
  };
}
