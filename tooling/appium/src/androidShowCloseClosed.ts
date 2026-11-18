/** Gallery show-close lifecycle marker — shared with Android fullscreen harness. */
export const ANDROID_SHOW_LIFECYCLE_CLOSED = 'Show lifecycle: closed';

export function isAndroidNextgenE2eBackend(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.RNGMA_ANDROID_BACKEND ?? 'classic').trim().toLowerCase() === 'nextgen';
}

export type AndroidShowCloseChromeFlags = {
  adActivity: boolean;
  testAdObstructing: boolean;
  interstitialCloseChrome: boolean;
};

export function isAndroidFullscreenChromeClear(flags: AndroidShowCloseChromeFlags): boolean {
  return !flags.adActivity && !flags.testAdObstructing && !flags.interstitialCloseChrome;
}

/**
 * Next-Gen pooled interstitial dismiss can clear native chrome before the RN lifecycle
 * node prints `Show lifecycle: closed`. Accept when chrome stayed clear, the example
 * app is foreground, and Show is enabled again — classic backend keeps lifecycle text only.
 */
export function androidNextgenShowCloseClosedAccepted(input: {
  phase: string;
  chrome: AndroidShowCloseChromeFlags;
  exampleAppForeground: boolean;
  showActionEnabled: boolean;
  consecutiveChromeClearPolls: number;
}): boolean {
  if (input.phase.includes(ANDROID_SHOW_LIFECYCLE_CLOSED)) {
    return true;
  }
  return (
    input.consecutiveChromeClearPolls >= 3 &&
    isAndroidFullscreenChromeClear(input.chrome) &&
    input.exampleAppForeground &&
    input.showActionEnabled
  );
}

export const ANDROID_SHOW_CLOSE_EMPTY_PHASE_FOREGROUND_MS = 5000;