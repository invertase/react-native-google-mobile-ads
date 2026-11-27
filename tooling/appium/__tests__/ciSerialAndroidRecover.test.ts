import assert from 'node:assert/strict';
import type { ExecFileOptions } from 'node:child_process';
import { describe, test } from 'node:test';
import {
  CI_SERIAL_DEVICE_LOST_PATTERN,
  recoverCiSerialAndroidTransport,
  runWdioOwnedWithCiSerialDeviceLostRetry,
} from '../src/ciSerialAndroidRecover.ts';

type ExecFileImpl = (
  file: string,
  args: string[],
  options: ExecFileOptions,
  callback: (
    error: Error | null,
    stdout: string | Buffer,
    stderr: string | Buffer,
  ) => void,
) => void;

describe('recoverCiSerialAndroidTransport', () => {
  test('runs adb kill-server, start-server, wait-for-device, then verifies boot props', async () => {
    const calls: string[][] = [];
    let bootReads = 0;
    const execFileImpl: ExecFileImpl = (_file, args, _options, callback) => {
      calls.push([...args]);
      if (args[0] === 'kill-server' || args[0] === 'start-server') {
        queueMicrotask(() => callback(null, '', ''));
        return;
      }
      if (args.includes('wait-for-device')) {
        queueMicrotask(() => callback(null, '', ''));
        return;
      }
      if (args.includes('sys.boot_completed')) {
        bootReads += 1;
        queueMicrotask(() =>
          callback(null, bootReads >= 2 ? '1\n' : '0\n', ''),
        );
        return;
      }
      if (args.includes('ro.boot.qemu.avd_name')) {
        queueMicrotask(() => callback(null, 'TestingAVD\n', ''));
        return;
      }
      queueMicrotask(() => callback(new Error(`unexpected adb ${args.join(' ')}`), '', ''));
    };

    const lines: string[] = [];
    await recoverCiSerialAndroidTransport('emulator-5554', {
      execFileImpl: execFileImpl as never,
      log: line => lines.push(line),
      bootTimeoutMs: 5_000,
    });

    assert.deepEqual(
      calls.slice(0, 3).map(args => args[0]),
      ['kill-server', 'start-server', '-s'],
    );
    assert.equal(calls[2].includes('wait-for-device'), true);
    assert.ok(
      calls.some(
        args =>
          args.includes('sys.boot_completed') && args.includes('emulator-5554'),
      ),
    );
    assert.ok(lines.some(line => /ready \(TestingAVD\)/.test(line)));
  });
});

describe('runWdioOwnedWithCiSerialDeviceLostRetry', () => {
  test('rethrows non-device-lost errors without recovery', async () => {
    let recoverCalls = 0;
    let runs = 0;
    await assert.rejects(
      () =>
        runWdioOwnedWithCiSerialDeviceLostRetry(
          async () => {
            runs += 1;
            throw new Error('Metro is down');
          },
          {
            recover: async () => {
              recoverCalls += 1;
            },
          },
        ),
      /Metro is down/,
    );
    assert.equal(runs, 1);
    assert.equal(recoverCalls, 0);
  });

  test('recovers once and retries runWdioOwned on device-lost', async () => {
    let recoverCalls = 0;
    let runs = 0;
    const exit = await runWdioOwnedWithCiSerialDeviceLostRetry(
      async () => {
        runs += 1;
        if (runs === 1) {
          throw new Error(
            'Determinative startup failure (device-lost) from serial-android: adb: device offline',
          );
        }
        return 0;
      },
      {
        recover: async () => {
          recoverCalls += 1;
        },
      },
    );
    assert.equal(exit, 0);
    assert.equal(runs, 2);
    assert.equal(recoverCalls, 1);
  });

  test('device-lost pattern matches supervisor abort message shape', () => {
    assert.equal(
      CI_SERIAL_DEVICE_LOST_PATTERN.test(
        'Determinative startup failure (device-lost) from serial-android: adb: device offline',
      ),
      true,
    );
    assert.equal(
      CI_SERIAL_DEVICE_LOST_PATTERN.test(
        'Determinative startup failure (session-create) from serial-android: hung',
      ),
      false,
    );
  });
});