import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  FORCE_ACQUIRE_AUTHORIZE_FLAG,
  FORCE_ACQUIRE_ENV,
  forceAcquireResources,
  isForceAcquireAuthorized,
  parseForceAcquireOptions,
} from '../src/forceAcquire.ts';
import {
  ResourceArgumentError,
  type ResourceInventory,
} from '../src/resourcePrimitives.ts';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

function inventory(
  overrides: Partial<ResourceInventory> = {},
): ResourceInventory {
  return {
    listeners: new Map(),
    androidDevices: [],
    androidApps: new Set(),
    iosSimulators: [],
    iosApps: new Set(),
    ...overrides,
  };
}

describe('campaign force-acquire', () => {
  test('exposes force-acquire at root and workspace levels', () => {
    const root = JSON.parse(
      readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const workspace = JSON.parse(
      readFileSync(
        path.join(repositoryRoot, 'tooling/appium/package.json'),
        'utf8',
      ),
    ) as { scripts: Record<string, string> };
    assert.equal(
      root.scripts['tests:appium:force-acquire'],
      'yarn workspace @invertase/rngma-appium force-acquire',
    );
    assert.equal(
      workspace.scripts['force-acquire'],
      'tsx ./scripts/force-acquire.ts',
    );
  });

  test('authorization is opt-in via flag or env', () => {
    assert.equal(isForceAcquireAuthorized([]), false);
    assert.equal(isForceAcquireAuthorized([FORCE_ACQUIRE_AUTHORIZE_FLAG]), true);
    assert.equal(
      isForceAcquireAuthorized([], { [FORCE_ACQUIRE_ENV]: '1' }),
      true,
    );
    assert.equal(
      isForceAcquireAuthorized([], { [FORCE_ACQUIRE_ENV]: 'true' }),
      false,
    );
  });

  test('rejects missing authorization, serial, all-slots, and slot 0', () => {
    assert.throws(
      () => parseForceAcquireOptions(['--slot=3'], {}),
      /requires --authorize-force-acquire/,
    );
    assert.throws(
      () => parseForceAcquireOptions([FORCE_ACQUIRE_AUTHORIZE_FLAG], {}),
      /exact nonserial slot/,
    );
    assert.throws(
      () =>
        parseForceAcquireOptions(
          [FORCE_ACQUIRE_AUTHORIZE_FLAG, '--all-slots'],
          {},
        ),
      /rejects --all-slots/,
    );
    assert.throws(
      () =>
        parseForceAcquireOptions(
          [FORCE_ACQUIRE_AUTHORIZE_FLAG, '--slot=0'],
          {},
        ),
      ResourceArgumentError,
    );
  });

  test('accepts exact slot 3 with devices enabled', () => {
    const options = parseForceAcquireOptions(
      [FORCE_ACQUIRE_AUTHORIZE_FLAG, '--slot=3', '--platform=android'],
      {},
    );
    assert.equal(options.devices, true);
    assert.deepEqual(
      options.targets.map(target => target.slot),
      [3],
    );
    assert.equal(options.targets[0]?.androidAvdName, 'TestingAVD-3');
    assert.equal(options.targets[0]?.androidSerial, 'emulator-5562');
  });

  test('check → release → check logs displaced resources and never invents serial targets', async () => {
    const logs: string[] = [];
    const releases: Array<'SIGTERM' | 'SIGKILL'> = [];
    let inventories = 0;
    const busy = inventory({
      listeners: new Map([[15013, [303]]]),
      androidDevices: [{ serial: 'emulator-5562', avdName: 'TestingAVD-3' }],
    });
    const clear = inventory();
    const options = parseForceAcquireOptions(
      [FORCE_ACQUIRE_AUTHORIZE_FLAG, '--slot=3', '--platform=android'],
      {},
    );
    assert.ok(options.targets.every(target => target.slot != null));
    assert.ok(options.targets.every(target => target.slot !== 0));

    const result = await forceAcquireResources(options, {
      collectInventory() {
        inventories += 1;
        return inventories <= 2 ? busy : clear;
      },
      releaseResources(_options, _inventory, signal) {
        releases.push(signal);
      },
      async delay() {},
      log(line) {
        logs.push(line);
      },
    });

    assert.equal(result.displaced.length, 2);
    assert.match(logs.join('\n'), /DISPLACED.*15013/);
    assert.match(logs.join('\n'), /DISPLACED.*TestingAVD-3/);
    assert.deepEqual(releases, ['SIGTERM']);
    assert.match(logs.join('\n'), /CLEAR after force round 0/);
  });

  test('already-clear slots skip release', async () => {
    const releases: string[] = [];
    const options = parseForceAcquireOptions(
      [],
      { [FORCE_ACQUIRE_ENV]: '1', RNGMA_E2E_SLOT: '1', RNGMA_E2E_PLATFORM: 'ios' },
    );
    const result = await forceAcquireResources(options, {
      collectInventory: () => inventory(),
      releaseResources() {
        releases.push('released');
      },
      async delay() {},
      log() {},
    });
    assert.deepEqual(result.displaced, []);
    assert.deepEqual(releases, []);
  });

  test('escalates through SIGKILL rounds then clears', async () => {
    const releases: Array<'SIGTERM' | 'SIGKILL'> = [];
    const logs: string[] = [];
    let inventories = 0;
    const busy = inventory({
      listeners: new Map([[15013, [404]]]),
    });
    const clear = inventory();
    const options = parseForceAcquireOptions(
      [FORCE_ACQUIRE_AUTHORIZE_FLAG, '--slot=3', '--platform=android'],
      {},
    );

    const result = await forceAcquireResources(options, {
      collectInventory() {
        inventories += 1;
        // inv1 before, inv2 SIGTERM, inv3 round0, inv4 round1 stay busy; inv5 round2 clears
        return inventories <= 4 ? busy : clear;
      },
      releaseResources(_options, _inventory, signal) {
        releases.push(signal);
      },
      async delay() {},
      log(line) {
        logs.push(line);
      },
    });

    assert.equal(result.displaced.length, 1);
    assert.deepEqual(releases, ['SIGTERM', 'SIGKILL', 'SIGKILL']);
    assert.match(logs.join('\n'), /force round 1/);
    assert.match(logs.join('\n'), /force round 2/);
    assert.match(logs.join('\n'), /CLEAR after force round 2/);
  });

  test('throws when relevant resources remain busy after SIGKILL rounds', async () => {
    const logs: string[] = [];
    const options = parseForceAcquireOptions(
      [FORCE_ACQUIRE_AUTHORIZE_FLAG, '--slot=3', '--platform=android'],
      {},
    );
    await assert.rejects(
      () =>
        forceAcquireResources(options, {
          collectInventory: () =>
            inventory({ listeners: new Map([[15013, [505]]]) }),
          releaseResources() {},
          async delay() {},
          log(line) {
            logs.push(line);
          },
        }),
      /resources remain busy after force-acquire release rounds/,
    );
    assert.match(logs.join('\n'), /BUSY {2}port :15013/);
  });

  test('consumer Metro BUSY is not relevant and does not fail acquire', async () => {
    const releases: Array<'SIGTERM' | 'SIGKILL'> = [];
    const logs: string[] = [];
    // Owner Metro :13007 stays up; consumer slot 4 must not treat it as displace/fail.
    const withOwnerMetro = inventory({
      listeners: new Map([[13007, [606]]]),
    });
    const options = parseForceAcquireOptions(
      [
        FORCE_ACQUIRE_AUTHORIZE_FLAG,
        '--slot=4',
        '--platform=android',
        '--metro-owner-slot=1',
      ],
      {},
    );
    assert.equal(options.targets[0]?.metroOwned, false);
    assert.equal(options.targets[0]?.metroPort, 13007);

    const result = await forceAcquireResources(options, {
      collectInventory: () => withOwnerMetro,
      releaseResources(_options, _inventory, signal) {
        releases.push(signal);
      },
      async delay() {},
      log(line) {
        logs.push(line);
      },
    });

    assert.deepEqual(result.displaced, []);
    assert.deepEqual(releases, []);
    assert.match(logs.join('\n'), /CLEAR \(nothing to displace\)/);
  });

  test('android console BUSY is ignored like canonical release', async () => {
    const releases: Array<'SIGTERM' | 'SIGKILL'> = [];
    const logs: string[] = [];
    // Leftover emulator console after emu kill — services:true would mark BUSY.
    const consoleOnly = inventory({
      listeners: new Map([[5562, [707]]]),
    });
    const options = parseForceAcquireOptions(
      [FORCE_ACQUIRE_AUTHORIZE_FLAG, '--slot=3', '--platform=android'],
      {},
    );

    const result = await forceAcquireResources(options, {
      collectInventory: () => consoleOnly,
      releaseResources(_options, _inventory, signal) {
        releases.push(signal);
      },
      async delay() {},
      log(line) {
        logs.push(line);
      },
    });

    assert.deepEqual(result.displaced, []);
    assert.deepEqual(releases, []);
    assert.match(logs.join('\n'), /CLEAR \(nothing to displace\)/);
  });
});
