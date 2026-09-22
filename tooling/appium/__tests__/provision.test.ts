import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ANDROID_SYSTEM_IMAGE,
  androidProvisionCommands,
  assertCreateOnly,
  executeCreateOnly,
  iosProvisionCommands,
  parseProvisionPlatforms,
} from '../src/provision.ts';

const iosInventory = (devices: Array<{ name: string; isAvailable?: boolean }> = []) =>
  JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-26-1': devices,
    },
    devicetypes: [
      {
        name: 'iPhone 17',
        identifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17',
      },
      {
        name: 'iPhone 17 Pro',
        identifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro',
      },
    ],
    runtimes: [
      {
        identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-25-5',
        version: '25.5',
        platform: 'iOS',
        isAvailable: true,
      },
      {
        identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-26-1',
        version: '26.1',
        platform: 'iOS',
        isAvailable: true,
      },
      {
        identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-27-0',
        version: '27.0',
        platform: 'iOS',
        isAvailable: false,
      },
    ],
  });

describe('create-only slot provisioning', () => {
  test('requires one explicit platform or both', () => {
    assert.deepEqual(parseProvisionPlatforms('android', {}), ['android']);
    assert.deepEqual(parseProvisionPlatforms('ios', {}), ['ios']);
    assert.deepEqual(parseProvisionPlatforms('both', {}), ['android', 'ios']);
    assert.throws(() => parseProvisionPlatforms(undefined, {}), /Usage:/);
    assert.throws(() => parseProvisionPlatforms('all', {}), /Usage:/);
  });

  test('rejects platform conflicts before any provisioning side effect', () => {
    let sideEffects = 0;
    const resolveThenTouch = (
      target: string,
      env: NodeJS.ProcessEnv,
    ): void => {
      parseProvisionPlatforms(target, env);
      sideEffects++;
    };
    assert.throws(
      () =>
        resolveThenTouch('android', {
          RNGMA_E2E_PLATFORM: 'ios',
        }),
      /conflicts with provisioning android/,
    );
    assert.throws(
      () =>
        resolveThenTouch('ios', {
          RNGMA_E2E_PLATFORM: 'android',
        }),
      /conflicts with provisioning ios/,
    );
    assert.throws(
      () =>
        resolveThenTouch('both', {
          RNGMA_E2E_PLATFORM: 'android',
        }),
      /both platforms requires RNGMA_E2E_PLATFORM to be unset/,
    );
    assert.throws(
      () =>
        resolveThenTouch('android', {
          RNGMA_E2E_PLATFORM: 'windows',
        }),
      /must be android or ios/,
    );
    assert.equal(sideEffects, 0);
    assert.deepEqual(
      parseProvisionPlatforms('android', {
        RNGMA_E2E_PLATFORM: 'android',
      }),
      ['android'],
    );
  });

  test('installs the exact API 36 image only when missing, then creates exact AVD', () => {
    const missingImage = androidProvisionCommands({
      slot: 1,
      avdNames: [],
      installedPackages: [],
    });
    assert.deepEqual(missingImage[0], {
      bin: 'sdkmanager',
      args: [ANDROID_SYSTEM_IMAGE],
    });
    assert.deepEqual(missingImage[1], {
      bin: 'avdmanager',
      args: [
        'create',
        'avd',
        '--name',
        'TestingAVD-1',
        '--package',
        'system-images;android-36;google_apis;x86_64',
        '--device',
        'pixel_9',
      ],
      input: 'no\n',
    });

    const installedImage = androidProvisionCommands({
      slot: 2,
      avdNames: [],
      installedPackages: [ANDROID_SYSTEM_IMAGE],
    });
    assert.equal(installedImage.length, 1);
    assert.equal(installedImage[0]?.bin, 'avdmanager');
  });

  test('reuses exact existing names and never mutates other Android AVDs', () => {
    assert.deepEqual(
      androidProvisionCommands({
        slot: 1,
        avdNames: ['TestingAVD-1', 'TestingAVD-1-Detox', 'unrelated'],
        installedPackages: [],
      }),
      [],
    );
  });

  test('creates exact iPhone 17 on newest available iOS runtime', () => {
    assert.deepEqual(iosProvisionCommands(1, iosInventory()), [
      {
        bin: 'xcrun',
        args: [
          'simctl',
          'create',
          'RN E2E iOS slot-1',
          'com.apple.CoreSimulator.SimDeviceType.iPhone-17',
          'com.apple.CoreSimulator.SimRuntime.iOS-26-1',
        ],
      },
    ]);
  });

  test('reuses exact iOS name without touching Detox or unrelated simulators', () => {
    assert.deepEqual(
      iosProvisionCommands(
        1,
        iosInventory([
          { name: 'RN E2E iOS slot-1-Detox' },
          { name: 'RN E2E iOS slot-1' },
          { name: 'unrelated' },
        ]),
      ),
      [],
    );
  });

  test('all generated commands are create-only and slot 3 is guarded', () => {
    const commands = [
      ...androidProvisionCommands({
        slot: 7,
        avdNames: [],
        installedPackages: [],
      }),
      ...iosProvisionCommands(7, iosInventory()),
    ];
    assert.doesNotThrow(() => assertCreateOnly(commands));
    const executed: typeof commands = [];
    executeCreateOnly(commands, command => executed.push(command));
    assert.deepEqual(executed, commands);
    assert.doesNotMatch(JSON.stringify(commands), /\b(delete|erase|remove|rename)\b/i);
    assert.throws(
      () =>
        androidProvisionCommands({
          slot: 3,
          avdNames: [],
          installedPackages: [],
        }),
      /reserved for RNFB/,
    );
    assert.throws(() => iosProvisionCommands(3, iosInventory()), /reserved for RNFB/);
  });
});
