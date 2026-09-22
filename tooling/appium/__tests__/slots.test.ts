import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  androidGradleCommand,
  androidRunCommands,
  androidSlotBootCommand,
  assertAndroidSlotRunInventory,
  assertIosRunSelection,
  iosBuildCommand,
  packagerCommand,
} from '../src/commands.ts';
import { androidDebugApkPath } from '../src/formats.ts';
import {
  assertRngmaSlotAllowed,
  iosMetroProcessArguments,
  parseSlot,
  platformForSharedConfig,
  requireRngmaSlot,
  runtimeResources,
  SERIAL_APPIUM_PORT,
  SERIAL_METRO_PORT,
  serialAndroidApkPath,
  slotAndroidApkPath,
  slotResources,
  worktreeMetroPort,
} from '../src/slots.ts';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('cross-platform e2e slots', () => {
  test('computes every slot and platform from the locked formula', () => {
    const offsets = { android: 0, ios: 100, macos: 200 } as const;
    for (let slot = 0; slot <= 7; slot++) {
      for (const [platform, offset] of Object.entries(offsets)) {
        const resources = slotResources(slot, platform as keyof typeof offsets);
        const expectedBase = 12000 + slot * 1000 + offset;
        assert.equal(resources.basePort, expectedBase);
        assert.equal(resources.metroPort, expectedBase + 7);
        assert.equal(resources.appiumPort, expectedBase + 13);
        assert.equal(resources.automationPort, expectedBase + 14);
        assert.equal(resources.mjpegPort, expectedBase + 15);
        assert.equal(resources.androidConsolePort, 5556 + 2 * slot);
        assert.equal(resources.androidSerial, `emulator-${5556 + 2 * slot}`);
        assert.equal(resources.androidAvdName, `TestingAVD-${slot}`);
        assert.equal(resources.iosSimulatorName, `RN E2E iOS slot-${slot}`);
      }
    }
  });

  test('rejects non-integers and values outside 0-7', () => {
    for (const value of ['-1', '8', '1.5', ' 1', '1 ', 'one']) {
      assert.throws(() => parseSlot(value), /integer from 0 to 7/);
    }
    assert.throws(() => slotResources(1.5, 'android'), /integer from 0 to 7/);
  });

  test('keeps generic slot 3 math separate from RNGMA reservation policy', () => {
    assert.equal(slotResources(3, 'android').metroPort, 15007);
    assert.throws(() => assertRngmaSlotAllowed(3), /reserved for RNFB/);
    assert.throws(() => requireRngmaSlot('3'), /reserved for RNFB/);
    assert.throws(() => assertRngmaSlotAllowed(0), /not an operational RNGMA slot/);
    for (const slot of [1, 2, 4, 5, 6, 7]) {
      assert.doesNotThrow(() => assertRngmaSlotAllowed(slot));
    }
  });

  test('separates raw platform math from the operational worktree Metro', () => {
    assert.equal(slotResources(1, 'ios').metroPort, 13107);
    assert.equal(worktreeMetroPort(1), 13007);
    assert.equal(runtimeResources('ios', {
      RNGMA_E2E_SLOT: '1',
      RNGMA_E2E_PLATFORM: 'ios',
    }).metroPort, 13007);
  });

  test('preserves serial defaults and paths when RNGMA_E2E_SLOT is unset', () => {
    const runtime = runtimeResources('android', {});
    assert.equal(runtime.slot, undefined);
    assert.equal(runtime.metroPort, SERIAL_METRO_PORT);
    assert.equal(runtime.appiumPort, SERIAL_APPIUM_PORT);
    assert.match(runtime.androidApkPath, /outputs\/apk\/debug\/app-debug\.apk$/);
    assert.deepEqual(packagerCommand(false, {}).args, [
      'workspace',
      'RNGoogleMobileAdsExample',
      'react-native',
      'start',
    ]);
    assert.deepEqual(androidGradleCommand({}).args, ['assembleDebug']);
    assert.deepEqual(androidRunCommands({}), [
      {
        bin: 'yarn',
        args: ['workspace', 'RNGoogleMobileAdsExample', 'android'],
      },
    ]);
    assert.equal(
      assertIosRunSelection(['--udid', 'serial-udid'], {}, undefined),
      'serial-udid',
    );
    assert.equal(iosBuildCommand({}).env?.RCT_METRO_PORT, undefined);
  });

  test('propagates slot 1 ports into packager, Gradle, and a distinct APK', () => {
    const env = { RNGMA_E2E_SLOT: '1', RNGMA_E2E_PLATFORM: 'android' };
    const runtime = runtimeResources('android', env);
    assert.equal(runtime.metroPort, 13007);
    assert.equal(runtime.appiumPort, 13013);
    assert.deepEqual(packagerCommand(true, env).args.slice(-3), [
      '--reset-cache',
      '--port',
      '13007',
    ]);
    assert.deepEqual(androidGradleCommand(env).args, [
      'assembleDebug',
      '-PreactNativeDevServerPort=13007',
    ]);
    assert.deepEqual(androidSlotBootCommand(env), {
      bin: 'emulator',
      args: ['-avd', 'TestingAVD-1', '-port', '5558'],
    });
    assert.deepEqual(androidRunCommands(env), [
      {
        bin: process.platform === 'win32' ? 'gradlew.bat' : './gradlew',
        args: ['assembleDebug', '-PreactNativeDevServerPort=13007'],
        cwd: 'RNGoogleMobileAdsExample/android',
      },
      {
        bin: 'adb',
        args: [
          '-s',
          'emulator-5558',
          'reverse',
          'tcp:13007',
          'tcp:13007',
        ],
      },
      {
        bin: 'adb',
        args: [
          '-s',
          'emulator-5558',
          'install',
          '-r',
          serialAndroidApkPath(),
        ],
      },
      {
        bin: 'adb',
        args: [
          '-s',
          'emulator-5558',
          'shell',
          'am',
          'start',
          '-n',
          'com.microsoft.reacttestapp/com.microsoft.reacttestapp.MainActivity',
        ],
      },
    ]);
    for (const command of androidRunCommands(env).filter(command => command.bin === 'adb')) {
      assert.deepEqual(command.args.slice(0, 2), ['-s', 'emulator-5558']);
      assert.doesNotMatch(command.args.join(' '), /emulator-5554|emulator-5562/);
    }
    assert.equal(runtime.androidApkPath, slotAndroidApkPath(1));

    const previousSlot = process.env.RNGMA_E2E_SLOT;
    const previousApk = process.env.RNGMA_ANDROID_APK;
    try {
      process.env.RNGMA_E2E_SLOT = '1';
      delete process.env.RNGMA_ANDROID_APK;
      assert.equal(androidDebugApkPath(), slotAndroidApkPath(1));
    } finally {
      if (previousSlot == null) delete process.env.RNGMA_E2E_SLOT;
      else process.env.RNGMA_E2E_SLOT = previousSlot;
      if (previousApk == null) delete process.env.RNGMA_ANDROID_APK;
      else process.env.RNGMA_ANDROID_APK = previousApk;
    }
  });

  test('Android slot run validates exact AVD and serial without generic fallback', () => {
    const env = { RNGMA_E2E_SLOT: '1', RNGMA_E2E_PLATFORM: 'android' };
    const runtime = runtimeResources('android', env);
    assert.equal(
      assertAndroidSlotRunInventory(runtime, ['TestingAVD-1'], []),
      'boot-required',
    );
    assert.equal(
      assertAndroidSlotRunInventory(runtime, ['TestingAVD-1'], [
        { serial: 'emulator-5558', avdName: 'TestingAVD-1' },
      ]),
      'connected',
    );
    assert.equal(
      assertAndroidSlotRunInventory(runtime, ['TestingAVD-1'], [
        { serial: 'emulator-5554', avdName: 'TestingAVD' },
      ]),
      'boot-required',
      'an unrelated serial must not be selected',
    );
    assert.throws(
      () => assertAndroidSlotRunInventory(runtime, ['TestingAVD'], []),
      /exact AVD TestingAVD-1 is missing/,
    );
    assert.throws(
      () =>
        assertAndroidSlotRunInventory(runtime, ['TestingAVD-1'], [
          { serial: 'emulator-5558', avdName: 'TestingAVD-2' },
        ]),
      /not exact TestingAVD-1/,
    );
    assert.throws(
      () =>
        androidRunCommands({
          RNGMA_E2E_SLOT: '1',
          RNGMA_E2E_PLATFORM: 'ios',
        }),
      /conflicts with the android command/,
    );
    assert.throws(() => androidRunCommands({ RNGMA_E2E_SLOT: '0' }), /not an operational/);
    assert.throws(() => androidRunCommands({ RNGMA_E2E_SLOT: '3' }), /reserved for RNFB/);
  });

  test('iOS slot run requires the selector exact name, UDID, and runtime', () => {
    const env = {
      RNGMA_E2E_SLOT: '1',
      RNGMA_E2E_PLATFORM: 'ios',
      RNGMA_IOS_UDID: 'slot-udid',
      RNGMA_IOS_VERSION: '26.5',
    };
    const inventory = JSON.stringify({
      devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
          {
            name: 'RN E2E iOS slot-1',
            udid: 'slot-udid',
            state: 'Booted',
            isAvailable: true,
          },
          {
            name: 'iPhone 17',
            udid: 'serial-udid',
            state: 'Shutdown',
            isAvailable: true,
          },
        ],
      },
    });
    assert.equal(
      assertIosRunSelection(['--udid', 'slot-udid'], env, inventory),
      'slot-udid',
    );
    assert.throws(
      () =>
        assertIosRunSelection(
          ['--udid', 'arbitrary'],
          env,
          inventory,
        ),
      /conflicts with selector/,
    );
    assert.throws(
      () =>
        assertIosRunSelection(
          ['--udid', 'slot-udid'],
          { RNGMA_E2E_SLOT: '1', RNGMA_E2E_PLATFORM: 'ios' },
          inventory,
        ),
      /requires RNGMA_IOS_UDID and RNGMA_IOS_VERSION/,
    );
    assert.throws(
      () =>
        assertIosRunSelection(
          ['--udid', 'serial-udid'],
          { ...env, RNGMA_IOS_UDID: 'serial-udid' },
          inventory,
        ),
      /not an available exact RN E2E iOS slot-1/,
    );
    assert.throws(
      () =>
        assertIosRunSelection(
          ['--udid', 'slot-udid'],
          { ...env, RNGMA_IOS_VERSION: '25.0' },
          inventory,
        ),
      /not an available exact RN E2E iOS slot-1/,
    );
    assert.throws(
      () =>
        assertIosRunSelection(
          ['--udid', 'slot-udid'],
          { ...env, RNGMA_E2E_PLATFORM: 'android' },
          inventory,
        ),
      /conflicts with the ios command/,
    );
  });

  test('requires the platform while keeping slotted Metro platform-independent', () => {
    assert.throws(
      () => packagerCommand(false, { RNGMA_E2E_SLOT: '1' }),
      /RNGMA_E2E_PLATFORM must be android or ios/,
    );
    assert.deepEqual(
      packagerCommand(false, {
        RNGMA_E2E_SLOT: '1',
        RNGMA_E2E_PLATFORM: 'ios',
      }).args.slice(-2),
      ['--port', '13007'],
    );
    const iosBuild = iosBuildCommand({
      RNGMA_E2E_SLOT: '1',
      RNGMA_E2E_PLATFORM: 'ios',
    });
    assert.equal(iosBuild.env?.RCT_METRO_PORT, '13007');
    assert.deepEqual(iosBuild.args.slice(-2), [
      '--extra-params',
      'RCT_METRO_PORT=13007',
    ]);
  });

  test('propagates one documented platform contract into shared WDIO ports', () => {
    const androidEnv = {
      RNGMA_E2E_SLOT: '1',
      RNGMA_E2E_PLATFORM: 'android',
    };
    const iosEnv = {
      RNGMA_E2E_SLOT: '1',
      RNGMA_E2E_PLATFORM: 'ios',
    };
    assert.equal(platformForSharedConfig(androidEnv), 'android');
    assert.equal(runtimeResources(platformForSharedConfig(androidEnv), androidEnv).appiumPort, 13013);
    assert.equal(platformForSharedConfig(iosEnv), 'ios');
    assert.equal(runtimeResources(platformForSharedConfig(iosEnv), iosEnv).appiumPort, 13113);
    assert.equal(platformForSharedConfig({}), 'android');
    assert.equal(runtimeResources(platformForSharedConfig({}), {}).appiumPort, 4725);
    assert.deepEqual(
      iosMetroProcessArguments(runtimeResources('ios', iosEnv)),
      {
        'appium:processArguments': {
          args: ['-RCT_jsLocation', 'localhost:13007'],
          env: { RCT_METRO_PORT: '13007' },
        },
      },
    );
    assert.deepEqual(
      iosMetroProcessArguments(runtimeResources('ios', {})),
      {},
    );
    assert.throws(
      () => platformForSharedConfig({ RNGMA_E2E_SLOT: '1' }),
      /RNGMA_E2E_PLATFORM must be android or ios/,
    );
    assert.throws(
      () => runtimeResources('android', iosEnv),
      /RNGMA_E2E_PLATFORM=ios conflicts with the android command/,
    );
    assert.throws(
      () =>
        runtimeResources('ios', {
          RNGMA_E2E_SLOT: '1',
          RNGMA_E2E_PLATFORM: 'windows',
        }),
      /must be android or ios/,
    );
  });

  test('uses the first parallel slot as one cross-platform worktree Metro', () => {
    for (const platform of ['android', 'ios'] as const) {
      for (const slot of ['1', '4', '5']) {
        const runtime = runtimeResources(platform, {
          RNGMA_E2E_SLOT: slot,
          RNGMA_E2E_PLATFORM: platform,
          RNGMA_E2E_METRO_SLOT: '1',
          RNGMA_METRO_PORT: '13007',
        });
        assert.equal(runtime.metroOwnerSlot, 1);
        assert.equal(runtime.metroPort, 13007);
      }
    }
    assert.throws(
      () => runtimeResources('android', { RNGMA_E2E_METRO_SLOT: '1' }),
      /requires RNGMA_E2E_SLOT/,
    );
  });

  test('propagates the owner Metro through every consumer command surface', () => {
    const androidEnv = {
      RNGMA_E2E_SLOT: '4',
      RNGMA_E2E_PLATFORM: 'android',
      RNGMA_E2E_METRO_SLOT: '1',
    };
    assert.deepEqual(packagerCommand(false, androidEnv).args.slice(-2), [
      '--port',
      '13007',
    ]);
    assert.deepEqual(androidGradleCommand(androidEnv).args, [
      'assembleDebug',
      '-PreactNativeDevServerPort=13007',
    ]);
    const androidRun = androidRunCommands(androidEnv);
    assert.equal(androidRun[0]?.args.at(-1), '-PreactNativeDevServerPort=13007');
    assert.deepEqual(androidRun[1]?.args, [
      '-s',
      'emulator-5564',
      'reverse',
      'tcp:13007',
      'tcp:13007',
    ]);
    assert.ok(
      androidRun.slice(1).every(command =>
        command.args.slice(0, 2).every((value, index) =>
          value === ['-s', 'emulator-5564'][index]),
      ),
    );

    const iosEnv = {
      RNGMA_E2E_SLOT: '5',
      RNGMA_E2E_PLATFORM: 'ios',
      RNGMA_E2E_METRO_SLOT: '1',
    };
    const iosBuild = iosBuildCommand(iosEnv);
    assert.equal(iosBuild.env?.RCT_METRO_PORT, '13007');
    assert.deepEqual(iosBuild.args.slice(-2), [
      '--extra-params',
      'RCT_METRO_PORT=13007',
    ]);
    assert.deepEqual(
      iosMetroProcessArguments(runtimeResources('ios', iosEnv)),
      {
        'appium:processArguments': {
          args: ['-RCT_jsLocation', 'localhost:13007'],
          env: { RCT_METRO_PORT: '13007' },
        },
      },
    );
  });

  test('rejects explicit port overrides that conflict with a selected slot', () => {
    assert.throws(
      () =>
        runtimeResources('android', {
          RNGMA_E2E_SLOT: '1',
          RNGMA_METRO_PORT: '8081',
        }),
      /RNGMA_METRO_PORT=8081 conflicts/,
    );
    assert.throws(
      () =>
        runtimeResources('ios', {
          RNGMA_E2E_SLOT: '1',
          RNGMA_APPIUM_PORT: '4725',
        }),
      /RNGMA_APPIUM_PORT=4725 conflicts/,
    );
    assert.doesNotThrow(() =>
      runtimeResources('ios', {
        RNGMA_E2E_SLOT: '1',
        RNGMA_METRO_PORT: '13007',
        RNGMA_APPIUM_PORT: '13113',
      }),
    );
  });

  test('canonical named scripts own real Gradle input and artifact copy', () => {
    const rootPackage = JSON.parse(
      readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const runner = readFileSync(
      path.join(repositoryRoot, 'tooling/appium/scripts/run-named.ts'),
      'utf8',
    );
    const preflight = readFileSync(
      path.join(repositoryRoot, 'tooling/appium/scripts/preflight.ts'),
      'utf8',
    );
    const shared = readFileSync(
      path.join(repositoryRoot, 'tooling/appium/wdio.shared.conf.ts'),
      'utf8',
    );
    assert.equal(
      rootPackage.scripts['tests:android:build'],
      'yarn workspace @invertase/rngma-appium android:build',
    );
    assert.equal(
      rootPackage.scripts['tests:android:run'],
      'yarn workspace @invertase/rngma-appium android:run',
    );
    assert.equal(
      rootPackage.scripts['tests:ios:run'],
      'yarn workspace @invertase/rngma-appium ios:run',
    );
    assert.match(runner, /androidGradleCommand\(\)/);
    assert.match(runner, /copyFileSync\(serialAndroidApkPath\(\), runtime\.androidApkPath\)/);
    assert.match(runner, /execute\(iosBuildCommand\(\)\)/);
    assert.match(preflight, /RNGMA_E2E_PLATFORM: target/);
    assert.doesNotMatch(preflight, /RNGMA_E2E_TARGET/);
    assert.doesNotMatch(shared, /RNGMA_APPIUM_PLATFORM/);
  });
});
