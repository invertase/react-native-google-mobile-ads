/**
 * Structured iOS XCUITest session-create diagnostics for hang-probe / hang-recover
 * / hang-abort. Complements `[e2e-ios-boot]` simctl probes with host WDA/xcodebuild
 * process state, derivedData log paths, and known xcodebuild exit evidence so the
 * next `xcodebuild exited with code '65'` failure is conclusive in job logs +
 * artifacts.
 *
 * Hang-path snapshots must stay off simctl (`get_app_container`, etc.): only host
 * `pgrep` (hard-capped) plus `.wda-derived` filesystem reads.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { createConnection, type Socket } from 'node:net';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Default APPIUM_HOME (same tree as wdio.shared.conf `appiumHome`). */
export const DEFAULT_APPIUM_HOME = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '.appium-home',
);

/**
 * Per-Appium-port sidecar written by the WDIO **launcher** (where @wdio/appium-service
 * forwards Appium `[Xcode]` lines) and read by the worker hang watchdog.
 */
export function xcodebuildExitStatePath(
  appiumPort: number,
  appiumHome: string = DEFAULT_APPIUM_HOME,
): string {
  return join(appiumHome, 'logs', `port-${appiumPort}`, 'last-xcodebuild-exit');
}

export function clearXcodebuildExitState(statePath: string): void {
  try {
    unlinkSync(statePath);
  } catch {
    // missing is fine
  }
}

export function writeXcodebuildExitState(statePath: string, code: number): void {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${code}\n`, 'utf8');
}

export function readXcodebuildExitState(statePath: string): number | null {
  try {
    const raw = readFileSync(statePath, 'utf8').trim();
    const code = Number(raw);
    return Number.isInteger(code) ? code : null;
  } catch {
    return null;
  }
}

/**
 * Resolve last xcodebuild exit from an in-process ref and/or launcher sidecar file.
 * Prefer a concrete ref value; otherwise read the shared file (worker ↔ launcher).
 */
export function resolveLastXcodebuildExit(options: {
  lastXcodebuildExitRef?: { value: number | null };
  lastXcodebuildExitStatePath?: string;
  readState?: (path: string) => number | null;
}): number | null | undefined {
  const hasRef = options.lastXcodebuildExitRef != null;
  const fromRef = options.lastXcodebuildExitRef?.value ?? null;
  if (fromRef != null) {
    return fromRef;
  }
  const statePath = options.lastXcodebuildExitStatePath;
  if (statePath) {
    const fromFile = (options.readState ?? readXcodebuildExitState)(statePath);
    if (fromFile != null) {
      return fromFile;
    }
  }
  if (hasRef || statePath) {
    return null;
  }
  return undefined;
}

/** Stable prefix for session-create WDA/xcodebuild evidence (grep in CI). */
export const E2E_IOS_SESSION_PREFIX = '[e2e-ios-session]';

/** Host `pgrep` bound for hang-path snapshots (must stay << hang-probe simctl budget). */
export const IOS_SESSION_HOST_PGREP_TIMEOUT_MS = 2_000;

/** Default Appium WDA local forwarding port when capability is unset. */
export const IOS_WDA_DEFAULT_LOCAL_PORT = 8_100;

/** Bounded TCP probe for hang ticks — no simctl, no HTTP body fetch. */
export const IOS_WDA_PORT_PROBE_TIMEOUT_MS = 1_500;

export type WdaPortProbeConnect = (options: {
  host: string;
  port: number;
  onConnect: () => void;
  onError: () => void;
  onTimeout: () => void;
  timeoutMs: number;
}) => { destroy: () => void };

const defaultWdaPortProbeConnect: WdaPortProbeConnect = options => {
  const socket: Socket = createConnection({ host: options.host, port: options.port });
  socket.once('connect', options.onConnect);
  socket.once('error', options.onError);
  socket.setTimeout(options.timeoutMs, options.onTimeout);
  return socket;
};

/**
 * Synchronous bounded TCP probe to `127.0.0.1:<wdaLocalPort>`. Uses short
 * `Atomics.wait` polling so hang ticks stay off simctl without stacking async.
 */
export function probeWdaTcpPort(options?: {
  host?: string;
  port?: number;
  timeoutMs?: number;
  connect?: WdaPortProbeConnect;
  wait?: (ms: number) => void;
}): { reachable: boolean } {
  const host = options?.host ?? '127.0.0.1';
  const port = options?.port ?? IOS_WDA_DEFAULT_LOCAL_PORT;
  const timeoutMs = options?.timeoutMs ?? IOS_WDA_PORT_PROBE_TIMEOUT_MS;
  const connect = options?.connect ?? defaultWdaPortProbeConnect;
  const wait =
    options?.wait ??
    ((ms: number) => {
      if (ms > 0) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
      }
    });
  let settled = false;
  let reachable = false;
  let socket: { destroy: () => void } | undefined;
  const finish = (ok: boolean) => {
    if (settled) {
      return;
    }
    settled = true;
    reachable = ok;
    socket?.destroy();
  };
  socket = connect({
    host,
    port,
    timeoutMs,
    onConnect: () => finish(true),
    onError: () => finish(false),
    onTimeout: () => finish(false),
  });
  const deadline = Date.now() + timeoutMs + 250;
  while (!settled && Date.now() < deadline) {
    wait(25);
  }
  if (!settled) {
    finish(false);
  }
  return { reachable };
}

/** XCTest runner bundle launched on the simulator for prebuilt WDA. */
export const IOS_WDA_RUNNER_BUNDLE_ID = 'com.facebook.WebDriverAgentRunner.xctrunner';

/** Poll interval while waiting for WDA TCP after an explicit harness prelaunch. */
export const IOS_WDA_PRELAUNCH_POLL_MS = 2_000;

/**
 * Bounded wait for WDA to accept TCP after recover + fresh WDIO spawn (attempt 2).
 * Fail fast with `*:wda-prelaunch-timeout` instead of burning the hang watchdog.
 */
export const IOS_WDA_PRELAUNCH_PORT_WAIT_MS = 90_000;

export type WaitForWdaTcpPortListeningResult = {
  reachable: boolean;
  elapsedMs: number;
  probes: number;
};

/**
 * Poll {@link probeWdaTcpPort} until the local WDA port accepts TCP or timeout.
 */
export function waitForWdaTcpPortListening(options?: {
  host?: string;
  port?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
  probe?: typeof probeWdaTcpPort;
  connect?: WdaPortProbeConnect;
  now?: () => number;
  sleep?: (ms: number) => void;
}): WaitForWdaTcpPortListeningResult {
  const timeoutMs = options?.timeoutMs ?? IOS_WDA_PRELAUNCH_PORT_WAIT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? IOS_WDA_PRELAUNCH_POLL_MS;
  const probe = options?.probe ?? probeWdaTcpPort;
  const now = options?.now ?? (() => Date.now());
  const sleep =
    options?.sleep ??
    ((ms: number) => {
      if (ms > 0) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
      }
    });
  const host = options?.host ?? '127.0.0.1';
  const port = options?.port ?? IOS_WDA_DEFAULT_LOCAL_PORT;
  const start = now();
  let probes = 0;
  while (now() - start < timeoutMs) {
    probes += 1;
    const result = probe({
      host,
      port,
      connect: options?.connect,
      wait: () => undefined,
    });
    if (result.reachable) {
      return { reachable: true, elapsedMs: now() - start, probes };
    }
    sleep(pollIntervalMs);
  }
  return { reachable: false, elapsedMs: now() - start, probes };
}

/**
 * Gate harness WDA prelaunch before POST /session.
 *
 * - Attempt 2+: always when prebuilt mode is enabled (recover terminated WDA).
 * - Attempt 1: only when `RNGMA_IOS_WDA_PRELAUNCH=1` (cheap opt-in; Appium owns
 *   the default first launch).
 */
export function shouldPrelaunchWdaBeforeSessionCreate(input: {
  sessionCreateAttempt: number;
  wdaPrebuiltEnabled?: boolean;
  eagerPrelaunch?: boolean;
}): boolean {
  if (input.sessionCreateAttempt > 1) {
    return input.wdaPrebuiltEnabled !== false;
  }
  return input.wdaPrebuiltEnabled === true && input.eagerPrelaunch === true;
}

export type SpawnDetachedProcess = (
  bin: string,
  args: readonly string[],
) => ChildProcess;

export function defaultSpawnDetachedProcess(
  bin: string,
  args: readonly string[],
): ChildProcess {
  const child = spawn(bin, [...args], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child;
}

/** Resolve Appium's pinned `WebDriverAgent.xcodeproj` (same tree as prebuild-wda). */
export function resolveWebDriverAgentXcodeProjectPath(
  resolveModule: (request: string) => string = createRequire(import.meta.url).resolve,
): string {
  const xcuitestPkg = resolveModule('appium-xcuitest-driver/package.json');
  const xcuitestRequire = createRequire(xcuitestPkg);
  const wdaPkg = xcuitestRequire.resolve('appium-webdriveragent/package.json');
  return join(dirname(wdaPkg), 'WebDriverAgent.xcodeproj');
}

export type LaunchPrebuiltWdaRunnerOptions = {
  derivedDataPath: string;
  wdaRunnerAppPath: string;
  execCapture?: SessionExecCapture;
  spawnDetached?: SpawnDetachedProcess;
  resolveXcodeProject?: typeof resolveWebDriverAgentXcodeProjectPath;
  bundleId?: string;
};

/**
 * Install (idempotent) and start the shared prebuilt WDA runner on a Booted sim.
 * Prefer launch-only `xcodebuild test-without-building` (Appium parity); fall back
 * to `simctl launch` when the Xcode project cannot be resolved (unit tests).
 */
export function launchPrebuiltWdaRunnerOnSimulator(
  udid: string,
  options: LaunchPrebuiltWdaRunnerOptions,
): { launchMode: 'xcodebuild' | 'simctl' } {
  const exec = options.execCapture ?? defaultSessionExecCapture;
  const bundleId = options.bundleId ?? IOS_WDA_RUNNER_BUNDLE_ID;
  const install = exec(
    'xcrun',
    ['simctl', 'install', udid, options.wdaRunnerAppPath],
    { timeoutMs: 120_000 },
  );
  if (install.status !== 0) {
    throw new Error(
      `WDA prelaunch simctl install failed (status=${install.status ?? 'null'}): ${
        install.stderr || install.stdout || install.error || '(no output)'
      }`,
    );
  }
  try {
    const project = (options.resolveXcodeProject ?? resolveWebDriverAgentXcodeProjectPath)();
    const spawnDetached = options.spawnDetached ?? defaultSpawnDetachedProcess;
    spawnDetached('xcodebuild', [
      '-project',
      project,
      '-scheme',
      'WebDriverAgentRunner',
      '-destination',
      `id=${udid}`,
      '-derivedDataPath',
      options.derivedDataPath,
      'test-without-building',
    ]);
    return { launchMode: 'xcodebuild' };
  } catch {
    const launch = exec('xcrun', ['simctl', 'launch', udid, bundleId], {
      timeoutMs: 30_000,
    });
    if (launch.status !== 0) {
      throw new Error(
        `WDA prelaunch simctl launch failed (status=${launch.status ?? 'null'}): ${
          launch.stderr || launch.stdout || launch.error || '(no output)'
        }`,
      );
    }
    return { launchMode: 'simctl' };
  }
}

export type EnsureWdaListeningBeforeSessionCreateOptions = {
  sessionCreateAttempt: number;
  wdaLocalPort?: number;
  derivedDataPath: string;
  wdaRunnerAppPath: string;
  wdaPrebuiltEnabled?: boolean;
  eagerPrelaunch?: boolean;
  phasePrefix?: string;
  write?: (line: string) => void;
  now?: () => Date;
  launchRunner?: typeof launchPrebuiltWdaRunnerOnSimulator;
  waitForPort?: typeof waitForWdaTcpPortListening;
  probeWdaPort?: typeof probeWdaTcpPort;
};

/**
 * When gated ({@link shouldPrelaunchWdaBeforeSessionCreate}), launch prebuilt WDA
 * and poll until the forwarded local port is up. Throws with a stable phase token
 * on timeout so attempt 2 does not re-enter the 90s hang watchdog with port=down.
 */
export function ensureWdaListeningBeforeSessionCreate(
  udid: string,
  options: EnsureWdaListeningBeforeSessionCreateOptions,
): WaitForWdaTcpPortListeningResult | undefined {
  const shouldPrelaunch = shouldPrelaunchWdaBeforeSessionCreate({
    sessionCreateAttempt: options.sessionCreateAttempt,
    wdaPrebuiltEnabled: options.wdaPrebuiltEnabled,
    eagerPrelaunch: options.eagerPrelaunch,
  });
  const port = options.wdaLocalPort ?? IOS_WDA_DEFAULT_LOCAL_PORT;
  const write = options.write ?? (line => console.log(line));
  const now = options.now ?? (() => new Date());
  const phaseBase =
    options.phasePrefix ??
    (options.sessionCreateAttempt > 1
      ? 'serial:session-create-retry'
      : 'serial:session-create');

  if (!shouldPrelaunch) {
    return undefined;
  }

  write(
    formatIosSessionDiagnosticLine(
      {
        phase: `${phaseBase}:wda-prelaunch:start`,
        udid,
        wdaLocalPort: port,
        sessionCreateAttempt: options.sessionCreateAttempt,
      },
      now,
    ),
  );

  const launch = (options.launchRunner ?? launchPrebuiltWdaRunnerOnSimulator)(udid, {
    derivedDataPath: options.derivedDataPath,
    wdaRunnerAppPath: options.wdaRunnerAppPath,
  });
  write(
    formatIosSessionDiagnosticLine(
      {
        phase: `${phaseBase}:wda-prelaunch:launch`,
        udid,
        launchMode: launch.launchMode,
        derivedDataPath: options.derivedDataPath,
      },
      now,
    ),
  );

  const waitForPort = options.waitForPort ?? waitForWdaTcpPortListening;
  const wait = waitForPort({
    port,
    probe: options.probeWdaPort,
  });

  write(
    formatIosSessionDiagnosticLine(
      {
        phase: wait.reachable
          ? `${phaseBase}:wda-prelaunch:ready`
          : `${phaseBase}:wda-prelaunch-timeout`,
        udid,
        wdaLocalPort: port,
        wdaPortReachable: wait.reachable,
        elapsedMs: wait.elapsedMs,
        probes: wait.probes,
      },
      now,
    ),
  );

  if (!wait.reachable) {
    throw new Error(
      `[e2e-ios-session] phase=${phaseBase}:wda-prelaunch-timeout udid=${udid} wdaLocalPort=${port} elapsedMs=${wait.elapsedMs} probes=${wait.probes}`,
    );
  }
  return wait;
}

/** Host process name markers used when listing WDA / xcodebuild PIDs. */
export const IOS_WDA_HOST_PROCESS_MARKERS = [
  'xcodebuild',
  'WebDriverAgent',
  'WebDriverAgentRunner',
] as const;

export type SessionExecCaptureResult = {
  stdout: string;
  stderr: string;
  status: number | null;
  timedOut?: boolean;
  error?: string;
};

export type SessionExecCapture = (
  bin: string,
  args: string[],
  options?: { timeoutMs?: number },
) => SessionExecCaptureResult;

export function defaultSessionExecCapture(
  bin: string,
  args: string[],
  options?: { timeoutMs?: number },
): SessionExecCaptureResult {
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

export function formatIosSessionDiagnosticLine(
  fields: Record<string, string | number | boolean | null | undefined>,
  now: () => Date = () => new Date(),
): string {
  const body = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  return `${E2E_IOS_SESSION_PREFIX} ts=${now().toISOString()} ${body}`;
}

/**
 * Parse Appium/XCUITest `[Xcode] xcodebuild exited with code 'N'` lines into an
 * exit code. Pure — used when annotating supervised child output or tests.
 */
export function parseXcodebuildExitCodeFromLine(line: string): number | null {
  const match =
    /xcodebuild exited with code ['"]?(-?\d+)['"]?/i.exec(line) ??
    /xcodebuild failed with code (-?\d+)/i.exec(line);
  if (match?.[1] == null) {
    return null;
  }
  const code = Number(match[1]);
  return Number.isInteger(code) ? code : null;
}

/**
 * Classify an optional guest-install probe result without collapsing timeouts
 * into `installed=no`. Hang-path snapshots do not call simctl; this helper is
 * for callers that still probe and must emit `timedOut` / `unknown`.
 */
export type WdaBundleInstallProbeStatus = 'yes' | 'no' | 'timedOut' | 'unknown';

export function classifyWdaBundleInstallProbe(
  result: SessionExecCaptureResult,
): WdaBundleInstallProbeStatus {
  if (result.timedOut === true || /\bETIMEDOUT\b/i.test(result.error ?? '')) {
    return 'timedOut';
  }
  if (result.error && result.status == null) {
    return 'unknown';
  }
  if (result.status === 0 && result.stdout.trim() !== '') {
    return 'yes';
  }
  if (result.status === 0 || result.status === 1) {
    return 'no';
  }
  return 'unknown';
}

export type HostProcessPidSnapshot = {
  marker: string;
  pids: number[];
  /** True when the host pgrep itself timed out (PIDs may be incomplete). */
  timedOut?: boolean;
  /**
   * True when at least one matched `xcodebuild` line carries a genuine build
   * action (`build` / `build-for-testing`) rather than the launch-only
   * `test` / `test-without-building` actions `usePrebuiltWDA` always uses
   * (see {@link pgrepFlLineIsXcodebuildBuildAction}). Unset for non-xcodebuild
   * markers.
   */
  isBuildAction?: boolean;
};

/**
 * True when a `pgrep -fl` line is an xcodebuild process (argv0 or path).
 * WDA markers (`WebDriverAgent*`) also match `xcodebuild … -scheme WebDriverAgentRunner`
 * and must not be double-counted as host WDA PIDs.
 */
export function pgrepFlLineIsXcodebuild(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') {
    return false;
  }
  // Drop leading PID, then match argv0 / path ending in xcodebuild.
  const cmd = trimmed.replace(/^\d+\s+/, '');
  return /(^|\/)xcodebuild(\s|$)/.test(cmd);
}

/**
 * `xcodebuild` action tokens that genuinely compile sources. `usePrebuiltWDA`
 * (appium-webdriveragent `xcodebuild.js` `getCommand`) only ever runs the
 * launch-only `test` / `test-without-building` actions against the already-
 * built product — never these — so a live xcodebuild process is expected
 * (and must not defeat the live-PID defer gate) unless one of these appears.
 */
const XCODEBUILD_BUILD_ACTIONS = new Set(['build', 'build-for-testing']);

/**
 * True when a `pgrep -fl xcodebuild` line's action token is a genuine build
 * (`build` / `build-for-testing`) rather than a launch-only `test` /
 * `test-without-building` invocation. Token-exact (not substring) so
 * `test-without-building` never matches `build`.
 */
export function pgrepFlLineIsXcodebuildBuildAction(line: string): boolean {
  const tokens = line.trim().split(/\s+/);
  return tokens.some(token => XCODEBUILD_BUILD_ACTIONS.has(token));
}

/** Parse `pgrep -fl` stdout into PIDs; optionally skip xcodebuild command lines. */
export function parsePgrepFlPids(
  stdout: string,
  options?: { excludeXcodebuildCmd?: boolean },
): number[] {
  const pids: number[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    if (options?.excludeXcodebuildCmd === true && pgrepFlLineIsXcodebuild(trimmed)) {
      continue;
    }
    const pid = Number(trimmed.split(/\s+/)[0]);
    if (Number.isInteger(pid) && pid > 0) {
      pids.push(pid);
    }
  }
  return pids;
}

/**
 * List host PIDs whose command line matches WDA / xcodebuild markers (pgrep -fl).
 * Injectable exec keeps unit tests off the live process table. Hard-capped so
 * hang-path diagnostics cannot stack multi-second simctl waits.
 *
 * For non-`xcodebuild` markers, lines whose command is xcodebuild are omitted
 * so `hostXcodebuildPids` and `hostWdaPids` do not share the same PID string.
 */
export function listWdaRelatedHostProcesses(
  execCapture: SessionExecCapture = defaultSessionExecCapture,
  markers: readonly string[] = IOS_WDA_HOST_PROCESS_MARKERS,
  timeoutMs: number = IOS_SESSION_HOST_PGREP_TIMEOUT_MS,
): HostProcessPidSnapshot[] {
  return markers.map(marker => {
    const result = execCapture('pgrep', ['-fl', marker], { timeoutMs });
    if (result.timedOut) {
      return { marker, pids: [], timedOut: true };
    }
    const excludeXcodebuildCmd = marker !== 'xcodebuild';
    const pids =
      result.status === 0 || result.stdout.trim() !== ''
        ? parsePgrepFlPids(result.stdout, { excludeXcodebuildCmd })
        : [];
    if (marker !== 'xcodebuild') {
      return { marker, pids };
    }
    const isBuildAction = result.stdout
      .split(/\r?\n/)
      .some(line => line.trim() !== '' && pgrepFlLineIsXcodebuildBuildAction(line));
    return { marker, pids, isBuildAction };
  });
}

/**
 * Collapse marker snapshots into diagnostic PID fields. WDA PIDs never include
 * PIDs already listed under xcodebuild (belt-and-suspenders vs pgrep overlap).
 */
export function formatHostPidFieldsFromSnapshots(
  hostProcs: HostProcessPidSnapshot[],
): {
  hostXcodebuildPids: string;
  hostWdaPids: string;
  hostPgrepTimedOut: boolean;
  /**
   * True only when a live `xcodebuild` process is running a genuine build
   * action — never true for the launch-only `test` / `test-without-building`
   * actions `usePrebuiltWDA` always uses to start the already-built WDA.
   */
  hostXcodebuildBuilding: boolean;
} {
  const xcodebuild = hostProcs.find(item => item.marker === 'xcodebuild');
  const wdaHost = hostProcs.filter(item => item.marker !== 'xcodebuild');
  const hostPgrepTimedOut = hostProcs.some(item => item.timedOut === true);
  const xcodebuildPids = new Set(xcodebuild?.pids ?? []);
  const hostXcodebuildPids =
    xcodebuild?.timedOut === true
      ? 'timedOut'
      : xcodebuild?.pids.join(',') || '(none)';
  const hostXcodebuildBuilding = xcodebuild?.isBuildAction === true;
  let hostWdaPids: string;
  if (wdaHost.some(item => item.timedOut === true)) {
    hostWdaPids = 'timedOut';
  } else {
    hostWdaPids =
      wdaHost
        .flatMap(item => item.pids)
        .filter(pid => !xcodebuildPids.has(pid))
        .filter((pid, index, all) => all.indexOf(pid) === index)
        .join(',') || '(none)';
  }
  return { hostXcodebuildPids, hostWdaPids, hostPgrepTimedOut, hostXcodebuildBuilding };
}

export type WdaDerivedDataLogPath = {
  path: string;
  bytes: number;
  mtimeMs: number;
};

/**
 * Enumerate known WDA DerivedData log / result locations under the shared
 * prebuild path. Pure filesystem — no xcrun. Caller supplies the DerivedData
 * root (typically `IOS_WDA_DERIVED_DATA_PATH`) to avoid hostPreflight cycles.
 */
export function listWdaDerivedDataLogPaths(
  derivedDataPath: string,
  options?: {
    maxEntries?: number;
    existsSyncFn?: typeof existsSync;
    readdirSyncFn?: typeof readdirSync;
    statSyncFn?: typeof statSync;
  },
): WdaDerivedDataLogPath[] {
  const exists = options?.existsSyncFn ?? existsSync;
  const readdir = options?.readdirSyncFn ?? readdirSync;
  const stat = options?.statSyncFn ?? statSync;
  const maxEntries = options?.maxEntries ?? 12;
  if (!exists(derivedDataPath)) {
    return [];
  }

  const candidates: string[] = [];
  const roots = [
    join(derivedDataPath, 'Logs'),
    join(derivedDataPath, 'Logs', 'Build'),
    join(derivedDataPath, 'Logs', 'Test'),
  ];
  for (const dir of roots) {
    if (!exists(dir)) {
      continue;
    }
    let entries: string[] = [];
    try {
      entries = readdir(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = join(dir, name);
      candidates.push(full);
      try {
        if (stat(full).isDirectory() && !/\.xcresult$/i.test(name)) {
          for (const child of readdir(full).slice(0, 20)) {
            candidates.push(join(full, child));
          }
        }
      } catch {
        // ignore unreadable children
      }
    }
  }

  const out: WdaDerivedDataLogPath[] = [];
  const seen = new Set<string>();
  for (const path of candidates) {
    if (seen.has(path)) {
      continue;
    }
    try {
      const info = stat(path);
      if (info.isDirectory()) {
        if (/\.xcresult$/i.test(path)) {
          seen.add(path);
          out.push({ path, bytes: info.size, mtimeMs: info.mtimeMs });
        }
        continue;
      }
      if (
        !info.isFile() ||
        (!/\.(xcactivitylog|log|txt|json)$/i.test(path) && !/xcodebuild/i.test(path))
      ) {
        continue;
      }
      seen.add(path);
      out.push({
        path,
        bytes: info.size,
        mtimeMs: info.mtimeMs,
      });
    } catch {
      // ignore
    }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out.slice(0, maxEntries);
}

export type IosSessionCreateDiagnosticSnapshot = {
  udid: string;
  listState: string;
  bootstatusTimedOut?: boolean;
  bootstatusProbeTimeoutMs: number;
  wdaRunnerAppPresent: boolean;
  wdaRunnerAppPath: string;
  derivedDataPath: string;
  derivedDataExists: boolean;
  hostXcodebuildPids: string;
  hostWdaPids: string;
  hostPgrepTimedOut: boolean;
  /** See {@link formatHostPidFieldsFromSnapshots}. */
  hostXcodebuildBuilding: boolean;
  lastXcodebuildExit: string;
  wdaLogPaths: string;
  wdaLogPathCount: number;
};

export type CollectIosSessionCreateDiagnosticsOptions = {
  phase: string;
  listState?: string;
  bootstatusTimedOut?: boolean;
  /** Hang-probe `simctl bootstatus` spawnSync bound (instrumented into the line). */
  bootstatusProbeTimeoutMs: number;
  /**
   * Explicit exit when already resolved. Prefer `resolveLastXcodebuildExit` at
   * the call site (ref + launcher sidecar) so workers are not stuck at unknown.
   */
  lastXcodebuildExit?: number | null;
  /** Shared WDA DerivedData root (required — typically `IOS_WDA_DERIVED_DATA_PATH`). */
  derivedDataPath: string;
  /** Prebuilt runner `.app` path (required — typically `IOS_WDA_RUNNER_APP_PATH`). */
  wdaRunnerAppPath: string;
  /** Optional recover-skip / triage reason (grep in CI). */
  reason?: string;
  execCapture?: SessionExecCapture;
  existsSyncFn?: typeof existsSync;
  listLogPaths?: (derivedDataPath: string) => WdaDerivedDataLogPath[];
  now?: () => Date;
};

/**
 * Collect a hang-path session-create snapshot: host pgrep + DerivedData fs only.
 * Never calls `xcrun simctl` (including `get_app_container`).
 */
export function collectIosSessionCreateDiagnosticSnapshot(
  udid: string,
  options: CollectIosSessionCreateDiagnosticsOptions,
): IosSessionCreateDiagnosticSnapshot {
  const exec = options.execCapture ?? defaultSessionExecCapture;
  const exists = options.existsSyncFn ?? existsSync;
  const derivedDataPath = options.derivedDataPath;
  const wdaRunnerAppPath = options.wdaRunnerAppPath;
  const hostProcs = listWdaRelatedHostProcesses(exec);
  const { hostXcodebuildPids, hostWdaPids, hostPgrepTimedOut, hostXcodebuildBuilding } =
    formatHostPidFieldsFromSnapshots(hostProcs);
  const logPaths = (options.listLogPaths ?? listWdaDerivedDataLogPaths)(derivedDataPath);
  const lastExit =
    options.lastXcodebuildExit === undefined
      ? '(unknown)'
      : options.lastXcodebuildExit == null
        ? '(none)'
        : String(options.lastXcodebuildExit);

  return {
    udid,
    listState: options.listState ?? '(unknown)',
    bootstatusTimedOut: options.bootstatusTimedOut,
    bootstatusProbeTimeoutMs: options.bootstatusProbeTimeoutMs,
    wdaRunnerAppPresent: exists(wdaRunnerAppPath),
    wdaRunnerAppPath,
    derivedDataPath,
    derivedDataExists: exists(derivedDataPath),
    hostXcodebuildPids,
    hostWdaPids,
    hostPgrepTimedOut,
    hostXcodebuildBuilding,
    lastXcodebuildExit: lastExit,
    wdaLogPaths:
      logPaths.map(item => `${item.path}(${item.bytes}b)`).join(',') || '(none)',
    wdaLogPathCount: logPaths.length,
  };
}

/**
 * True when a hang-path PID field is not the empty sentinel. `timedOut` counts
 * as live/uncertain — do not kill WDA while pgrep itself failed.
 */
export function hostPidsIndicateLiveBuild(pidsField: string): boolean {
  return pidsField !== '(none)';
}

/**
 * Gate hang-recover / hang-abort while host xcodebuild and/or WDA PIDs are
 * still alive (or pgrep timed out).
 *
 * - Default (ETIMEDOUT recover): defer only when `lastXcodebuildExit` is
 *   none/unknown — a concrete exit means the build finished and terminate is OK.
 * - `deferRegardlessOfExit` (Booted-without-ETIMEDOUT recover, and abort):
 *   defer whenever PIDs are live, even if exit is `0`/`65` (stale sidecar or
 *   a follow-on build). Never kill / abort-early over a live host build.
 */
export function shouldDeferHangRecoverForLiveHostBuild(input: {
  hostXcodebuildPids: string;
  hostWdaPids: string;
  lastXcodebuildExit: string;
  /** When true, live PIDs alone defer — ignore exit label. */
  deferRegardlessOfExit?: boolean;
}): { defer: boolean; reason?: string } {
  const live =
    hostPidsIndicateLiveBuild(input.hostXcodebuildPids) ||
    hostPidsIndicateLiveBuild(input.hostWdaPids);
  if (!live) {
    return { defer: false };
  }
  if (input.deferRegardlessOfExit !== true) {
    const exitUnknown =
      input.lastXcodebuildExit === '(none)' ||
      input.lastXcodebuildExit === '(unknown)';
    if (!exitUnknown) {
      return { defer: false };
    }
  }
  return {
    defer: true,
    reason:
      `recoverSkipped: host build still live ` +
      `(hostXcodebuildPids=${input.hostXcodebuildPids}, hostWdaPids=${input.hostWdaPids}) ` +
      `and lastXcodebuildExit=${input.lastXcodebuildExit} — defer WDA terminate / abort until ` +
      `host PIDs clear` +
      (input.deferRegardlessOfExit === true
        ? ' (live PIDs gate ignores exit label)'
        : ' or xcodebuild exit becomes known'),
  };
}

/**
 * Durable hang-recover snapshot root beside DerivedData (not under it).
 * Appium/xcodebuild reclaim `.wda-derived` between WDIO sessions and wipe
 * anything staged under DerivedData before CI `wda_xcodebuild_logs` upload.
 */
export function hangRecoverDurableRoot(derivedDataPath: string): string {
  return join(dirname(derivedDataPath), '.hang-recover-snapshots');
}

/** Default staging dir for pre-kill / hang-abort log copies (survives DerivedData wipe). */
export function hangRecoverArtifactSnapshotDir(derivedDataPath: string): string {
  return join(hangRecoverDurableRoot(derivedDataPath), 'last');
}

/** Appium server log path under APPIUM_HOME (matches wdio `--log` arg). */
export function appiumServerLogPath(
  appiumHome: string = DEFAULT_APPIUM_HOME,
  appiumPort: number,
): string {
  return join(appiumHome, 'logs', `port-${appiumPort}`, 'appium.log');
}

export type HangPathArtifactSnapshotResult = {
  destDir: string;
  copiedPaths: string[];
  errors: string[];
};

/**
 * Copy `.xcresult` bundles + DerivedData log files into `destDir` before a
 * hang-recover kill (or on hang-abort / supervisor-path abort) so
 * upload-artifact still has evidence if terminate races the writer.
 * Best-effort; never throws. Continues with Appium / extra logs even when
 * DerivedData is missing so the 180s supervisor backstop still stages evidence.
 */
export function snapshotWdaDerivedDataForHangRecover(
  derivedDataPath: string,
  destDir: string,
  options?: {
    listLogPaths?: (derivedDataPath: string) => WdaDerivedDataLogPath[];
    existsSyncFn?: typeof existsSync;
    mkdirSyncFn?: typeof mkdirSync;
    copyFileSyncFn?: typeof copyFileSync;
    cpSyncFn?: typeof cpSync;
    statSyncFn?: typeof statSync;
    writeFileSyncFn?: typeof writeFileSync;
    /**
     * Optional Appium home (`tooling/appium/.appium-home`). When set, copies
     * `logs/` into `destDir/appium-logs` so CI globs under hang-recover-snapshots
     * pick them up even when recover never ran.
     */
    appiumHome?: string;
    /**
     * Extra files/dirs (e.g. `/tmp/rngma-e2e/<id>/ios-serial.log`) copied under
     * `destDir/supervisor-child-logs/` before SIGKILL drains owned children.
     */
    extraLogPaths?: readonly string[];
    /** Written into `staging-receipt.txt` so the snapshot dir is never empty. */
    stagingPhase?: string;
  },
): HangPathArtifactSnapshotResult {
  const exists = options?.existsSyncFn ?? existsSync;
  const mkdir = options?.mkdirSyncFn ?? mkdirSync;
  const copyFile = options?.copyFileSyncFn ?? copyFileSync;
  const cp = options?.cpSyncFn ?? cpSync;
  const stat = options?.statSyncFn ?? statSync;
  const writeFile = options?.writeFileSyncFn ?? writeFileSync;
  const copiedPaths: string[] = [];
  const errors: string[] = [];
  try {
    mkdir(destDir, { recursive: true });
  } catch (error) {
    return {
      destDir,
      copiedPaths,
      errors: [
        `mkdir ${destDir}: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  if (!exists(derivedDataPath)) {
    errors.push(`derivedData missing: ${derivedDataPath}`);
  } else {
    const paths = (options?.listLogPaths ?? listWdaDerivedDataLogPaths)(derivedDataPath);
    for (const entry of paths) {
      const name = basename(entry.path);
      const dest = join(destDir, name);
      try {
        const info = stat(entry.path);
        if (info.isDirectory()) {
          cp(entry.path, dest, { recursive: true });
        } else {
          copyFile(entry.path, dest);
        }
        copiedPaths.push(dest);
      } catch (error) {
        errors.push(
          `${entry.path}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  const appiumHome = options?.appiumHome;
  if (appiumHome) {
    const appiumLogs = join(appiumHome, 'logs');
    if (exists(appiumLogs)) {
      const appiumDest = join(destDir, 'appium-logs');
      try {
        cp(appiumLogs, appiumDest, { recursive: true });
        copiedPaths.push(appiumDest);
      } catch (error) {
        errors.push(
          `${appiumLogs}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  const extraLogPaths = options?.extraLogPaths ?? [];
  if (extraLogPaths.length > 0) {
    const childDestRoot = join(destDir, 'supervisor-child-logs');
    try {
      mkdir(childDestRoot, { recursive: true });
    } catch (error) {
      errors.push(
        `mkdir ${childDestRoot}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    for (const src of extraLogPaths) {
      if (!src || !exists(src)) {
        continue;
      }
      const dest = join(childDestRoot, basename(src));
      try {
        const info = stat(src);
        if (info.isDirectory()) {
          cp(src, dest, { recursive: true });
        } else {
          copyFile(src, dest);
        }
        copiedPaths.push(dest);
      } catch (error) {
        errors.push(`${src}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  // Always leave a receipt so CI upload-artifact sees a non-empty tree even when
  // DerivedData/Appium logs were absent at abort time.
  const receiptPath = join(destDir, 'staging-receipt.txt');
  try {
    writeFile(
      receiptPath,
      [
        `phase=${options?.stagingPhase ?? 'hang-path-artifacts'}`,
        `ts=${new Date().toISOString()}`,
        `copied=${copiedPaths.length}`,
        `errors=${errors.length}`,
        ...errors.map(item => `error=${item}`),
      ].join('\n') + '\n',
      'utf8',
    );
    copiedPaths.push(receiptPath);
  } catch (error) {
    errors.push(
      `staging-receipt: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return { destDir, copiedPaths, errors };
}

/**
 * Stage hang-path / supervisor-abort diagnostics into
 * `tooling/appium/.hang-recover-snapshots/last` (sibling of DerivedData; CI
 * `wda_xcodebuild_logs` glob). Call **before** drain/SIGKILL so `/tmp/rngma-e2e`
 * child logs still exist. Must not live under `.wda-derived` — session rebuilds
 * reclaim DerivedData and previously wiped in-job staged trees before upload.
 */
export function stageIosSessionHangArtifacts(options: {
  derivedDataPath: string;
  appiumHome?: string;
  extraLogPaths?: readonly string[];
  phase: string;
  write?: (line: string) => void;
  udid?: string;
  now?: () => Date;
  snapshotFn?: typeof snapshotWdaDerivedDataForHangRecover;
}): HangPathArtifactSnapshotResult {
  const write = options.write ?? ((line: string) => console.log(line));
  const now = options.now ?? (() => new Date());
  const destDir = hangRecoverArtifactSnapshotDir(options.derivedDataPath);
  const snapshot = (options.snapshotFn ?? snapshotWdaDerivedDataForHangRecover)(
    options.derivedDataPath,
    destDir,
    {
      appiumHome: options.appiumHome ?? DEFAULT_APPIUM_HOME,
      extraLogPaths: options.extraLogPaths,
      stagingPhase: options.phase,
    },
  );
  write(
    formatIosSessionDiagnosticLine(
      {
        phase: options.phase,
        udid: options.udid ?? '(n/a)',
        dest: snapshot.destDir,
        copied: snapshot.copiedPaths.length,
        errors: snapshot.errors.length,
        paths:
          snapshot.copiedPaths.join(',') || snapshot.errors[0] || '(none)',
      },
      now,
    ),
  );
  return snapshot;
}

/**
 * Emit one `[e2e-ios-session]` line for hang-probe / recover / abort phases.
 */
export function emitIosSessionCreateDiagnostics(
  udid: string,
  options: CollectIosSessionCreateDiagnosticsOptions,
  write: (line: string) => void = line => console.log(line),
): IosSessionCreateDiagnosticSnapshot {
  const snapshot = collectIosSessionCreateDiagnosticSnapshot(udid, options);
  const now = options.now ?? (() => new Date());
  write(
    formatIosSessionDiagnosticLine(
      {
        phase: options.phase,
        udid: snapshot.udid,
        listState: snapshot.listState,
        bootstatusTimedOut: snapshot.bootstatusTimedOut,
        bootstatusProbeTimeoutMs: snapshot.bootstatusProbeTimeoutMs,
        wdaRunnerAppPresent: snapshot.wdaRunnerAppPresent,
        wdaRunnerAppPath: snapshot.wdaRunnerAppPath,
        derivedDataPath: snapshot.derivedDataPath,
        derivedDataExists: snapshot.derivedDataExists,
        hostXcodebuildPids: snapshot.hostXcodebuildPids,
        hostWdaPids: snapshot.hostWdaPids,
        hostPgrepTimedOut: snapshot.hostPgrepTimedOut,
        hostXcodebuildBuilding: snapshot.hostXcodebuildBuilding,
        lastXcodebuildExit: snapshot.lastXcodebuildExit,
        wdaLogPathCount: snapshot.wdaLogPathCount,
        wdaLogPaths: snapshot.wdaLogPaths,
        reason: options.reason,
      },
      now,
    ),
  );
  return snapshot;
}

type WritableStreamLike = {
  write: (...args: unknown[]) => unknown;
};

/**
 * Tap stdout/stderr on the WDIO **launcher** (where @wdio/appium-service prints
 * Appium `[Xcode]` lines) and persist the last exit code to `statePath` so the
 * worker hang watchdog can read it across the process boundary.
 */
export function installXcodebuildExitLogTap(
  lastXcodebuildExitRef: { value: number | null },
  options?: {
    noteLine?: (line: string, ref: { value: number | null }) => number | null;
    stdout?: WritableStreamLike;
    stderr?: WritableStreamLike;
    /** Launcher→worker sidecar (typically `xcodebuildExitStatePath(appiumPort)`). */
    statePath?: string;
    writeState?: (path: string, code: number) => void;
  },
): () => void {
  const note =
    options?.noteLine ??
    ((line: string, ref: { value: number | null }) => {
      const code = parseXcodebuildExitCodeFromLine(line);
      if (code != null) {
        ref.value = code;
      }
      return code;
    });
  const writeState = options?.writeState ?? writeXcodebuildExitState;
  const streams = [
    options?.stdout ?? process.stdout,
    options?.stderr ?? process.stderr,
  ];
  const originals = streams.map(stream => stream.write.bind(stream));

  const tap =
    (original: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) => {
      const chunk = args[0];
      const text =
        typeof chunk === 'string'
          ? chunk
          : Buffer.isBuffer(chunk)
            ? chunk.toString('utf8')
            : '';
      if (text) {
        for (const line of text.split(/\r?\n/)) {
          if (line) {
            const code = note(line, lastXcodebuildExitRef);
            if (code != null && options?.statePath) {
              writeState(options.statePath, code);
            }
          }
        }
      }
      return original(...args);
    };

  for (let i = 0; i < streams.length; i += 1) {
    streams[i]!.write = tap(originals[i]!) as typeof streams[number]['write'];
  }

  return () => {
    for (let i = 0; i < streams.length; i += 1) {
      streams[i]!.write = originals[i]! as typeof streams[number]['write'];
    }
  };
}
