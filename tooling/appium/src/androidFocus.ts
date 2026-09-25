/**
 * Pure parsers for `adb shell dumpsys window displays` output. The dump also lists
 * background tasks, so package checks must only read the focus lines.
 */

/** Off-app surfaces (Chrome, Play Store) that divert focus away from the example app. */
export const ANDROID_FOREIGN_FOCUS_MARKERS = [
  'com.android.chrome',
  'com.android.vending',
  'com.google.android.finsky',
] as const;

export type AndroidSystemDialog = 'anr' | 'app-error';

/** The `mCurrentFocus=` / `mFocusedApp=` lines of a window dump, newline-joined. */
export function androidFocusLines(dump: string): string {
  return (dump.match(/^.*\b(?:mCurrentFocus|mFocusedApp)=.*$/gm) ?? [])
    .map(line => line.trim())
    .join('\n');
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
