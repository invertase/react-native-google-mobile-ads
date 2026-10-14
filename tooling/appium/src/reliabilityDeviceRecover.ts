/**
 * Host-infra recovery for reliability workers when an Android emulator process
 * dies. Under multi-AVD load the emulator HangDetector trips (~15s missed
 * QEMU2 main/CPU heartbeats), calls GenerateDumpAndDie, and macOS records
 * SIGSEGV at 0x0 — same event as the "hanging thread" boot-log lines, not a
 * separate product crash and not swap thrash. Not a product flake path.
 */

import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  ANDROID_SLOT_EMULATOR_RUNTIME_ARGS,
  slotResources,
} from './slots.ts';

export const DEFAULT_DEVICE_LOST_RECOVERIES = 5;

export type RecoverAndroidSlotOptions = {
  slot: number;
  logPath?: string;
  /** Injected for tests. */
  spawnImpl?: typeof spawn;
  /** Injected for tests. */
  waitForBoot?: (serial: string, avdName: string) => Promise<void>;
  bootTimeoutMs?: number;
};

function logLine(logPath: string | undefined, message: string): void {
  const line = `[reliability-device-recover] ${message}\n`;
  if (logPath != null) {
    mkdirSync(path.dirname(logPath), { recursive: true });
    appendFileSync(logPath, line);
  }
  console.warn(line.trimEnd());
}

/**
 * Kill any stale listener on the slot console port and boot TestingAVD-N.
 * Waits until `sys.boot_completed=1` and the AVD name matches.
 */
export async function recoverAndroidSlot(
  options: RecoverAndroidSlotOptions,
): Promise<void> {
  const resources = slotResources(options.slot, 'android');
  const serial = resources.androidSerial;
  const avd = resources.androidAvdName;
  const port = resources.androidConsolePort;
  const spawnImpl = options.spawnImpl ?? spawn;
  const logPath = options.logPath;

  logLine(
    logPath,
    `device-lost recovery: rebooting ${avd} on console ${port} (${serial})`,
  );

  // Best-effort: free the console port if a zombie emulator holds it.
  await new Promise<void>(resolve => {
    const killer = spawnImpl(
      'bash',
      [
        '-lc',
        `lsof -nP -iTCP:${port} -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2}' | sort -u | xargs kill -9 2>/dev/null || true`,
      ],
      { stdio: 'ignore' },
    );
    killer.on('close', () => resolve());
    killer.on('error', () => resolve());
  });

  const child = spawnImpl(
    'emulator',
    [
      '-avd',
      avd,
      '-port',
      String(port),
      ...ANDROID_SLOT_EMULATOR_RUNTIME_ARGS,
      '-no-snapshot-load',
      '-no-snapshot-save',
    ],
    {
      detached: true,
      stdio: 'ignore',
    },
  );
  child.unref();

  const waitForBoot =
    options.waitForBoot ??
    (async (expectedSerial, expectedAvd) => {
      const deadline = Date.now() + (options.bootTimeoutMs ?? 180_000);
      while (Date.now() < deadline) {
        const probe = spawnImpl(
          'bash',
          [
            '-lc',
            `adb -s ${expectedSerial} wait-for-device >/dev/null 2>&1; ` +
              `boot=$(adb -s ${expectedSerial} shell getprop sys.boot_completed 2>/dev/null | tr -d '\\r'); ` +
              `avd=$(adb -s ${expectedSerial} shell getprop ro.boot.qemu.avd_name 2>/dev/null | tr -d '\\r'); ` +
              `test "$boot" = "1" && test "$avd" = "${expectedAvd}"`,
          ],
          { stdio: 'ignore' },
        );
        const code = await new Promise<number>(resolve => {
          probe.on('close', c => resolve(c ?? 1));
          probe.on('error', () => resolve(1));
        });
        if (code === 0) {
          return;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      throw new Error(
        `device-lost recovery: ${expectedAvd} (${expectedSerial}) did not boot within timeout`,
      );
    });

  await waitForBoot(serial, avd);
  logLine(logPath, `device-lost recovery: ${avd} ready as ${serial}`);
}
