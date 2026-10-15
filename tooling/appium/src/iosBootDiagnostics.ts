/**
 * Structured iOS simulator boot diagnostics for select-and-boot and WDIO
 * session create. Captures non-blocking simctl snapshots so the next
 * "failed to finish booting after 120s (Original status empty)" failure
 * includes device state, bootstatus probe output, and the Appium
 * simulatorStartupTimeout capability in supervised child logs.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deviceHubAppPath,
  listDeviceHubRelatedPids,
  parseDeviceHubMode,
} from './iosDeviceHub.ts';
import {
  emitIosSessionCreateDiagnostics,
  parseXcodebuildExitCodeFromLine,
  resolveLastXcodebuildExit,
  type SessionExecCapture,
} from './iosSessionDiagnostics.ts';

/**
 * Same shared DerivedData root as `IOS_WDA_DERIVED_DATA_PATH` in hostPreflight.
 * Inlined here to avoid an import cycle (hostPreflight → iosBootDiagnostics).
 */
const SESSION_WDA_DERIVED_DATA_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '.wda-derived',
);
const SESSION_WDA_RUNNER_APP_PATH = join(
  SESSION_WDA_DERIVED_DATA_PATH,
  'Build',
  'Products',
  'Debug-iphonesimulator',
  'WebDriverAgentRunner-Runner.app',
);

/** Where `appium:isHeadless` came from (for one-shot cap-resolve logging). */
export type IosIsHeadlessSource = 'RNGMA_IOS_HEADLESS' | 'CI' | 'default';

export type IosIsHeadlessResolution = {
  isHeadless: boolean;
  source: IosIsHeadlessSource;
};

/**
 * Resolve `appium:isHeadless` for XCUITest, including the decision source.
 *
 * CI (`CI` / `GITHUB_ACTIONS`) defaults true: select-and-boot leaves a headless
 * Booted guest, and Appium's default `isHeadless=false` shuts it down to launch
 * Simulator UI — guest death + bootstatus hang. Local/slotted defaults false so
 * an operator UI client remains valid; override with `RNGMA_IOS_HEADLESS=0|1`.
 */
export function resolveIosIsHeadlessResolution(
  env: NodeJS.ProcessEnv = process.env,
): IosIsHeadlessResolution {
  const raw = (env.RNGMA_IOS_HEADLESS ?? '').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') {
    return { isHeadless: true, source: 'RNGMA_IOS_HEADLESS' };
  }
  if (raw === '0' || raw === 'false' || raw === 'no') {
    return { isHeadless: false, source: 'RNGMA_IOS_HEADLESS' };
  }
  if (env.CI === 'true' || env.GITHUB_ACTIONS === 'true') {
    return { isHeadless: true, source: 'CI' };
  }
  return { isHeadless: false, source: 'default' };
}

/** Boolean-only wrapper for capability assignment. */
export function resolveIosIsHeadless(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveIosIsHeadlessResolution(env).isHeadless;
}

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

/**
 * After this many hang ticks with xcrun ETIMEDOUT evidence, attempt one WDA
 * settle recovery (default: tick 2 ≈ 60s). Keep below the supervisor ceiling.
 */
export const IOS_SESSION_CREATE_HANG_RECOVER_AFTER_TICKS = 2;

/**
 * After this many hang ticks with prolonged ETIMEDOUT / WDA-not-ready evidence,
 * abort with a clear `[e2e-ios-boot]` error instead of burning the full 180s
 * worker ceiling (default: tick 3 ≈ 90s).
 */
export const IOS_SESSION_CREATE_HANG_ABORT_AFTER_TICKS = 3;

/** Stable hint text for hung XCUITest session create (POST /session). */
export const IOS_SESSION_CREATE_HANG_HINT =
  'POST /session still open; check WDA (usePrebuiltWDA/derivedDataPath/xcodebuild), simctl Booted state, and appium:simulatorStartupTimeout — prefer fail-fast over waiting out the supervisor ceiling';

/** Bundles to terminate during session-create hang recovery (best-effort). */
export const IOS_WDA_TERMINATE_BUNDLE_IDS = [
  'com.facebook.WebDriverAgentRunner.xctrunner',
  'com.facebook.WebDriverAgentRunner',
] as const;

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

/** Simulator.app / DeviceHub UI host PIDs (empty when truly headless). */
export function listSimulatorUiPids(
  execCapture: ExecCapture = defaultExecCapture,
): number[] {
  const names = ['Simulator', 'DeviceHub', 'DevicesTrampoline'];
  const pids: number[] = [];
  for (const name of names) {
    const result = execCapture('pgrep', ['-x', name], { timeoutMs: 5_000 });
    if (result.status !== 0 || result.stdout.trim() === '') {
      continue;
    }
    for (const line of result.stdout.split(/\r?\n/)) {
      const n = Number(line.trim());
      if (Number.isInteger(n) && n > 0) {
        pids.push(n);
      }
    }
  }
  return pids;
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

/** One-shot `[e2e-ios-boot]` line for grepping resolved `appium:isHeadless`. */
export function formatIosIsHeadlessCapResolveLine(
  resolution: IosIsHeadlessResolution,
  now: () => Date = () => new Date(),
): string {
  return formatIosBootDiagnosticLine(
    {
      phase: 'cap-resolve',
      'appium:isHeadless': resolution.isHeadless,
      source: resolution.source,
    },
    now,
  );
}

export type CollectIosBootDiagnosticsOptions = {
  phase: string;
  /** Capability value when set; `null` means unset (driver default 120s). */
  simulatorStartupTimeoutMs: number | null;
  execCapture?: ExecCapture;
  bootstatusTimeoutMs?: number;
  deviceHubMode?: string;
  deviceHubPids?: readonly number[];
  /** Override Simulator/DeviceHub UI PIDs (defaults to a live pgrep). */
  simulatorUiPids?: readonly number[];
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
  const uiPids = options.simulatorUiPids ?? listSimulatorUiPids(exec);
  // Keep `state=(missing)` when the row is absent so hang decisions treat list
  // failures like the prior contract; surface listError separately.
  const listState = device?.state ?? '(missing)';
  const bootstatusTimedOut = bootstatus.timedOut === true;
  const bootstatusTail = summarizeBootstatusProbe(bootstatus);

  return [
    formatIosBootDiagnosticLine(
      {
        phase: options.phase,
        udid,
        found: device != null,
        name: device?.name ?? '(missing)',
        state: listState,
        listState,
        available: device?.isAvailable ?? '(n/a)',
        runtime: device?.runtimeIdentifier ?? '(missing)',
        listError: listError ?? undefined,
        bootstatus: bootstatusTail,
        bootstatusTail,
        bootstatusTimedOut,
        // Instrument the probe bound so a future ETIMEDOUT proves whether the
        // hang-probe spawnSync ceiling (not CoreSimulator) fired.
        bootstatusProbeTimeoutMs: bootstatusTimeoutMs,
        'appium:simulatorStartupTimeout': timeoutLabel,
        deviceHubMode: hubMode,
        deviceHubPids: hubPids.join(',') || '(none)',
        simulatorUiPids: uiPids.join(',') || '(none)',
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
  /** Disarm probes (teardown / finally). Does not emit `:complete`. */
  stop: () => void;
  /**
   * WebDriver session id exists — emit `:complete` and disarm recover/abort.
   * Call as soon as POST /session succeeds; do not wait for `afterSession`.
   */
  markSessionCreated: (sessionId?: string) => void;
};

export type SessionCreateHangProbeEvidence = {
  /** Simulator list state when readable (`Booted`, `Shutdown`, …). */
  state?: string;
  /** True when list/bootstatus surfaced ETIMEDOUT (or equivalent). */
  xcrunEtimedout: boolean;
  /** True when the UDID was missing from list (often accompanies list ETIMEDOUT). */
  listMissing?: boolean;
};

export type SessionCreateHangDecision =
  | { action: 'continue' }
  | { action: 'recover'; reason: string }
  | { action: 'skip-recover'; reason: string }
  | { action: 'abort'; reason: string };

/** States where WDA terminate cannot help — Appium's boot monitor owns the guest. */
export function isSimulatorTransitionState(simState: string | undefined): boolean {
  return simState === 'Shutdown' || simState === 'Booting';
}

/**
 * Decide whether a prolonged POST /session hang should keep waiting, attempt
 * one WDA settle recovery, or abort early with a clear `[e2e-ios-boot]` error.
 * Pure: injectable clocks/exec live in the watchdog wrapper.
 * Never recover/abort once `postSessionInFlight` is false (session id exists).
 */
export function decideSessionCreateHangAction(input: {
  hangTick: number;
  consecutiveXcrunEtimedout: number;
  /** Latest probe state when known (`Booted` still counts as WDA-not-ready under ETIMEDOUT). */
  simState?: string;
  recoveredOnce: boolean;
  recoverAfterTicks?: number;
  abortAfterTicks?: number;
  /**
   * True only while POST /session is still open. Defaults true for call sites
   * that have not yet threaded the flag; false disarms recover/abort.
   */
  postSessionInFlight?: boolean;
}): SessionCreateHangDecision {
  if (input.postSessionInFlight === false) {
    return { action: 'continue' };
  }
  const recoverAfter =
    input.recoverAfterTicks ?? IOS_SESSION_CREATE_HANG_RECOVER_AFTER_TICKS;
  const abortAfter = input.abortAfterTicks ?? IOS_SESSION_CREATE_HANG_ABORT_AFTER_TICKS;
  const etimedoutStreak = input.consecutiveXcrunEtimedout;
  if (etimedoutStreak <= 0) {
    return { action: 'continue' };
  }
  const transitioning = isSimulatorTransitionState(input.simState);
  const bootedOrUnknown =
    input.simState == null ||
    input.simState === 'Booted' ||
    input.simState === '(missing)';
  if (!bootedOrUnknown && !transitioning) {
    return { action: 'continue' };
  }
  if (input.hangTick >= abortAfter && etimedoutStreak >= 2) {
    const bootMonitorNote = transitioning
      ? '; interrupting Appium boot monitor while simulator is Shutdown/Booting (often isHeadless=false relaunch)'
      : '';
    return {
      action: 'abort',
      reason:
        `POST /session hung with prolonged xcrun ETIMEDOUT (hangTick=${input.hangTick}, ` +
        `consecutiveEtimedout=${etimedoutStreak}, state=${input.simState ?? 'unknown'}); ` +
        `WDA not ready — aborting before supervisor ceiling${bootMonitorNote}`,
    };
  }
  if (
    input.hangTick >= recoverAfter &&
    etimedoutStreak >= 1 &&
    !input.recoveredOnce
  ) {
    if (transitioning) {
      return {
        action: 'skip-recover',
        reason:
          `recoverSkipped: simulator state=${input.simState} — skip WDA terminate; ` +
          `Appium boot monitor owns Shutdown/Booting (check appium:isHeadless)`,
      };
    }
    return {
      action: 'recover',
      reason:
        `POST /session hang with xcrun ETIMEDOUT (hangTick=${input.hangTick}, ` +
        `state=${input.simState ?? 'unknown'}); attempting WDA terminate + settle`,
    };
  }
  return { action: 'continue' };
}

/** Parse hang-probe diagnostic line fields into structured evidence. */
export function sessionCreateHangEvidenceFromProbeLine(
  line: string,
): SessionCreateHangProbeEvidence {
  const xcrunEtimedout =
    /\bETIMEDOUT\b/i.test(line) ||
    /\btimedOut=true\b/.test(line) ||
    /\blistError=.*ETIMEDOUT/i.test(line);
  const stateMatch = /\bstate=(\S+)/.exec(line);
  const state = stateMatch?.[1];
  const listMissing = /\bfound=false\b/.test(line) || state === '(missing)';
  return { state, xcrunEtimedout, listMissing };
}

/**
 * Best-effort WDA terminate + short settle so a stuck POST /session can fail
 * or recover without waiting out the full supervisor ceiling.
 */
export function recoverIosSessionCreateHang(
  udid: string,
  options?: {
    execCapture?: ExecCapture;
    sleep?: (ms: number) => void;
    bundleIds?: readonly string[];
    settleMs?: number;
  },
): void {
  const exec = options?.execCapture ?? defaultExecCapture;
  const sleep = options?.sleep ?? sleepSync;
  const bundles = options?.bundleIds ?? IOS_WDA_TERMINATE_BUNDLE_IDS;
  for (const bundleId of bundles) {
    exec('xcrun', ['simctl', 'terminate', udid, bundleId], { timeoutMs: 15_000 });
  }
  sleep(options?.settleMs ?? IOS_BOOT_SETTLE_MS);
}

export function formatSessionCreateHangAbortError(reason: string): Error {
  return new Error(`[e2e-ios-boot] session-create abort: ${reason}`);
}

/**
 * While WDIO's POST /session is in flight, periodically re-emit `[e2e-ios-boot]`
 * lines plus an Appium/WDA hang hint. After prolonged xcrun ETIMEDOUT evidence,
 * optionally recover once (terminate WDA) then abort early via `onAbort` instead
 * of burning the full supervisor ceiling. Call `markSessionCreated` (or `stop`)
 * as soon as a session id exists — never WDA-terminate mid-suite.
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
    simulatorUiPids?: readonly number[];
    recoverAfterTicks?: number;
    abortAfterTicks?: number;
    bootstatusTimeoutMs?: number;
    /**
     * Optional mutable ref updated when Appium emits
     * `xcodebuild exited with code 'N'` (see noteXcodebuildExitFromLine).
     */
    lastXcodebuildExitRef?: { value: number | null };
    /**
     * Launcher→worker sidecar path (`xcodebuildExitStatePath`). Worker hang
     * snapshots read this because Appium `[Xcode]` lines are printed in the
     * launcher process, not the Mocha worker.
     */
    lastXcodebuildExitStatePath?: string;
    /** Invoked once when decision is `recover` (defaults to terminate WDA + settle). */
    onRecover?: (udid: string, reason: string) => void;
    /** Invoked when decision is `abort` (parent should recordFailure / drain). */
    onAbort?: (error: Error) => void;
  },
): IosSessionCreateHangWatchdog {
  const write = options.write ?? ((line: string) => console.log(line));
  const clock = options.clock ?? realHangClock;
  const intervalMs = options.intervalMs ?? IOS_SESSION_CREATE_HANG_POLL_MS;
  const now = options.now ?? (() => new Date());
  const bootstatusTimeoutMs =
    options.bootstatusTimeoutMs ?? IOS_BOOTSTATUS_PROBE_TIMEOUT_MS;
  let ticks = 0;
  let stopped = false;
  /** False once a WebDriver session id exists — gates recover/abort. */
  let postSessionInFlight = true;
  let consecutiveXcrunEtimedout = 0;
  let recoveredOnce = false;
  let lastSimState: string | undefined;
  let lastBootstatusTimedOut: boolean | undefined;

  const emitSessionSnapshot = (sessionPhase: string): void => {
    emitIosSessionCreateDiagnostics(
      udid,
      {
        phase: sessionPhase,
        listState: lastSimState,
        bootstatusTimedOut: lastBootstatusTimedOut,
        bootstatusProbeTimeoutMs: bootstatusTimeoutMs,
        lastXcodebuildExit: resolveLastXcodebuildExit({
          lastXcodebuildExitRef: options.lastXcodebuildExitRef,
          lastXcodebuildExitStatePath: options.lastXcodebuildExitStatePath,
        }),
        derivedDataPath: SESSION_WDA_DERIVED_DATA_PATH,
        wdaRunnerAppPath: SESSION_WDA_RUNNER_APP_PATH,
        execCapture: options.execCapture as SessionExecCapture | undefined,
        now,
      },
      write,
    );
  };

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

  let timer: unknown;
  const disarm = (): void => {
    postSessionInFlight = false;
    if (stopped) {
      return;
    }
    stopped = true;
    if (timer != null) {
      clock.clearInterval(timer);
    }
  };

  timer = clock.setInterval(() => {
    if (stopped || !postSessionInFlight) {
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
    const probeLines = collectIosBootDiagnosticLines(udid, {
      phase: `${options.phase}:hang-probe`,
      simulatorStartupTimeoutMs: options.simulatorStartupTimeoutMs,
      execCapture: options.execCapture,
      bootstatusTimeoutMs,
      deviceHubMode: options.deviceHubMode,
      deviceHubPids: options.deviceHubPids,
      simulatorUiPids: options.simulatorUiPids,
      now,
    });
    let probeSawEtimedout = false;
    for (const line of probeLines) {
      write(line);
      const evidence = sessionCreateHangEvidenceFromProbeLine(line);
      if (evidence.state != null) {
        lastSimState = evidence.state;
      }
      if (evidence.xcrunEtimedout) {
        probeSawEtimedout = true;
        consecutiveXcrunEtimedout += 1;
        lastBootstatusTimedOut = true;
      } else {
        consecutiveXcrunEtimedout = 0;
        lastBootstatusTimedOut = false;
      }
    }
    // When hang-probe sees xcrun ETIMEDOUT, emit WDA/xcodebuild snapshot so the
    // next identical failure proves process state + log artifact paths.
    if (probeSawEtimedout) {
      emitSessionSnapshot(`${options.phase}:hang-probe`);
    }

    // Session may have completed while probes ran — never recover/abort after.
    if (stopped || !postSessionInFlight) {
      return;
    }

    const decision = decideSessionCreateHangAction({
      hangTick: ticks,
      consecutiveXcrunEtimedout,
      simState: lastSimState,
      recoveredOnce,
      recoverAfterTicks: options.recoverAfterTicks,
      abortAfterTicks: options.abortAfterTicks,
      postSessionInFlight,
    });

    if (decision.action === 'skip-recover') {
      // Count as the one recovery opportunity so we do not re-log every tick.
      recoveredOnce = true;
      write(
        formatIosBootDiagnosticLine(
          {
            phase: `${options.phase}:hang-recoverSkipped`,
            udid,
            elapsedMs: ticks * intervalMs,
            listState: lastSimState,
            hint: decision.reason,
          },
          now,
        ),
      );
      emitSessionSnapshot(`${options.phase}:hang-recoverSkipped`);
      return;
    }

    if (decision.action === 'recover') {
      if (stopped || !postSessionInFlight) {
        return;
      }
      recoveredOnce = true;
      write(
        formatIosBootDiagnosticLine(
          {
            phase: `${options.phase}:hang-recover`,
            udid,
            elapsedMs: ticks * intervalMs,
            hint: decision.reason,
          },
          now,
        ),
      );
      // Capture WDA/xcodebuild state *before* terminate so exit-65 cause paths
      // survive the recover kill (cannot hurt; clarifies next failure).
      emitSessionSnapshot(`${options.phase}:hang-recover`);
      const recover =
        options.onRecover ??
        ((target: string) =>
          recoverIosSessionCreateHang(target, {
            execCapture: options.execCapture,
          }));
      try {
        // Final gate: session id may have landed between decide and recover.
        if (stopped || !postSessionInFlight) {
          return;
        }
        recover(udid, decision.reason);
      } catch (error) {
        write(
          formatIosBootDiagnosticLine(
            {
              phase: `${options.phase}:hang-recover-error`,
              udid,
              error: error instanceof Error ? error.message : String(error),
            },
            now,
          ),
        );
      }
      return;
    }

    if (decision.action === 'abort') {
      if (stopped || !postSessionInFlight) {
        return;
      }
      const error = formatSessionCreateHangAbortError(decision.reason);
      write(
        formatIosBootDiagnosticLine(
          {
            phase: `${options.phase}:hang-abort`,
            udid,
            elapsedMs: ticks * intervalMs,
            listState: lastSimState,
            hint: decision.reason,
          },
          now,
        ),
      );
      emitSessionSnapshot(`${options.phase}:hang-abort`);
      disarm();
      options.onAbort?.(error);
    }
  }, intervalMs);

  return {
    stop: () => {
      disarm();
    },
    markSessionCreated: (sessionId?: string) => {
      if (!postSessionInFlight && stopped) {
        return;
      }
      write(
        formatIosBootDiagnosticLine(
          {
            phase: `${options.phase}:complete`,
            udid,
            sessionId: sessionId ?? '(present)',
            hint: 'WebDriver session created; hang recover/abort disarmed',
          },
          now,
        ),
      );
      disarm();
    },
  };
}

/**
 * Update a hang-watchdog exit ref when Appium/Xcode emits an xcodebuild exit line.
 * Returns the parsed code (or null when the line is unrelated).
 */
export function noteXcodebuildExitFromLine(
  line: string,
  lastXcodebuildExitRef: { value: number | null },
): number | null {
  const code = parseXcodebuildExitCodeFromLine(line);
  if (code != null) {
    lastXcodebuildExitRef.value = code;
  }
  return code;
}
