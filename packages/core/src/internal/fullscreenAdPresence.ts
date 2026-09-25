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

/**
 * Process-wide signal for "a library fullscreen ad Activity is currently
 * presenting" (interstitial / rewarded / rewarded-interstitial / app-open).
 *
 * #### Why this exists (AO-2)
 *
 * On Android, React Native's `AppState` reports `background` whenever ANOTHER
 * Activity covers the host `ReactActivity` — and the Google Mobile Ads SDK
 * renders every fullscreen ad in its OWN Activity. So showing e.g. an
 * interstitial drives `AppState` `active -> background`, and dismissing it
 * drives `background -> active`. {@link useForeground} (which fires on
 * `background -> active`) therefore fires when a library ad Activity merely
 * dismisses — not only on a genuine return from the home screen / app switcher.
 *
 * That made {@link useAppOpenAdManager} auto-show an app-open ad IMMEDIATELY
 * after another fullscreen ad closed, i.e. two fullscreen ads back-to-back — a
 * Google policy / bad-UX problem. iOS presents fullscreen ads modally without
 * backgrounding the app, so it is unaffected; there this signal simply stays
 * absent.
 *
 * This mirrors the intent of Google's own `AppOpenAdManager` sample, which keys
 * warm-foreground shows off `ProcessLifecycleOwner` (real process
 * foreground/background) rather than a single Activity's lifecycle, so an
 * in-process ad Activity does not count as a "return to the foreground".
 *
 * #### Mechanism
 *
 * The signal is raised on `OPENED` and lowered on `CLOSED` (and on `destroy()`
 * while still presenting), arming a short grace window as it reaches zero. The
 * grace covers the small settle between an ad's `CLOSED` event and the
 * `AppState` `active` it triggers — observed on device to arrive in EITHER
 * order, tens of milliseconds apart. A genuine home / app-switcher return
 * happens well outside that window, so it is NOT suppressed and the app-open ad
 * still shows as intended.
 *
 * Call sites also lower the signal on a show-phase `ERROR`, but that branch is
 * defensive only: a show-phase `ERROR` (`onAdFailedToShowFullScreenContent`)
 * fires WITHOUT a prior `OPENED`, so no Activity was presented, the per-instance
 * "marked" guard is false, and nothing is decremented — there is no spurious
 * foreground to absorb in that case.
 *
 * A counter (not a boolean) tolerates overlapping/nested presentations and
 * balanced open/close pairs; call sites raise exactly once per presentation.
 */

/**
 * Grace window (ms) kept "presenting" after the last fullscreen ad closes, to
 * absorb the AppState settle described above. Small enough that a real app
 * return (leaving and coming back) falls outside it.
 */
const CLOSE_GRACE_MILLIS = 1000;

let presentingCount = 0;
let graceUntil = 0;

/**
 * Record that a library fullscreen ad Activity has been presented (`OPENED`).
 * Cancels any pending post-close grace window.
 */
export function markFullscreenAdOpened(): void {
  presentingCount += 1;
  graceUntil = 0;
}

/**
 * Record that a library fullscreen ad Activity has dismissed (`CLOSED`, or
 * `destroy()` while still presenting). When no ad remains presenting, arms a
 * short grace window so a warm foreground caused by this very dismissal is
 * still treated as "an ad is present".
 *
 * Call sites may also invoke this on a show-phase `ERROR`, but that is
 * defensive only (see the module header): such an error has no prior `OPENED`,
 * so the per-instance guard prevents any decrement.
 */
export function markFullscreenAdClosed(): void {
  if (presentingCount === 0) {
    // Defensive: unbalanced close (call sites already guard against this).
    return;
  }
  presentingCount -= 1;
  if (presentingCount === 0) {
    graceUntil = Date.now() + CLOSE_GRACE_MILLIS;
  }
}

/**
 * True while a library fullscreen ad Activity is presenting, or within the
 * brief post-close grace window. Consulted before a warm-foreground app-open
 * auto-show so a return caused by a library ad dismissing does not stack a
 * second fullscreen ad.
 */
export function isFullscreenAdPresenting(now: number = Date.now()): boolean {
  return presentingCount > 0 || now < graceUntil;
}

/**
 * Test-only: reset the module singleton between tests.
 *
 * @internal
 */
export function __resetFullscreenAdPresenceForTests(): void {
  presentingCount = 0;
  graceUntil = 0;
}
