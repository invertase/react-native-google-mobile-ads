/**
 * Host-side Android ANR / "isn't responding" dismissal.
 *
 * Gallery already clicks `android:id/aerr_wait` via UiAutomator when the session
 * can reach the dialog. Under multi-AVD load the focused dialog is often
 * System UI / launcher / "Process system" — UiAutomator dump/click hangs, but
 * `dumpsys window` + `dumpsys accessibility` still report the dialog and
 * `adb shell input tap` can hit Wait.
 */

import { execFileSync } from 'node:child_process';
import { androidFocusedSystemDialog } from './androidFocus.ts';

export type AnrDialogRegion = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type AdbExec = (bin: string, args: string[]) => string;

const defaultAdbExec: AdbExec = (bin, args) =>
  execFileSync(bin, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15_000,
  });

/** Focus-only window probe — full `dumpsys window displays` often hangs under ANR. */
function adbWindowFocusDump(serial: string, execFile: AdbExec): string {
  try {
    // `grep` exit 1 (no match) must not throw — that means no focus lines / no ANR.
    return execFile('adb', [
      '-s',
      serial,
      'shell',
      'dumpsys window | grep -E "mCurrentFocus=|mFocusedApp=" || true',
    ]);
  } catch {
    // Fall back to the fuller dump when the pipeline itself fails.
    return execFile('adb', ['-s', serial, 'shell', 'dumpsys', 'window']);
  }
}

/** Parse `SkRegion((l,t,r,b))` for an "isn't responding" accessibility window. */
export function parseAnrDialogRegionFromAccessibility(
  accessibilityDump: string,
): AnrDialogRegion | null {
  const match =
    /isn'?t responding[\s\S]{0,240}?region=SkRegion\(\((\d+),(\d+),(\d+),(\d+)\)\)/i.exec(
      accessibilityDump,
    ) ??
    /title=[^\]]*isn'?t responding[^\]]*region=SkRegion\(\((\d+),(\d+),(\d+),(\d+)\)\)/i.exec(
      accessibilityDump,
    );
  if (!match) {
    return null;
  }
  const left = Number(match[1]);
  const top = Number(match[2]);
  const right = Number(match[3]);
  const bottom = Number(match[4]);
  if (![left, top, right, bottom].every(n => Number.isFinite(n)) || right <= left || bottom <= top) {
    return null;
  }
  return { left, top, right, bottom };
}

/**
 * Candidate tap points for Wait / Close app on a Material ANR dialog.
 * Modern dialogs put Wait on the left and Close app on the right; we try Wait
 * first (left), then right, in case the locale/layout flips them.
 */
export function anrDialogButtonTapPoints(region: AnrDialogRegion): Array<{ x: number; y: number }> {
  const y = Math.round(region.top + ((region.bottom - region.top) * 4) / 5);
  const midY = Math.round((region.top + region.bottom) / 2);
  const leftX = Math.round(region.left + (region.right - region.left) / 4);
  const rightX = Math.round(region.left + (3 * (region.right - region.left)) / 4);
  return [
    { x: leftX, y },
    { x: rightX, y },
    { x: leftX, y: midY },
    { x: rightX, y: midY },
  ];
}

export function windowDumpShowsAnr(dump: string): boolean {
  return androidFocusedSystemDialog(dump) === 'anr';
}

/**
 * Dismiss stacked ANR dialogs on `serial` via adb taps (no UiAutomator session).
 * Returns how many dismiss attempts reported an ANR focus before clearing.
 */
export function dismissAndroidAnrDialogsViaAdb(
  serial: string,
  options?: {
    execFile?: AdbExec;
    maxRounds?: number;
    sleepMs?: (ms: number) => void;
  },
): { cleared: boolean; rounds: number; tapped: number } {
  const execFile = options?.execFile ?? defaultAdbExec;
  const maxRounds = options?.maxRounds ?? 10;
  const sleepMs =
    options?.sleepMs ??
    ((ms: number) => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    });

  let tapped = 0;
  let rounds = 0;
  for (let round = 0; round < maxRounds; round += 1) {
    rounds = round + 1;
    let windowDump = '';
    try {
      windowDump = adbWindowFocusDump(serial, execFile);
    } catch {
      // Device wedged harder than ANR — stop rather than hang the worker.
      break;
    }
    if (!windowDumpShowsAnr(windowDump)) {
      return { cleared: true, rounds, tapped };
    }

    let region: AnrDialogRegion | null = null;
    try {
      const a11y = execFile('adb', [
        '-s',
        serial,
        'shell',
        'dumpsys accessibility | grep -E "isn.t responding|SkRegion"',
      ]);
      region = parseAnrDialogRegionFromAccessibility(a11y);
    } catch {
      region = null;
    }
    // Known Pixel/AVD dialog geometry when accessibility dump is empty/hung.
    if (region == null) {
      region = { left: 28, top: 1030, right: 1052, bottom: 1536 };
    }

    for (const point of anrDialogButtonTapPoints(region)) {
      try {
        execFile('adb', [
          '-s',
          serial,
          'shell',
          'input',
          'tap',
          String(point.x),
          String(point.y),
        ]);
        tapped += 1;
        sleepMs(350);
      } catch {
        // keep trying other points / rounds
      }
    }
    sleepMs(700);
  }

  let finalDump = '';
  try {
    finalDump = adbWindowFocusDump(serial, execFile);
  } catch {
    return { cleared: false, rounds, tapped };
  }
  return { cleared: !windowDumpShowsAnr(finalDump), rounds, tapped };
}
