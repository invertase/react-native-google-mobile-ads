import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, test } from 'node:test';
import { recoverAndroidSlot } from '../src/reliabilityDeviceRecover.ts';

describe('recoverAndroidSlot', () => {
  test('boots TestingAVD-N on the slot console port and waits for boot', async () => {
    const spawned: string[][] = [];
    let waited: { serial: string; avd: string } | undefined;
    await recoverAndroidSlot({
      slot: 2,
      spawnImpl: ((bin, args) => {
        spawned.push([bin, ...(args as string[])]);
        const child = new EventEmitter() as EventEmitter & {
          unref: () => void;
        };
        child.unref = () => undefined;
        queueMicrotask(() => child.emit('close', 0));
        return child as never;
      }) as typeof import('node:child_process').spawn,
      async waitForBoot(serial, avd) {
        waited = { serial, avd };
      },
    });
    assert.equal(waited?.serial, 'emulator-5560');
    assert.equal(waited?.avd, 'TestingAVD-2');
    assert.equal(
      spawned.some(
        args =>
          args[0] === 'emulator' &&
          args.includes('TestingAVD-2') &&
          args.includes('5560'),
      ),
      true,
    );
  });
});
