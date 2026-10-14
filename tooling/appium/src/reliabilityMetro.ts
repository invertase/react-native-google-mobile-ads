/**
 * Per-slot, per-platform Metro ownership for reliability workers.
 * Android and iOS listeners on the same slot number are distinct (ports + cache roots).
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import { packagerCommand } from './commands.ts';
import {
  platformMetroPort,
  slotMetroPackagerEnv,
  slotMetroRoots,
  type OperationalPlatform,
  type SlotMetroRoots,
} from './slots.ts';
import {
  probeMetroPackagerHttp,
  probeMetroPlatformBundle,
} from './startupSupervisor.ts';

export type SlotPlatformMetroOwnership = {
  slot: number;
  platform: OperationalPlatform;
  metroPort: number;
  roots: SlotMetroRoots;
  /** Owner identity string for logs and lease snapshots. */
  ownerId: string;
};

export function metroOwnershipForSlotPlatform(
  slot: number,
  platform: OperationalPlatform,
): SlotPlatformMetroOwnership {
  const roots = slotMetroRoots(slot, platform);
  return {
    slot,
    platform,
    metroPort: platformMetroPort(slot, platform),
    roots,
    ownerId: `metro:${platform}:slot-${slot}:${platformMetroPort(slot, platform)}`,
  };
}

/**
 * Env for a reliability shard child: slot/platform Metro owner, dedicated port,
 * and isolated cache/temp roots (never collapse Android and iOS on one listener).
 */
export function reliabilityMetroEnv(
  slot: number,
  platform: OperationalPlatform,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const metro = metroOwnershipForSlotPlatform(slot, platform);
  const packagerEnv = slotMetroPackagerEnv(slot, platform, baseEnv);
  return {
    ...packagerEnv,
    RNGMA_E2E_SLOT: String(slot),
    RNGMA_E2E_PLATFORM: platform,
    RNGMA_E2E_METRO_SLOT: String(slot),
    RNGMA_METRO_PORT: String(metro.metroPort),
  };
}

/** Assert two same-slot platforms never share port or cache root. */
export function assertDistinctPlatformMetro(slot: number): {
  android: SlotPlatformMetroOwnership;
  ios: SlotPlatformMetroOwnership;
} {
  const android = metroOwnershipForSlotPlatform(slot, 'android');
  const ios = metroOwnershipForSlotPlatform(slot, 'ios');
  if (android.metroPort === ios.metroPort) {
    throw new Error(
      `Android and iOS Metro ports must differ for slot ${slot}; both resolved ${android.metroPort}.`,
    );
  }
  if (android.roots.cache === ios.roots.cache || android.roots.root === ios.roots.root) {
    throw new Error(
      `Android and iOS Metro cache roots must differ for slot ${slot}.`,
    );
  }
  return { android, ios };
}

export type ReliabilityMetroHandle = {
  metroPort: number;
  /** True when this handle spawned the packager and must stop it. */
  owned: boolean;
  stop: () => Promise<void>;
};

const METRO_READY_POLL_MS = 250;
const METRO_READY_TIMEOUT_MS = 120_000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Positive confirmation that the slot/platform Metro is serving bundles.
 * `/status` alone is not enough once a consumer is about to launch the app.
 */
export async function waitForReliabilityMetroReady(
  port: number,
  platform: OperationalPlatform,
  options: {
    timeoutMs?: number;
    probePackager?: (port: number) => Promise<boolean>;
    probeBundle?: (
      port: number,
      platform: OperationalPlatform,
      signal?: AbortSignal,
    ) => Promise<boolean>;
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? METRO_READY_TIMEOUT_MS;
  const probePackager = options.probePackager ?? probeMetroPackagerHttp;
  const probeBundle = options.probeBundle ?? probeMetroPlatformBundle;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probePackager(port)) {
      const controller = new AbortController();
      const remaining = Math.max(1_000, deadline - Date.now());
      const timer = setTimeout(() => controller.abort(), remaining);
      try {
        if (await probeBundle(port, platform, controller.signal)) {
          return;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    await delay(METRO_READY_POLL_MS);
  }
  throw new Error(
    `Metro on 127.0.0.1:${port} did not become packager-status:running with a ${platform} bundle within ${timeoutMs}ms.`,
  );
}

/**
 * Reuse an already-ready slot Metro, or start a task-owned packager and wait
 * for positive packager + platform-bundle readiness before Appium shards.
 */
export async function ensureReliabilityMetroReady(options: {
  slot: number;
  platform: OperationalPlatform;
  /** Repository root (packagerCommand runs yarn workspace from here). */
  repoRoot: string;
  logPath: string;
  env?: NodeJS.ProcessEnv;
  spawnImpl?: typeof spawn;
  waitReady?: typeof waitForReliabilityMetroReady;
  /** Injected for device-free tests; defaults to host `/status` probe. */
  probePackager?: (port: number) => Promise<boolean>;
}): Promise<ReliabilityMetroHandle> {
  const metro = metroOwnershipForSlotPlatform(options.slot, options.platform);
  const env = reliabilityMetroEnv(options.slot, options.platform, options.env);
  const waitReady = options.waitReady ?? waitForReliabilityMetroReady;
  const probePackager = options.probePackager ?? probeMetroPackagerHttp;

  if (await probePackager(metro.metroPort)) {
    await waitReady(metro.metroPort, options.platform);
    return {
      metroPort: metro.metroPort,
      owned: false,
      async stop() {
        return undefined;
      },
    };
  }

  mkdirSync(path.dirname(options.logPath), { recursive: true });
  const log = createWriteStream(options.logPath, { flags: 'a' });
  const command = packagerCommand(false, env);
  const spawnImpl = options.spawnImpl ?? spawn;
  // Detached process group so stop() can signal yarn + Metro children together.
  const child: ChildProcess = spawnImpl(command.bin, command.args, {
    cwd: command.cwd ?? options.repoRoot,
    env: { ...process.env, ...env, ...(command.env ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout?.on('data', chunk => log.write(chunk));
  child.stderr?.on('data', chunk => log.write(chunk));
  child.on('close', () => {
    if (!log.writableEnded) {
      log.end();
    }
  });

  const signalTree = (signal: NodeJS.Signals): void => {
    if (child.pid == null) {
      return;
    }
    try {
      process.kill(-child.pid, signal);
    } catch {
      try {
        child.kill(signal);
      } catch {
        // Already exited.
      }
    }
  };

  const stop = async (): Promise<void> => {
    if (child.exitCode != null) {
      if (!log.writableEnded) {
        log.end();
      }
      return;
    }
    signalTree('SIGTERM');
    await Promise.race([
      new Promise<void>(resolve => child.once('close', () => resolve())),
      delay(5_000),
    ]);
    if (child.exitCode == null) {
      signalTree('SIGKILL');
      await Promise.race([
        new Promise<void>(resolve => child.once('close', () => resolve())),
        delay(2_000),
      ]);
    }
    if (!log.writableEnded) {
      log.end();
    }
  };

  try {
    await waitReady(metro.metroPort, options.platform);
  } catch (error) {
    await stop();
    throw error;
  }

  return {
    metroPort: metro.metroPort,
    owned: true,
    stop,
  };
}
