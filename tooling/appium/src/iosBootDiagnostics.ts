/**
 * Structured iOS simulator boot diagnostics for select-and-boot and WDIO
 * session create. Captures non-blocking simctl snapshots so the next
 * "failed to finish booting after 120s (Original status empty)" failure
 * includes device state, bootstatus probe output, and the Appium
 * simulatorStartupTimeout capability in supervised child logs.
 */

import { spawnSync } from 'node:child_process';
import {
  deviceHubAppPath,
  listDeviceHubRelatedPids,
  parseDeviceHubMode,
} from './iosDeviceHub.ts';

/** appium-ios-simulator STARTUP_TIMEOUT_MS when the capability is unset. */
export const XCUITest_DEFAULT_SIMULATOR_STARTUP_TIMEOUT_MS = 120_000;

/** Short probe so diagnostics never block CI the way `bootstatus -b` can. */
export const IOS_BOOTSTATUS_PROBE_TIMEOUT_MS = 5_000;

/** Post-boot pause so CoreSimulator can finish Data Migration before list/confirm. */
export const IOS_BOOT_SETTLE_MS = 3_000;

/** Bound for the post-boot `simctl list` readiness confirm (must not hang CI). */
export const IOS_LIST_CONFIRM_TIMEOUT_MS = 15_000;

/** How often WDIO/supervisor re-probe while POST /session is still open. */
export const IOS_SESSION_CREATE_HANG_POLL_MS = 30_000;

/** Stable hint text for hung XCUITest session create (POST /session). */
export const IOS_SESSION_CREATE_HANG_HINT =
  'POST /session still open; check WDA (usePrebuiltWDA/derivedDataPath/xcodebuild), simctl Booted state, and appium:simulatorStartupTimeout — prefer fail-fast over waiting out the supervisor ceiling';

export type ExecCaptureResult = {
  stdout: string;
  stderr: string;
  status: number | null;
  timedOut?: boolean;
  error?: string;
};

export type ExecCapture = (
  bin: string,
  args: string[],
  options?: { timeoutMs?: number },
) => ExecCaptureResult;

export type IosSimulatorDeviceRow = {
  udid: string;
  name: string;
  state: string;
  isAvailable?: boolean;
  runtimeIdentifier: string;
};

export function defaultExecCapture(
  bin: string,
  args: string[],
  options?: { timeoutMs?: number },
): ExecCaptureResult {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout: options?.timeoutMs,
  });
  if (result.error) {
    const timedOut =
      'code' in result.error &&
      (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
    return {
      stdout: result.stdout?.toString() ?? '',
      stderr: result.stderr?.toString() ?? '',
      status: result.status,
      timedOut,
      error: result.error.message,
    };
  }
  return {
    stdout: result.stdout?.toString() ?? '',
    stderr: result.stderr?.toString() ?? '',
    status: result.status,
  };
}

/**
 * Locate one UDID inside `xcrun simctl list devices --json` (all states).
 */
export function findSimulatorDeviceInListJson(
  simctlListJson: string,
  udid: string,
): IosSimulatorDeviceRow | null {
  const parsed = JSON.parse(simctlListJson) as {
    devices?: Record<
      string,
      Array<{
        name?: string;
        udid?: string;
        state?: string;
        isAvailable?: boolean;
      }>
    >;
  };
  const target = udid.trim();
  for (const [runtimeIdentifier, devices] of Object.entries(parsed.devices ?? {})) {
    for (const device of devices) {
      if (device.udid !== target) {
        continue;
      }
      return {
        udid: target,
        name: typeof device.name === 'string' ? device.name : '(unknown)',
        state: typeof device.state === 'string' ? device.state : 'Unknown',
        isAvailable: device.isAvailable,
        runtimeIdentifier,
      };
    }
  }
  return null;
}

/** Compact one-line summary of a non-blocking `simctl bootstatus` probe. */
export function summarizeBootstatusProbe(result: ExecCaptureResult): string {
  const combined = [result.stdout, result.stderr]
    .join('\n')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const last = combined.slice(-5).join(' | ') || '(empty)';
  const parts = [
    result.timedOut ? 'timedOut=true' : `exit=${result.status ?? 'null'}`,
    `lines=${combined.length}`,
    `tail=${JSON.stringify(last)}`,
  ];
  if (result.error) {
    parts.push(`error=${JSON.stringify(result.error)}`);
  }
  return parts.join(' ');
}

export function formatIosBootDiagnosticLine(
  fields: Record<string, string | number | boolean | null | undefined>,
  now: () => Date = () => new Date(),
): string {
  const body = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  return `[e2e-ios-boot] ts=${now().toISOString()} ${body}`;
}

export type CollectIosBootDiagnosticsOptions = {
  phase: string;
  /** Capability value when set; `null` means unset (driver default 120s). */
  simulatorStartupTimeoutMs: number | null;
  execCapture?: ExecCapture;
  bootstatusTimeoutMs?: number;
  deviceHubMode?: string;
  deviceHubPids?: readonly number[];
  now?: () => Date;
};

/**
 * Collect timestamped diagnostic lines for a UDID. Device commands are injected
 * via `execCapture` so unit tests never touch a real simulator.
 */
export function collectIosBootDiagnosticLines(
  udid: string,
  options: CollectIosBootDiagnosticsOptions,
): string[] {
  const exec = options.execCapture ?? defaultExecCapture;
  const now = options.now ?? (() => new Date());
  const bootstatusTimeoutMs =
    options.bootstatusTimeoutMs ?? IOS_BOOTSTATUS_PROBE_TIMEOUT_MS;

  const list = exec('xcrun', ['simctl', 'list', 'devices', '--json'], {
    timeoutMs: 15_000,
  });
  let device: IosSimulatorDeviceRow | null = null;
  let listError: string | undefined;
  if (list.error && list.stdout.trim() === '') {
    listError = list.error;
  } else {
    try {
      device = findSimulatorDeviceInListJson(list.stdout, udid);
    } catch (error) {
      listError = error instanceof Error ? error.message : String(error);
    }
  }

  // Non-blocking: omit `-b` so we do not start a boot; timeout bounds the probe.
  const bootstatus = exec('xcrun', ['simctl', 'bootstatus', udid], {
    timeoutMs: bootstatusTimeoutMs,
  });

  const timeoutLabel =
    options.simulatorStartupTimeoutMs == null
      ? `unset(default=${XCUITest_DEFAULT_SIMULATOR_STARTUP_TIMEOUT_MS})`
      : String(options.simulatorStartupTimeoutMs);

  const hubMode =
    options.deviceHubMode ??
    parseDeviceHubMode(process.env.RNGMA_IOS_DEVICE_HUB, deviceHubAppPath() ?? null);
  const hubPids = options.deviceHubPids ?? listDeviceHubRelatedPids();

  return [
    formatIosBootDiagnosticLine(
      {
        phase: options.phase,
        udid,
        found: device != null,
        name: device?.name ?? '(missing)',
        state: device?.state ?? '(missing)',
        available: device?.isAvailable ?? '(n/a)',
        runtime: device?.runtimeIdentifier ?? '(missing)',
        listError: listError ?? undefined,
        bootstatus: summarizeBootstatusProbe(bootstatus),
        'appium:simulatorStartupTimeout': timeoutLabel,
        deviceHubMode: hubMode,
        deviceHubPids: hubPids.join(',') || '(none)',
      },
      now,
    ),
  ];
}

export function logIosBootDiagnostics(
  udid: string,
  options: CollectIosBootDiagnosticsOptions,
  write: (line: string) => void = line => console.log(line),
): void {
  for (const line of collectIosBootDiagnosticLines(udid, options)) {
    write(line);
  }
}

/** True when Node spawn/exec surfaced ETIMEDOUT (or an equivalent message). */
export function isXcrunTimedOutError(error: unknown): boolean {
  if (error == null) {
    return false;
  }
  if (typeof error === 'object' && 'code' in error) {
    if ((error as { code?: unknown }).code === 'ETIMEDOUT') {
      return true;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return /\bETIMEDOUT\b/i.test(message);
}

export function formatSelectAndBootTimeoutError(commandLabel: string): Error {
  return new Error(
    `select-and-boot: ${commandLabel} timed out (ETIMEDOUT); simulator not confirmed ready — retryable abort.`,
  );
}

export type ConfirmSimulatorReadyResult =
  | { ok: true; state: string; name: string }
  | {
      ok: false;
      reason: string;
      state?: string;
      listError?: string;
      bootstatus?: string;
    };

/**
 * After `bootstatus -b`, re-probe list (+ short bootstatus) before persisting a
 * UDID. Injectable `execCapture` keeps unit tests off real simulators.
 */
export function confirmSimulatorReadyForPersist(
  udid: string,
  execCapture: ExecCapture,
  options?: {
    listTimeoutMs?: number;
    bootstatusTimeoutMs?: number;
  },
): ConfirmSimulatorReadyResult {
  const listTimeoutMs = options?.listTimeoutMs ?? IOS_LIST_CONFIRM_TIMEOUT_MS;
  const bootstatusTimeoutMs =
    options?.bootstatusTimeoutMs ?? IOS_BOOTSTATUS_PROBE_TIMEOUT_MS;

  const list = execCapture('xcrun', ['simctl', 'list', 'devices', '--json'], {
    timeoutMs: listTimeoutMs,
  });
  if (list.timedOut || (list.error && list.stdout.trim() === '')) {
    return {
      ok: false,
      reason:
        'simctl list timed out or failed after boot; refusing to persist UDID as ready',
      listError: list.error ?? 'ETIMEDOUT',
    };
  }

  let device: IosSimulatorDeviceRow | null = null;
  try {
    device = findSimulatorDeviceInListJson(list.stdout, udid);
  } catch (error) {
    return {
      ok: false,
      reason: 'simctl list JSON unreadable after boot; refusing to persist UDID as ready',
      listError: error instanceof Error ? error.message : String(error),
    };
  }
  if (device == null) {
    return {
      ok: false,
      reason: `UDID ${udid} missing from simctl list after boot; refusing to persist UDID as ready`,
    };
  }
  if (device.state !== 'Booted') {
    return {
      ok: false,
      reason: `simulator state=${device.state} after boot (want Booted); refusing to persist UDID as ready`,
      state: device.state,
    };
  }

  const bootstatus = execCapture('xcrun', ['simctl', 'bootstatus', udid], {
    timeoutMs: bootstatusTimeoutMs,
  });
  if (bootstatus.timedOut) {
    return {
      ok: false,
      reason:
        'simctl bootstatus probe timed out after boot; refusing to persist UDID as ready',
      state: device.state,
      bootstatus: summarizeBootstatusProbe(bootstatus),
    };
  }

  return { ok: true, state: device.state, name: device.name };
}

export function assertSimulatorReadyForPersist(
  udid: string,
  execCapture: ExecCapture,
  options?: {
    listTimeoutMs?: number;
    bootstatusTimeoutMs?: number;
  },
): { state: string; name: string } {
  const result = confirmSimulatorReadyForPersist(udid, execCapture, options);
  if (!result.ok) {
    const detail = [
      result.reason,
      result.state ? `state=${result.state}` : undefined,
      result.listError ? `listError=${result.listError}` : undefined,
      result.bootstatus ? `bootstatus=${result.bootstatus}` : undefined,
    ]
      .filter(Boolean)
      .join('; ');
    throw new Error(`select-and-boot: ${detail} — retryable abort.`);
  }
  return { state: result.state, name: result.name };
}

export function sleepSync(ms: number): void {
  if (ms <= 0) {
    return;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export type SessionCreateHangClock = {
  setInterval(callback: () => void, milliseconds: number): unknown;
  clearInterval(timer: unknown): void;
};

const realHangClock: SessionCreateHangClock = {
  setInterval: (callback, milliseconds) => setInterval(callback, milliseconds),
  clearInterval: timer => clearInterval(timer as NodeJS.Timeout),
};

export type IosSessionCreateHangWatchdog = {
  stop: () => void;
};

/**
 * While WDIO's POST /session is in flight, periodically re-emit `[e2e-ios-boot]`
 * lines plus an Appium/WDA hang hint. Stop when the session is created or the
 * process moves on.
 */
export function startIosSessionCreateHangWatchdog(
  udid: string,
  options: {
    phase: string;
    simulatorStartupTimeoutMs: number | null;
    intervalMs?: number;
    execCapture?: ExecCapture;
    write?: (line: string) => void;
    clock?: SessionCreateHangClock;
    now?: () => Date;
    deviceHubMode?: string;
    deviceHubPids?: readonly number[];
  },
): IosSessionCreateHangWatchdog {
  const write = options.write ?? ((line: string) => console.log(line));
  const clock = options.clock ?? realHangClock;
  const intervalMs = options.intervalMs ?? IOS_SESSION_CREATE_HANG_POLL_MS;
  const now = options.now ?? (() => new Date());
  let ticks = 0;
  let stopped = false;

  write(
    formatIosBootDiagnosticLine(
      {
        phase: `${options.phase}:start`,
        udid,
        hint: 'POST /session beginning; watchdog will re-probe if it hangs',
        'appium:simulatorStartupTimeout':
          options.simulatorStartupTimeoutMs == null
            ? `unset(default=${XCUITest_DEFAULT_SIMULATOR_STARTUP_TIMEOUT_MS})`
            : String(options.simulatorStartupTimeoutMs),
      },
      now,
    ),
  );

  const timer = clock.setInterval(() => {
    if (stopped) {
      return;
    }
    ticks += 1;
    write(
      formatIosBootDiagnosticLine(
        {
          phase: `${options.phase}:hang`,
          udid,
          elapsedMs: ticks * intervalMs,
          hint: IOS_SESSION_CREATE_HANG_HINT,
        },
        now,
      ),
    );
    logIosBootDiagnostics(
      udid,
      {
        phase: `${options.phase}:hang-probe`,
        simulatorStartupTimeoutMs: options.simulatorStartupTimeoutMs,
        execCapture: options.execCapture,
        deviceHubMode: options.deviceHubMode,
        deviceHubPids: options.deviceHubPids,
        now,
      },
      write,
    );
  }, intervalMs);

  return {
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      clock.clearInterval(timer);
    },
  };
}
