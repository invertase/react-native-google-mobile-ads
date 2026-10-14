/**
 * Xcode 27 replaced Simulator.app with DeviceHub.app. CoreSimulator auto-launches
 * a fresh DeviceHub process on many boot/install events in a GUI session, so
 * multi-slot iOS work accumulates orphan windows (often many more than booted
 * sims). Controlled opens via `devices://device/open?id=<UDID>` reuse one
 * process; `open -n` forces one new instance per UDID — the closest restore of
 * Xcode 26's "one Simulator window per device" behavior.
 *
 * Modes (`RNGMA_IOS_DEVICE_HUB`):
 * - `suppress` (default when DeviceHub.app exists): kill DeviceHub /
 *   DevicesTrampoline. Appium does not need the UI; CoreSimulator otherwise
 *   floods the desktop with orphan windows under multi-slot load.
 * - `reconcile`: exactly one DeviceHub instance per booted
 *   `RN E2E iOS slot-*` (or an explicit UDID list) — opt-in for visual debug
 * - `off`: no-op
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MAX_SLOT, MIN_SLOT } from './slots.ts';

export type DeviceHubMode = 'reconcile' | 'suppress' | 'off';

const LOCK_DIR = '/tmp/rngma-e2e-devicehub.lock';
const LOCK_STALE_MS = 30_000;

export function deviceHubAppPath(
  developerDir: string = process.env.DEVELOPER_DIR ??
    '/Applications/Xcode.app/Contents/Developer',
): string | undefined {
  const app = path.resolve(developerDir, '..', 'Applications', 'DeviceHub.app');
  return existsSync(app) ? app : undefined;
}

export function parseDeviceHubMode(
  value: string | undefined,
  /**
   * Pass `null` to force "no DeviceHub.app". Omit to probe the active Xcode.
   */
  appPath?: string | null,
): DeviceHubMode {
  const raw = (value ?? '').trim().toLowerCase();
  if (raw === 'off' || raw === 'suppress' || raw === 'reconcile') {
    return raw;
  }
  if (raw !== '') {
    throw new Error(
      `RNGMA_IOS_DEVICE_HUB must be reconcile, suppress, or off; received "${value}".`,
    );
  }
  const resolved = appPath === undefined ? deviceHubAppPath() : appPath;
  // No DeviceHub.app (Xcode ≤26 / Linux CI): nothing to manage.
  // Prefer suppress: reconcile's open -n + CoreSimulator auto-launch races
  // into dozens of windows during parallel burn-in.
  return resolved != null ? 'suppress' : 'off';
}

export function deviceHubOpenUrl(udid: string): string {
  return `devices://device/open?id=${udid}`;
}

function listPidsByName(name: string): number[] {
  const result = spawnSync('pgrep', ['-x', name], { encoding: 'utf8' });
  if (result.status !== 0 || result.stdout.trim() === '') {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => Number.isInteger(n) && n > 0);
}

/** UI host processes (each typically owns one compact device window). */
export function listDeviceHubPids(): number[] {
  return listPidsByName('DeviceHub');
}

/** Trampoline + UI hosts — both must die for a clean reconcile. */
export function listDeviceHubRelatedPids(): number[] {
  return [
    ...listPidsByName('DeviceHub'),
    ...listPidsByName('DevicesTrampoline'),
  ];
}

export function killDeviceHubProcesses(
  killImpl: (pid: number, signal?: NodeJS.Signals) => void = process.kill,
): number {
  const pids = listDeviceHubRelatedPids();
  // DeviceHub ignores SIGTERM in practice under Xcode 27; go straight to KILL.
  for (const pid of pids) {
    try {
      killImpl(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
  return pids.length;
}

/**
 * If CoreSimulator / `open -n` left extras, keep the oldest N DeviceHub PIDs
 * (one per desired UDID) and kill the rest.
 */
export function pruneDeviceHubToCount(
  keep: number,
  killImpl: (pid: number, signal?: NodeJS.Signals) => void = process.kill,
): number {
  if (keep < 0) {
    return 0;
  }
  const pids = listDeviceHubPids().sort((a, b) => a - b);
  const extras = pids.slice(keep);
  for (const pid of extras) {
    try {
      killImpl(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
  return extras.length;
}

/**
 * Booted simulators whose names match RNGMA slot sims (`RN E2E iOS slot-N`).
 */
export function listBootedSlotIosUdids(
  simctlJson: string,
): string[] {
  const inventory = JSON.parse(simctlJson) as {
    devices?: Record<string, Array<{ name?: string; udid?: string; state?: string }>>;
  };
  const slotName = new RegExp(
    `^RN E2E iOS slot-([${MIN_SLOT}-${MAX_SLOT}])$`,
  );
  const udids: string[] = [];
  for (const devices of Object.values(inventory.devices ?? {})) {
    for (const device of devices) {
      if (
        device.state === 'Booted' &&
        device.udid &&
        device.name &&
        slotName.test(device.name)
      ) {
        udids.push(device.udid);
      }
    }
  }
  return [...new Set(udids)].sort();
}

export type ReconcileDeviceHubDeps = {
  appPath?: string;
  mode?: DeviceHubMode;
  listBootedUdids?: () => string[];
  kill?: () => number;
  openInstance?: (appPath: string, udid: string) => void;
  pruneTo?: (keep: number) => number;
  listPids?: () => number[];
  sleepMs?: (ms: number) => void;
  nowMs?: () => number;
  acquireLock?: () => boolean;
  releaseLock?: () => void;
};

function defaultOpenInstance(appPath: string, udid: string): void {
  // `-n` = new instance so each UDID gets its own window (Simulator.app parity).
  execFileSync('open', ['-n', '-a', appPath, deviceHubOpenUrl(udid)], {
    stdio: 'ignore',
  });
}

function defaultListBootedUdids(): string[] {
  const json = execFileSync('xcrun', ['simctl', 'list', 'devices', '--json'], {
    encoding: 'utf8',
  });
  return listBootedSlotIosUdids(json);
}

function tryAcquireLock(nowMs: () => number): boolean {
  try {
    mkdirSync(LOCK_DIR);
    writeFileSync(path.join(LOCK_DIR, 'pid'), String(process.pid));
    return true;
  } catch {
    try {
      const stat = spawnSync('stat', ['-f', '%m', LOCK_DIR], { encoding: 'utf8' });
      const mtimeSec = Number(stat.stdout.trim());
      if (
        Number.isFinite(mtimeSec) &&
        nowMs() - mtimeSec * 1000 > LOCK_STALE_MS
      ) {
        rmSync(LOCK_DIR, { recursive: true, force: true });
        mkdirSync(LOCK_DIR);
        writeFileSync(path.join(LOCK_DIR, 'pid'), String(process.pid));
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }
}

function releaseLock(): void {
  try {
    rmSync(LOCK_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * Bring DeviceHub to exactly one new instance per desired (or all booted slot)
 * UDID. Safe to call from multiple workers — uses a short directory lock.
 */
export function reconcileIosDeviceHub(
  explicitUdids?: readonly string[],
  deps: ReconcileDeviceHubDeps = {},
): { mode: DeviceHubMode; desired: string[]; killed: number; opened: number } {
  const appPath = deps.appPath ?? deviceHubAppPath();
  const mode =
    deps.mode ?? parseDeviceHubMode(process.env.RNGMA_IOS_DEVICE_HUB, appPath);
  if (mode === 'off' || appPath == null) {
    return { mode: appPath == null ? 'off' : mode, desired: [], killed: 0, opened: 0 };
  }

  const acquire = deps.acquireLock ?? (() => tryAcquireLock(deps.nowMs ?? Date.now));
  const release = deps.releaseLock ?? releaseLock;
  if (!acquire()) {
    return { mode, desired: [], killed: 0, opened: 0 };
  }

  try {
    const desired = [
      ...new Set(
        (explicitUdids != null && explicitUdids.length > 0
          ? [...explicitUdids]
          : (deps.listBootedUdids ?? defaultListBootedUdids)()
        ).map(u => u.trim()).filter(Boolean),
      ),
    ].sort();

    const killed = (deps.kill ?? (() => killDeviceHubProcesses()))();
    if (mode === 'suppress') {
      return { mode, desired, killed, opened: 0 };
    }

    const openInstance = deps.openInstance ?? defaultOpenInstance;
    const sleepMs =
      deps.sleepMs ??
      ((ms: number) => {
        // Sync pause between `open -n` launches (DeviceHub collapses races).
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
      });

    const listPids = deps.listPids ?? listDeviceHubPids;
    const prune = deps.pruneTo ?? pruneDeviceHubToCount;
    let opened = 0;
    for (const udid of desired) {
      const before = listPids().length;
      openInstance(appPath, udid);
      opened += 1;
      // Wait until a new DeviceHub host appears (first launch is slow).
      const appearDeadline = (deps.nowMs ?? Date.now)() + 12_000;
      while (
        listPids().length <= before &&
        (deps.nowMs ?? Date.now)() < appearDeadline
      ) {
        sleepMs(250);
      }
      sleepMs(500);
    }
    // Trim any extras CoreSimulator attached during the opens.
    const pruneDeadline = (deps.nowMs ?? Date.now)() + 5_000;
    do {
      sleepMs(500);
      prune(desired.length);
    } while (
      listPids().length > desired.length &&
      (deps.nowMs ?? Date.now)() < pruneDeadline
    );
    return { mode, desired, killed, opened };
  } finally {
    release();
  }
}
