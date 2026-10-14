import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  deviceHubOpenUrl,
  listBootedSlotIosUdids,
  parseDeviceHubMode,
  reconcileIosDeviceHub,
} from '../src/iosDeviceHub.ts';

describe('iosDeviceHub', () => {
  test('parseDeviceHubMode defaults to suppress when DeviceHub.app exists', () => {
    assert.equal(parseDeviceHubMode(undefined, '/tmp/DeviceHub.app'), 'suppress');
    assert.equal(parseDeviceHubMode(undefined, null), 'off');
    assert.equal(parseDeviceHubMode('reconcile', '/tmp/DeviceHub.app'), 'reconcile');
    assert.equal(parseDeviceHubMode('suppress', '/tmp/DeviceHub.app'), 'suppress');
    assert.equal(parseDeviceHubMode('off', '/tmp/DeviceHub.app'), 'off');
    assert.throws(() => parseDeviceHubMode('maybe'), /reconcile, suppress, or off/);
  });

  test('listBootedSlotIosUdids keeps only booted RN E2E iOS slot sims', () => {
    const json = JSON.stringify({
      devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-27-0': [
          {
            name: 'RN E2E iOS slot-1',
            udid: 'udid-1',
            state: 'Booted',
          },
          {
            name: 'RN E2E iOS slot-2',
            udid: 'udid-2',
            state: 'Shutdown',
          },
          {
            name: 'iPhone 17',
            udid: 'other',
            state: 'Booted',
          },
          {
            name: 'RN E2E iOS slot-5',
            udid: 'udid-5',
            state: 'Booted',
          },
        ],
      },
    });
    assert.deepEqual(listBootedSlotIosUdids(json), ['udid-1', 'udid-5']);
  });

  test('reconcile opens one new DeviceHub instance per desired UDID', () => {
    const opened: string[] = [];
    let killed = 0;
    let prunedTo: number | undefined;
    let live = 0;
    const result = reconcileIosDeviceHub(['b-udid', 'a-udid'], {
      appPath: '/Applications/Xcode.app/Contents/Applications/DeviceHub.app',
      mode: 'reconcile',
      kill: () => {
        killed = 2;
        return 2;
      },
      openInstance: (_app, udid) => {
        opened.push(udid);
        live += 1;
      },
      pruneTo: keep => {
        prunedTo = keep;
        return 0;
      },
      listPids: () => Array.from({ length: live }, (_, i) => i + 1),
      sleepMs: () => undefined,
      acquireLock: () => true,
      releaseLock: () => undefined,
    });
    assert.equal(result.mode, 'reconcile');
    assert.equal(killed, 2);
    assert.deepEqual(result.desired, ['a-udid', 'b-udid']);
    assert.deepEqual(opened, ['a-udid', 'b-udid']);
    assert.equal(result.opened, 2);
    assert.equal(prunedTo, 2);
    assert.equal(
      deviceHubOpenUrl('a-udid'),
      'devices://device/open?id=a-udid',
    );
  });

  test('suppress kills without opening', () => {
    const opened: string[] = [];
    const result = reconcileIosDeviceHub(['udid-1'], {
      appPath: '/Applications/Xcode.app/Contents/Applications/DeviceHub.app',
      mode: 'suppress',
      kill: () => 3,
      openInstance: (_app, udid) => {
        opened.push(udid);
      },
      acquireLock: () => true,
      releaseLock: () => undefined,
    });
    assert.equal(result.mode, 'suppress');
    assert.equal(result.killed, 3);
    assert.equal(result.opened, 0);
    assert.deepEqual(opened, []);
  });

  test('skips work when lock is held', () => {
    const result = reconcileIosDeviceHub(['udid-1'], {
      appPath: '/Applications/Xcode.app/Contents/Applications/DeviceHub.app',
      mode: 'reconcile',
      acquireLock: () => false,
      kill: () => {
        throw new Error('must not kill');
      },
    });
    assert.equal(result.opened, 0);
    assert.equal(result.killed, 0);
  });
});
