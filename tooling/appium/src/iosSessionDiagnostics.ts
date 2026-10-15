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

import { spawnSync } from 'node:child_process';
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
};

/**
 * List host PIDs whose command line matches WDA / xcodebuild markers (pgrep -fl).
 * Injectable exec keeps unit tests off the live process table. Hard-capped so
 * hang-path diagnostics cannot stack multi-second simctl waits.
 */
export function listWdaRelatedHostProcesses(
  execCapture: SessionExecCapture = defaultSessionExecCapture,
  markers: readonly string[] = IOS_WDA_HOST_PROCESS_MARKERS,
  timeoutMs: number = IOS_SESSION_HOST_PGREP_TIMEOUT_MS,
): HostProcessPidSnapshot[] {
  return markers.map(marker => {
    const result = execCapture('pgrep', ['-fl', marker], { timeoutMs });
    const pids: number[] = [];
    if (result.timedOut) {
      return { marker, pids, timedOut: true };
    }
    if (result.status === 0 || result.stdout.trim() !== '') {
      for (const line of result.stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === '') {
          continue;
        }
        const pid = Number(trimmed.split(/\s+/)[0]);
        if (Number.isInteger(pid) && pid > 0) {
          pids.push(pid);
        }
      }
    }
    return { marker, pids };
  });
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
  const xcodebuild = hostProcs.find(item => item.marker === 'xcodebuild');
  const wdaHost = hostProcs.filter(item => item.marker !== 'xcodebuild');
  const hostPgrepTimedOut = hostProcs.some(item => item.timedOut === true);
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
    hostXcodebuildPids:
      xcodebuild?.timedOut === true
        ? 'timedOut'
        : xcodebuild?.pids.join(',') || '(none)',
    hostWdaPids: (() => {
      if (wdaHost.some(item => item.timedOut === true)) {
        return 'timedOut';
      }
      return (
        wdaHost
          .flatMap(item => item.pids)
          .filter((pid, index, all) => all.indexOf(pid) === index)
          .join(',') || '(none)'
      );
    })(),
    hostPgrepTimedOut,
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
 * Gate hang-recover: do not `simctl terminate` WDA while host xcodebuild and/or
 * WDA PIDs are still alive (or pgrep timed out) and lastXcodebuildExit is
 * none/unknown. Wait for the build to finish or exit before kill.
 */
export function shouldDeferHangRecoverForLiveHostBuild(input: {
  hostXcodebuildPids: string;
  hostWdaPids: string;
  lastXcodebuildExit: string;
}): { defer: boolean; reason?: string } {
  const live =
    hostPidsIndicateLiveBuild(input.hostXcodebuildPids) ||
    hostPidsIndicateLiveBuild(input.hostWdaPids);
  const exitUnknown =
    input.lastXcodebuildExit === '(none)' ||
    input.lastXcodebuildExit === '(unknown)';
  if (!live || !exitUnknown) {
    return { defer: false };
  }
  return {
    defer: true,
    reason:
      `recoverSkipped: host build still live ` +
      `(hostXcodebuildPids=${input.hostXcodebuildPids}, hostWdaPids=${input.hostWdaPids}) ` +
      `and lastXcodebuildExit=${input.lastXcodebuildExit} — defer WDA terminate until ` +
      `xcodebuild exits or host PIDs clear`,
  };
}

/** Default staging dir under DerivedData for pre-kill log copies. */
export function hangRecoverArtifactSnapshotDir(derivedDataPath: string): string {
  return join(derivedDataPath, 'hang-recover-snapshots', 'last');
}

/**
 * Copy `.xcresult` bundles + DerivedData log files into `destDir` before a
 * hang-recover kill so upload-artifact still has evidence if terminate races
 * the writer. Best-effort; never throws.
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
  },
): { copiedPaths: string[]; errors: string[] } {
  const exists = options?.existsSyncFn ?? existsSync;
  const mkdir = options?.mkdirSyncFn ?? mkdirSync;
  const copyFile = options?.copyFileSyncFn ?? copyFileSync;
  const cp = options?.cpSyncFn ?? cpSync;
  const stat = options?.statSyncFn ?? statSync;
  const copiedPaths: string[] = [];
  const errors: string[] = [];
  if (!exists(derivedDataPath)) {
    return { copiedPaths, errors: [`derivedData missing: ${derivedDataPath}`] };
  }
  try {
    mkdir(destDir, { recursive: true });
  } catch (error) {
    return {
      copiedPaths,
      errors: [
        `mkdir ${destDir}: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
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
  return { copiedPaths, errors };
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
