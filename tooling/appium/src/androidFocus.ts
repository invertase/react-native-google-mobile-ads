/**
 * Pure parsers for `adb shell dumpsys window displays` output. The dump also lists
 * background tasks, so package checks must only read the focus lines.
 */

/**
 * Off-app surfaces that divert focus away from the example app.
 * Includes home launchers: KEYCODE_BACK after interstitial dismiss can leave
 * NexusLauncher focused while AdActivity is already gone (dismiss.success
 * without a readable lifecycle marker).
 */
export const ANDROID_FOREIGN_FOCUS_MARKERS = [
  'com.android.chrome',
  'com.android.vending',
  'com.google.android.finsky',
  'com.google.android.apps.nexuslauncher',
  'com.android.launcher3',
  'com.android.launcher',
] as const;

export type AndroidSystemDialog = 'anr' | 'app-error';

/** Classic GMA + Next-Gen mobile SDK fullscreen AdActivity package markers. */
export const ANDROID_AD_ACTIVITY_MARKERS = [
  'com.google.android.gms.ads.AdActivity',
  'com.google.android.libraries.ads.mobile.sdk.common.AdActivity',
] as const;

/**
 * True when a dumpsys window display still shows a live AdActivity.
 * A finished ActivityRecord ends with ` f}` and must not count: after dismiss
 * that leftover line still contains the marker while focus is already the example app.
 */
export function androidAdActivityIsForeground(dump: string): boolean {
  const remaining = dump
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !(trimmed.includes('ActivityRecord{') && trimmed.endsWith(' f}'));
    })
    .join('\n');
  if (!ANDROID_AD_ACTIVITY_MARKERS.some(marker => remaining.includes(marker))) {
    return false;
  }
  return (
    remaining.includes('mFocusedApp=ActivityRecord') ||
    remaining.includes('mCurrentFocus=Window')
  );
}

/** The `mCurrentFocus=` / `mFocusedApp=` lines of a window dump, newline-joined. */
export function androidFocusLines(dump: string): string {
  return (dump.match(/^.*\b(?:mCurrentFocus|mFocusedApp)=.*$/gm) ?? [])
    .map(line => line.trim())
    .join('\n');
}

/** `mCurrentFocus=` line only — not `mFocusedApp=`. */
export function androidCurrentFocusLine(dump: string): string {
  return androidFocusLines(dump)
    .split('\n')
    .filter(line => line.includes('mCurrentFocus='))
    .join('\n');
}

/**
 * Status-bar / notification shade over the app. Not a foreign package (no force-stop).
 * KEYCODE_BACK and `activateApp` do not dismiss the shade.
 */
export function androidCurrentFocusIsStatusBarShade(dump: string): boolean {
  const currentFocus = androidCurrentFocusLine(dump);
  return /NotificationShade|ExpandedNotificationView/i.test(currentFocus);
}

/**
 * Example app holds window focus — reads only focus lines, never background tasks.
 * False while the notification shade still owns `mCurrentFocus`.
 */
export function androidExampleAppHoldsWindowFocus(dump: string, examplePackage: string): boolean {
  if (androidCurrentFocusIsStatusBarShade(dump)) {
    return false;
  }
  return androidFocusLines(dump).includes(examplePackage);
}

/** Foreign packages that currently hold focus (never background tasks). */
export function androidFocusedForeignApps(dump: string): string[] {
  const focus = androidFocusLines(dump);
  return ANDROID_FOREIGN_FOCUS_MARKERS.filter(marker => focus.includes(marker));
}

export function focusIncludesAndroidForeignApp(dump: string): boolean {
  return androidFocusedForeignApps(dump).length > 0;
}

/**
 * System ANR / crash dialog holding window focus. Its title embeds the app package
 * (`Application Not Responding: <pkg>`), so it must not be read as the app itself.
 */
export function androidFocusedSystemDialog(dump: string): AndroidSystemDialog | null {
  const currentFocus = androidFocusLines(dump)
    .split('\n')
    .filter(line => line.includes('mCurrentFocus='))
    .join('\n');
  if (/Application Not Responding|isn't responding/i.test(currentFocus)) {
    return 'anr';
  }
  if (/Application Error|keeps stopping|has stopped/i.test(currentFocus)) {
    return 'app-error';
  }
  return null;
}
