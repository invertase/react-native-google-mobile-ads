/**
 * CI serial Android adb transport recovery when the emulator runner still owns
 * QEMU. Resets adb and waits for the known serial — no emulator reboot.
 */

import { execFile, type ExecFileOptions } from 'node:child_process';
import {
  SERIAL_ANDROID_AVD,
  SERIAL_ANDROID_SERIAL,
} from './resourcePrimitives.ts';

export const CI_SERIAL_DEVICE_LOST_PATTERN =
  /Determinative startup failure \(device-lost\)/;

export type RecoverCiSerialAndroidTransportOptions = {
  avdName?: string;
  bootTimeoutMs?: number;
  /** Injected for tests. */
  execFileImpl?: typeof execFile;
  log?: (line: string) => void;
};

function execAdb(
  impl: typeof execFile,
  args: string[],
  options?: ExecFileOptions,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    impl(
      'adb',
      args,
      { encoding: 'utf8', ...options },
      (err, stdout, stderr) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

function trimProp(value: string): string {
  return value.trim().replace(/\r/g, '');
}

/**
 * adb kill-server → start-server → wait-for-device, then verify boot + AVD name.
 */
export async function recoverCiSerialAndroidTransport(
  serial = SERIAL_ANDROID_SERIAL,
  options: RecoverCiSerialAndroidTransportOptions = {},
): Promise<void> {
  const avdName = options.avdName ?? SERIAL_ANDROID_AVD;
  const execFileImpl = options.execFileImpl ?? execFile;
  const log = options.log ?? ((line: string) => console.warn(line));
  const bootTimeoutMs = options.bootTimeoutMs ?? 60_000;

  log(
    `[e2e-ci] adb transport recovery: kill-server → start-server → wait-for-device (${serial})`,
  );

  await execAdb(execFileImpl, ['kill-server']);
  await execAdb(execFileImpl, ['start-server']);
  await execAdb(execFileImpl, ['-s', serial, 'wait-for-device']);

  const deadline = Date.now() + bootTimeoutMs;
  while (Date.now() < deadline) {
    const boot = await execAdb(execFileImpl, [
      '-s',
      serial,
      'shell',
      'getprop',
      'sys.boot_completed',
    ]);
    const avd = await execAdb(execFileImpl, [
      '-s',
      serial,
      'shell',
      'getprop',
      'ro.boot.qemu.avd_name',
    ]);
    if (trimProp(boot.stdout) === '1' && trimProp(avd.stdout) === avdName) {
      log(`[e2e-ci] adb transport recovery: ${serial} ready (${avdName})`);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(
    `CI serial adb transport recovery: ${serial} did not report boot_completed=1 and ${avdName} within timeout`,
  );
}

export type RunWdioOwnedWithCiSerialDeviceLostRetryOptions = {
  recover?: (serial?: string) => Promise<void>;
  serial?: string;
};

/**
 * One-shot owner retry after CI serial `device-lost` (adb transport only).
 */
export async function runWdioOwnedWithCiSerialDeviceLostRetry(
  run: () => Promise<number>,
  options: RunWdioOwnedWithCiSerialDeviceLostRetryOptions = {},
): Promise<number> {
  const recover = options.recover ?? (() => recoverCiSerialAndroidTransport(options.serial));
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!CI_SERIAL_DEVICE_LOST_PATTERN.test(message)) {
      throw error;
    }
    console.log(
      '[e2e-ci] device-lost; attempting adb transport recovery (1/1)',
    );
    await recover();
    return await run();
  }
}