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
  METRO_RESOURCE_ROOT,
  parseSlot,
  platformForSharedConfig,
  requireRngmaSlot,
  runtimeResources,
  SERIAL_APPIUM_PORT,
  SERIAL_METRO_PORT,
  serialAndroidApkPath,
  slotAndroidApkPath,
  slotMetroPackagerEnv,
  slotMetroRoots,
  slotResources,
  platformMetroPort,
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

  test('keeps generic slot 3 math and allows temporary RNGMA allocation', () => {
    assert.equal(slotResources(3, 'android').metroPort, 15007);
    assert.doesNotThrow(() => assertRngmaSlotAllowed(3));
    assert.equal(requireRngmaSlot('3'), 3);
    assert.throws(() => assertRngmaSlotAllowed(0), /not an operational RNGMA slot/);
    for (const slot of [1, 2, 3, 4, 5, 6, 7]) {
      assert.doesNotThrow(() => assertRngmaSlotAllowed(slot));
    }
  });

  test('uses platform-offset Metro ports for operational slot isolation', () => {
    assert.equal(slotResources(1, 'android').metroPort, 13007);
    assert.equal(slotResources(1, 'ios').metroPort, 13107);
    assert.equal(platformMetroPort(1, 'android'), 13007);
    assert.equal(platformMetroPort(1, 'ios'), 13107);
    assert.equal(runtimeResources('ios', {
      RNGMA_E2E_SLOT: '1',
      RNGMA_E2E_PLATFORM: 'ios',
    }).metroPort, 13107);
    assert.equal(runtimeResources('android', {
      RNGMA_E2E_SLOT: '1',
      RNGMA_E2E_PLATFORM: 'android',
    }).metroPort, 13007);
  });

  test('isolates Metro cache and temp roots per slot platform', () => {
    const android = slotMetroRoots(1, 'android');
    const ios = slotMetroRoots(1, 'ios');
    assert.equal(android.root, `${METRO_RESOURCE_ROOT}/slot-1/android`);
    assert.equal(ios.root, `${METRO_RESOURCE_ROOT}/slot-1/ios`);
    assert.notEqual(android.cache, ios.cache);
    assert.notEqual(android.tmp, ios.tmp);
    const env = slotMetroPackagerEnv(1, 'ios', { KEEP: '1' });
    assert.equal(env.KEEP, '1');
    assert.equal(env.TMPDIR, ios.tmp);
    assert.equal(env.RNGMA_METRO_CACHE_ROOT, ios.cache);
    const packager = packagerCommand(false, {
      RNGMA_E2E_SLOT: '1',
      RNGMA_E2E_PLATFORM: 'ios',
    });
    assert.equal(packager.env?.TMPDIR, ios.tmp);
    assert.equal(packager.env?.RNGMA_METRO_CACHE_ROOT, ios.cache);
    assert.deepEqual(packager.args.slice(-2), ['--port', '13107']);
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
    assert.deepEqual(
      androidGradleCommand({ RNGMA_ANDROID_BACKEND: 'nextgen' }).args,
      ['assembleDebug', '-PRNGMA_ANDROID_BACKEND=nextgen'],
    );
    assert.throws(
      () => androidGradleCommand({ RNGMA_ANDROID_BACKEND: 'unsupported' }),
      /must be classic, legacy, or nextgen/,
    );
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
    assert.deepEqual(iosBuildCommand({}).args.slice(-2), [
      '--extra-params',
      'CC=clang CPLUSPLUS=clang++',
    ]);
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
      args: [
        '-avd',
        'TestingAVD-1',
        '-port',
        '5558',
        '-cores',
        '2',
        '-noaudio',
      ],
    });
    assert.deepEqual(androidRunCommands(env), [
      {
        bin: 'yarn',
        args: [
          'workspace',
          'RNGoogleMobileAdsExample',
          'react-native',
          'run-android',
          '--device',
          'emulator-5558',
          '--binary-path',
          slotAndroidApkPath(1),
          '--no-packager',
          '--port',
          '13007',
        ],
      },
    ]);
    const slotRun = androidRunCommands(env)[0]!;
    assert.doesNotMatch(slotRun.args.join(' '), /installDebug|--tasks|assembleDebug/);
    assert.doesNotMatch(slotRun.args.join(' '), /emulator-5554|emulator-5562/);
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
    assert.doesNotThrow(() =>
      androidRunCommands({ RNGMA_E2E_SLOT: '3', RNGMA_E2E_PLATFORM: 'android' }),
    );
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

  test('requires the platform and binds slotted Metro to that platform port', () => {
    assert.throws(
      () => packagerCommand(false, { RNGMA_E2E_SLOT: '1' }),
      /RNGMA_E2E_PLATFORM must be android or ios/,
    );
    assert.deepEqual(
      packagerCommand(false, {
        RNGMA_E2E_SLOT: '1',
        RNGMA_E2E_PLATFORM: 'ios',
      }).args.slice(-2),
      ['--port', '13107'],
    );
    const iosBuild = iosBuildCommand({
      RNGMA_E2E_SLOT: '1',
      RNGMA_E2E_PLATFORM: 'ios',
    });
    assert.equal(iosBuild.env?.RCT_METRO_PORT, '13107');
    assert.deepEqual(iosBuild.args.slice(-2), [
      '--extra-params',
      'CC=clang CPLUSPLUS=clang++ RCT_METRO_PORT=13107',
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
          args: ['-RCT_jsLocation', 'localhost:13107'],
          env: { RCT_METRO_PORT: '13107' },
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

  test('uses the first parallel slot as one platform-separated Metro owner', () => {
    for (const slot of ['1', '4', '5']) {
      const android = runtimeResources('android', {
        RNGMA_E2E_SLOT: slot,
        RNGMA_E2E_PLATFORM: 'android',
        RNGMA_E2E_METRO_SLOT: '1',
        RNGMA_METRO_PORT: '13007',
      });
      assert.equal(android.metroOwnerSlot, 1);
      assert.equal(android.metroPort, 13007);
      const ios = runtimeResources('ios', {
        RNGMA_E2E_SLOT: slot,
        RNGMA_E2E_PLATFORM: 'ios',
        RNGMA_E2E_METRO_SLOT: '1',
        RNGMA_METRO_PORT: '13107',
      });
      assert.equal(ios.metroOwnerSlot, 1);
      assert.equal(ios.metroPort, 13107);
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
    assert.equal(
      packagerCommand(false, androidEnv).env?.RNGMA_METRO_CACHE_ROOT,
      slotMetroRoots(1, 'android').cache,
    );
    assert.deepEqual(androidGradleCommand(androidEnv).args, [
      'assembleDebug',
      '-PreactNativeDevServerPort=13007',
    ]);
    assert.deepEqual(androidRunCommands(androidEnv)[0]?.args, [
      'workspace',
      'RNGoogleMobileAdsExample',
      'react-native',
      'run-android',
      '--device',
      'emulator-5564',
      '--binary-path',
      slotAndroidApkPath(4),
      '--no-packager',
      '--port',
      '13007',
    ]);

    const iosEnv = {
      RNGMA_E2E_SLOT: '5',
      RNGMA_E2E_PLATFORM: 'ios',
      RNGMA_E2E_METRO_SLOT: '1',
    };
    const iosBuild = iosBuildCommand(iosEnv);
    assert.equal(iosBuild.env?.RCT_METRO_PORT, '13107');
    assert.deepEqual(iosBuild.args.slice(-2), [
      '--extra-params',
      'CC=clang CPLUSPLUS=clang++ RCT_METRO_PORT=13107',
    ]);
    assert.deepEqual(
      iosMetroProcessArguments(runtimeResources('ios', iosEnv)),
      {
        'appium:processArguments': {
          args: ['-RCT_jsLocation', 'localhost:13107'],
          env: { RCT_METRO_PORT: '13107' },
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
    assert.throws(
      () =>
        runtimeResources('ios', {
          RNGMA_E2E_SLOT: '1',
          RNGMA_METRO_PORT: '13007',
          RNGMA_APPIUM_PORT: '13113',
        }),
      /RNGMA_METRO_PORT=13007 conflicts/,
    );
    assert.doesNotThrow(() =>
      runtimeResources('ios', {
        RNGMA_E2E_SLOT: '1',
        RNGMA_METRO_PORT: '13107',
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
    assert.match(runner, /runtime\.slot != null && !isParallelParentChild\(\)/);
    assert.match(runner, /copyFileSync\(serialAndroidApkPath\(\), runtime\.androidApkPath\)/);
    assert.match(runner, /ensureAndroidMetroReverse\(/);
    assert.match(runner, /execute\(iosBuildCommand\(\)\)/);
    assert.match(preflight, /RNGMA_E2E_PLATFORM: target/);
    assert.doesNotMatch(preflight, /RNGMA_E2E_TARGET/);
    assert.doesNotMatch(shared, /RNGMA_APPIUM_PLATFORM/);
  });
});
