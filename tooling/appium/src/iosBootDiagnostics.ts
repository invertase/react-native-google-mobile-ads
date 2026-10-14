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
