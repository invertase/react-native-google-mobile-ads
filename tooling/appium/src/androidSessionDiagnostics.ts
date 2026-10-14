/**
 * Structured Android session/install diagnostics for WDIO/Appium session create.
 * Pre-uninstalls a stale `com.microsoft.reacttestapp` so enforceAppInstall does
 * not burn the 60s worker ceiling on INSTALL_FAILED_UPDATE_INCOMPATIBLE
 * (serialized behind Play Store dex2oat on google_apis_playstore images).
 */

import { execFileSync } from 'node:child_process';
import { EXAMPLE_ANDROID_PACKAGE } from './formats.ts';

export type AndroidExecCaptureResult = {
  stdout: string;
  stderr: string;
  status: number | null;
  error?: string;
};

export type AndroidExecCapture = (
  bin: string,
  args: string[],
  options?: { timeoutMs?: number },
) => AndroidExecCaptureResult;

export function defaultAndroidExecCapture(
  bin: string,
  args: string[],
  options?: { timeoutMs?: number },
): AndroidExecCaptureResult {
  try {
    const stdout = execFileSync(bin, args, {
      encoding: 'utf8',
      timeout: options?.timeoutMs ?? 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout: stdout?.toString() ?? '', stderr: '', status: 0 };
  } catch (error) {
    const err = error as {
      status?: number | null;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
      code?: string;
    };
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      status: typeof err.status === 'number' ? err.status : null,
      error: err.message ?? String(error),
    };
  }
}

export function formatAndroidSessionDiagnosticLine(
  fields: Record<string, string | number | boolean | null | undefined>,
  now: () => Date = () => new Date(),
): string {
  const body = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  return `[e2e-android-session] ts=${now().toISOString()} ${body}`;
}

export function formatAndroidBootDiagnosticLine(
  fields: Record<string, string | number | boolean | null | undefined>,
  now: () => Date = () => new Date(),
): string {
  const body = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  return `[e2e-android-boot] ts=${now().toISOString()} ${body}`;
}

/** Hint appended when Android worker/session readiness times out. */
export const ANDROID_SESSION_TIMEOUT_HINT =
  'Android POST /session often burns the 60s ceiling on INSTALL_FAILED_UPDATE_INCOMPATIBLE (stale signing) serialized behind Play Store / vending dex2oat — check [e2e-android-session] pre-uninstall + INSTALL_FAILED_* lines in the supervised child log';

/**
 * True when `adb shell pm path <package>` reports an installed APK path.
 */
export function androidPackageIsInstalled(
  serial: string,
  packageName: string,
  execCapture: AndroidExecCapture = defaultAndroidExecCapture,
): boolean {
  const result = execCapture(
    'adb',
    ['-s', serial, 'shell', 'pm', 'path', packageName],
    { timeoutMs: 15_000 },
  );
  const combined = `${result.stdout}\n${result.stderr}`;
  return /package:/i.test(combined) && result.status === 0;
}

export type PreUninstallAndroidAppResult = {
  attempted: boolean;
  removed: boolean;
  wasInstalled: boolean;
  elapsedMs: number;
  detail: string;
};

/**
 * Uninstall the example package when present so enforceAppInstall performs a
 * clean install instead of a signature-mismatched upgrade.
 */
export function preUninstallAndroidAppIfPresent(
  serial: string,
  options?: {
    packageName?: string;
    execCapture?: AndroidExecCapture;
    now?: () => number;
  },
): PreUninstallAndroidAppResult {
  const packageName = options?.packageName ?? EXAMPLE_ANDROID_PACKAGE;
  const exec = options?.execCapture ?? defaultAndroidExecCapture;
  const now = options?.now ?? Date.now;
  const started = now();
  const wasInstalled = androidPackageIsInstalled(serial, packageName, exec);
  if (!wasInstalled) {
    return {
      attempted: false,
      removed: false,
      wasInstalled: false,
      elapsedMs: now() - started,
      detail: 'not-installed',
    };
  }
  const uninstall = exec(
    'adb',
    ['-s', serial, 'uninstall', packageName],
    { timeoutMs: 60_000 },
  );
  const combined = `${uninstall.stdout}\n${uninstall.stderr}\n${uninstall.error ?? ''}`;
  const removed =
    uninstall.status === 0 && /success/i.test(combined) && !/failure/i.test(combined);
  return {
    attempted: true,
    removed,
    wasInstalled: true,
    elapsedMs: now() - started,
    detail: removed
      ? 'uninstalled'
      : `uninstall-failed status=${uninstall.status ?? 'null'} ${combined.trim().slice(0, 200)}`,
  };
}

/**
 * Emit `[e2e-android-session]` / `[e2e-android-boot]` lines for pre-uninstall,
 * then return the result for callers that gate session create.
 */
export function prepareAndroidSessionInstall(
  serial: string,
  options?: {
    packageName?: string;
    execCapture?: AndroidExecCapture;
    write?: (line: string) => void;
    now?: () => Date;
    clockMs?: () => number;
  },
): PreUninstallAndroidAppResult {
  const write = options?.write ?? ((line: string) => console.log(line));
  const now = options?.now ?? (() => new Date());
  const packageName = options?.packageName ?? EXAMPLE_ANDROID_PACKAGE;
  write(
    formatAndroidBootDiagnosticLine(
      {
        phase: 'pre-session:pre-uninstall:begin',
        serial,
        package: packageName,
        hint: 'remove stale package before enforceAppInstall to avoid UPDATE_INCOMPATIBLE',
      },
      now,
    ),
  );
  const result = preUninstallAndroidAppIfPresent(serial, {
    packageName,
    execCapture: options?.execCapture,
    now: options?.clockMs,
  });
  write(
    formatAndroidSessionDiagnosticLine(
      {
        phase: 'pre-session:pre-uninstall',
        serial,
        package: packageName,
        wasInstalled: result.wasInstalled,
        attempted: result.attempted,
        removed: result.removed,
        elapsedMs: result.elapsedMs,
        detail: result.detail,
      },
      now,
    ),
  );
  return result;
}

/** Match Appium/UiAutomator2 install failure tokens in supervised child logs. */
export const ANDROID_INSTALL_FAILED_PATTERN =
  /\bINSTALL_FAILED_[A-Z0-9_]+\b/;

/** Match UiAutomator2 server start evidence in Appium logs. */
export const ANDROID_UIA2_START_PATTERN =
  /UiAutomator2(?:Driver|Server|\s+server)|uiautomator2.*(?:start|launch|instrument)/i;

/**
 * Re-emit a structured `[e2e-android-session]` line for notable Appium install /
 * session-create evidence so the next timeout is conclusive without hoping.
 */
export function annotateAndroidSessionLogLine(
  line: string,
  options?: {
    write?: (line: string) => void;
    now?: () => Date;
    /** Track first INSTALL_FAILED / uia2 / session-created timestamps for elapsed + dedupe. */
    state?: {
      installFailedAtMs?: number;
      uia2StartAtMs?: number;
      sessionCreatedAtMs?: number;
      reinstallStartedAtMs?: number;
    };
  },
): string | undefined {
  const write = options?.write ?? ((text: string) => console.log(text));
  const now = options?.now ?? (() => new Date());
  const state = options?.state;
  const installFailed = ANDROID_INSTALL_FAILED_PATTERN.exec(line)?.[0];
  if (installFailed) {
    if (state && state.installFailedAtMs == null) {
      state.installFailedAtMs = now().getTime();
    }
    const annotated = formatAndroidSessionDiagnosticLine(
      {
        phase: 'session-create:install-failed',
        code: installFailed,
        hint:
          installFailed === 'INSTALL_FAILED_UPDATE_INCOMPATIBLE'
            ? 'signature mismatch — pre-uninstall should have removed the stale package'
            : 'enforceAppInstall install failure',
        raw: JSON.stringify(line.trim().slice(0, 240)),
      },
      now,
    );
    write(annotated);
    return annotated;
  }
  if (ANDROID_UIA2_START_PATTERN.test(line)) {
    // Emit once per session-create: Appium repeats UiAutomator2 start chatter
    // for tens of thousands of lines after the first hit (CI noise).
    if (state?.uia2StartAtMs != null || state?.sessionCreatedAtMs != null) {
      return undefined;
    }
    if (state) {
      state.uia2StartAtMs = now().getTime();
    }
    const annotated = formatAndroidSessionDiagnosticLine(
      {
        phase: 'session-create:uia2-start',
        elapsedMs:
          state?.reinstallStartedAtMs != null
            ? now().getTime() - state.reinstallStartedAtMs
            : undefined,
      },
      now,
    );
    write(annotated);
    return annotated;
  }
  if (
    /(?:WebDriver|Appium) session (?:created|started)|\bsession created successfully\b/i.test(
      line,
    )
  ) {
    if (state?.sessionCreatedAtMs != null) {
      return undefined;
    }
    if (state) {
      state.sessionCreatedAtMs = now().getTime();
    }
    const annotated = formatAndroidSessionDiagnosticLine(
      {
        phase: 'session-create:session-created',
        reinstallElapsedMs:
          state?.reinstallStartedAtMs != null
            ? now().getTime() - state.reinstallStartedAtMs
            : undefined,
      },
      now,
    );
    write(annotated);
    return annotated;
  }
  return undefined;
}

export function formatAndroidWorkerTimeoutHint(source: string, baseMessage: string): string {
  if (!/android/i.test(source) && !/^serial-android$/.test(source)) {
    return baseMessage;
  }
  return `${baseMessage} Hint: ${ANDROID_SESSION_TIMEOUT_HINT}`;
}
