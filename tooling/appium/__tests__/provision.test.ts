import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  androidProvisionCommands,
  androidSystemImage,
  assertCreateOnly,
  executeCreateOnly,
  iosProvisionCommands,
  parseProvisionPlatforms,
  runSlotProvisioning,
  type ProvisionHost,
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

  test('selects deterministic API 36 Play Store images by host architecture', () => {
    assert.equal(
      androidSystemImage('arm64'),
      'system-images;android-36;google_apis_playstore;arm64-v8a',
    );
    assert.equal(
      androidSystemImage('x64'),
      'system-images;android-36;google_apis_playstore;x86_64',
    );
  });

  test('installs and creates with the arm64 host image', () => {
    const commands = androidProvisionCommands({
      slot: 1,
      architecture: 'arm64',
      avdNames: [],
      installedPackages: [],
    });
    assert.deepEqual(commands, [
      {
        bin: 'sdkmanager',
        args: ['system-images;android-36;google_apis_playstore;arm64-v8a'],
      },
      {
        bin: 'avdmanager',
        args: [
          'create',
          'avd',
          '--name',
          'TestingAVD-1',
          '--package',
          'system-images;android-36;google_apis_playstore;arm64-v8a',
          '--device',
          'pixel_9',
        ],
        input: 'no\n',
      },
    ]);
  });

  test('installs and creates with the x64 host image', () => {
    const image = 'system-images;android-36;google_apis_playstore;x86_64';
    const missing = androidProvisionCommands({
      slot: 2,
      architecture: 'x64',
      avdNames: [],
      installedPackages: [],
    });
    assert.deepEqual(missing[0], { bin: 'sdkmanager', args: [image] });
    assert.equal(missing[1]?.args[5], image);

    const installed = androidProvisionCommands({
      slot: 2,
      architecture: 'x64',
      avdNames: [],
      installedPackages: [image],
    });
    assert.equal(installed.length, 1);
    assert.equal(installed[0]?.bin, 'avdmanager');
    assert.equal(installed[0]?.args[5], image);
  });

  test('reuses exact existing names without inspecting or mutating their ABI', () => {
    assert.deepEqual(
      androidProvisionCommands({
        slot: 1,
        architecture: 'arm64',
        avdNames: ['TestingAVD-1', 'TestingAVD-1-Detox', 'unrelated'],
        installedPackages: ['system-images;android-36;google_apis_playstore;x86_64'],
      }),
      [],
    );
  });

  test('rejects unsupported architecture before any provisioning command exists', () => {
    for (const architecture of ['ia32', 'riscv64', '']) {
      assert.throws(
        () => androidSystemImage(architecture),
        /Unsupported host architecture.*supported architectures: arm64, x64/,
      );
      assert.throws(
        () =>
          androidProvisionCommands({
            slot: 1,
            architecture,
            avdNames: [],
            installedPackages: [],
          }),
        /Unsupported host architecture/,
      );
    }
  });

  function recordingHost(): { host: ProvisionHost; calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      host: {
        listAndroidAvds() {
          calls.push('emulator -list-avds');
          return [];
        },
        listInstalledPackages() {
          calls.push('sdkmanager --list_installed');
          return [];
        },
        listIosInventory() {
          calls.push('simctl list');
          return iosInventory();
        },
        run(command) {
          calls.push([command.bin, ...command.args].join(' '));
        },
      },
    };
  }

  test('unsupported host architecture fails before Android inventory or mutation', () => {
    for (const target of ['android', 'both'] as const) {
      const { host, calls } = recordingHost();
      assert.throws(
        () =>
          runSlotProvisioning({
            target,
            env: { RNGMA_E2E_SLOT: '1' },
            architecture: 'ia32',
            host,
          }),
        /Unsupported host architecture "ia32"/,
      );
      assert.deepEqual(calls, []);
    }
  });

  test('supported architecture inventories Android only after validation', () => {
    const { host, calls } = recordingHost();
    const outcome = runSlotProvisioning({
      target: 'android',
      env: { RNGMA_E2E_SLOT: '6' },
      architecture: 'arm64',
      host,
    });
    assert.equal(outcome.android?.name, 'TestingAVD-6');
    assert.equal(outcome.android?.reused, false);
    assert.deepEqual(calls.slice(0, 2), [
      'emulator -list-avds',
      'sdkmanager --list_installed',
    ]);
    assert.match(
      calls[2] ?? '',
      /sdkmanager system-images;android-36;google_apis_playstore;arm64-v8a/,
    );
    assert.match(calls[3] ?? '', /avdmanager create avd --name TestingAVD-6/);
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
        architecture: 'arm64',
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
          architecture: 'arm64',
          avdNames: [],
          installedPackages: [],
        }),
      /reserved for RNFB/,
    );
    assert.throws(() => iosProvisionCommands(3, iosInventory()), /reserved for RNFB/);
  });
});
