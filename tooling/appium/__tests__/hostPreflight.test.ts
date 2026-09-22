import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { iosAppBundleResolution } from '../src/formats.ts';
import {
  appiumPort,
  bootAndPersistSelectedSimulator,
  DEFAULT_APPIUM_PORT,
  DEFAULT_IOS_DEVICE_NAME,
  ensureAndroidMetroReverse,
  findCompleteIosAppBundle,
  githubEnvSelectionLines,
  githubEnvUdidLine,
  isCompleteIosAppBundle,
  MIN_ANDROID_API,
  MIN_NODE_MAJOR,
  nodeMajor,
  nodeMeetsMinimum,
  parseAvdApi,
  parseAvailableIosSimulators,
  PREFERRED_ANDROID_API,
  resolveIosAppBundle,
  requireGithubEnvPath,
  requireIosUdid,
  SELECT_AND_BOOT_GITHUB_ENV_ERROR,
  selectConnectedAndroidDevice,
  selectAndroidAvd,
  selectIosSimulator,
} from '../src/hostPreflight.ts';

describe('hostPreflight', () => {
  test('uses a dedicated Appium port and rejects invalid overrides', () => {
    assert.equal(DEFAULT_APPIUM_PORT, 4725);
    assert.equal(appiumPort(), 4725);
    assert.equal(appiumPort('4730'), 4730);
    assert.throws(() => appiumPort('not-a-port'), /integer from 1 to 65535/);
    assert.throws(() => appiumPort('0'), /integer from 1 to 65535/);
    assert.throws(() => appiumPort('65536'), /integer from 1 to 65535/);
  });

  test('treats Node 24+ as the floor and Node 22 as below minimum', () => {
    assert.equal(MIN_NODE_MAJOR, 24);
    assert.equal(nodeMajor('v24.20.0'), 24);
    assert.equal(nodeMajor(' 26.0.0 '), 26);
    assert.equal(nodeMajor('not-a-version'), 0);
    assert.equal(nodeMeetsMinimum('v24.0.0'), true);
    assert.equal(nodeMeetsMinimum('v26.0.0'), true);
    assert.equal(nodeMeetsMinimum('v22.14.0'), false);
  });

  test('selects an API 36 AVD over older qualifying images and rejects API 24', () => {
    assert.equal(parseAvdApi('API24_GAPI'), 24);
    assert.equal(parseAvdApi('Pixel_9_API_36'), 36);
    assert.equal(parseAvdApi('android-35'), 35);
    assert.equal(parseAvdApi('Pixel_without_api'), null);
    assert.equal(MIN_ANDROID_API, 26);
    assert.equal(PREFERRED_ANDROID_API, 36);
    assert.equal(
      selectAndroidAvd(['API24_GAPI', 'API26_GAPI', 'API36_GAPI', 'API33_GAPI'])?.name,
      'API36_GAPI',
    );
    assert.equal(selectAndroidAvd(['API24_GAPI']), null);
  });

  test('deterministically selects a connected API 36 device and rejects API 24', () => {
    const devices = [
      { serial: 'api-33', api: 33 },
      { serial: 'api-36-b', api: 36 },
      { serial: 'api-24', api: 24 },
      { serial: 'api-36-a', api: 36 },
    ];
    assert.deepEqual(selectConnectedAndroidDevice(devices), {
      serial: 'api-36-a',
      api: 36,
    });
    assert.equal(selectConnectedAndroidDevice(devices, 'api-24'), null);
    assert.deepEqual(selectConnectedAndroidDevice(devices, 'api-33'), {
      serial: 'api-33',
      api: 33,
    });
  });

  test('proves the selected Android serial can reach Metro through its reverse', () => {
    const calls: string[][] = [];
    ensureAndroidMetroReverse('emulator-5554', (bin, args) => {
      calls.push([bin, ...args]);
      if (args.at(-1) === '--list') {
        return 'emulator-5554 tcp:8081 tcp:8081\n';
      }
      return '';
    });
    assert.deepEqual(calls, [
      ['adb', '-s', 'emulator-5554', 'reverse', 'tcp:8081', 'tcp:8081'],
      ['adb', '-s', 'emulator-5554', 'reverse', '--list'],
      [
        'adb',
        '-s',
        'emulator-5554',
        'shell',
        'toybox',
        'nc',
        '-w',
        '5',
        '-z',
        '127.0.0.1',
        '8081',
      ],
    ]);
  });

  test('rejects a missing reverse or failed selected-device Metro connection', () => {
    assert.throws(
      () => ensureAndroidMetroReverse('selected', (_bin, args) =>
        args.at(-1) === '--list' ? '' : 'packager-status:running',
      ),
      /did not retain the required tcp:8081 reverse/,
    );
    assert.throws(
      () =>
        ensureAndroidMetroReverse('selected', (_bin, args) => {
          if (args.at(-1) === '--list') {
            return 'selected tcp:8081 tcp:8081';
          }
          if (args.includes('-z')) {
            throw new Error('device connection refused');
          }
          return '';
        }),
      /device connection refused/,
    );
  });

  test('requires a preflight-selected iOS UDID before WDIO capabilities load', () => {
    assert.throws(() => requireIosUdid({}), /RNGMA_IOS_UDID is required/);
    assert.throws(() => requireIosUdid({ RNGMA_IOS_UDID: '   ' }), /RNGMA_IOS_UDID is required/);
    assert.equal(
      requireIosUdid({ RNGMA_IOS_UDID: ' fixture-udid ' }),
      'fixture-udid',
    );
  });

  test('boots a shutdown simulator then waits on bootstatus before persisting UDID', () => {
    const calls: string[][] = [];
    const writes: Array<{ path: string; data: string }> = [];
    bootAndPersistSelectedSimulator(
      { udid: 'shutdown-udid', state: 'Shutdown', runtimeVersion: '26.2' },
      ['ios', '--select-and-boot', '--github-env', '/tmp/github.env'],
      (bin, args) => {
        calls.push([bin, ...args]);
      },
      (path, data) => {
        writes.push({ path, data });
      },
    );
    assert.deepEqual(calls, [
      ['xcrun', 'simctl', 'boot', 'shutdown-udid'],
      ['xcrun', 'simctl', 'bootstatus', 'shutdown-udid', '-b'],
    ]);
    assert.deepEqual(writes, [
      {
        path: '/tmp/github.env',
        data: githubEnvSelectionLines('shutdown-udid', '26.2'),
      },
    ]);
    assert.equal(writes[0]?.data, 'RNGMA_IOS_UDID=shutdown-udid\nRNGMA_IOS_VERSION=26.2\n');
  });

  test('skips boot for an already-Booted simulator and still waits on bootstatus', () => {
    const calls: string[][] = [];
    bootAndPersistSelectedSimulator(
      { udid: 'booted-udid', state: 'Booted', runtimeVersion: '26.2' },
      ['--github-env', '/tmp/github.env'],
      (_bin, args) => {
        calls.push(args);
      },
      () => {},
    );
    assert.deepEqual(calls, [['simctl', 'bootstatus', 'booted-udid', '-b']]);
  });

  test('fails clearly when --github-env or its path is missing', () => {
    assert.throws(() => requireGithubEnvPath([]), {
      message: SELECT_AND_BOOT_GITHUB_ENV_ERROR,
    });
    assert.throws(() => requireGithubEnvPath(['--github-env']), {
      message: SELECT_AND_BOOT_GITHUB_ENV_ERROR,
    });
    const calls: string[][] = [];
    assert.throws(
      () =>
        bootAndPersistSelectedSimulator(
          { udid: 'udid', state: 'Booted', runtimeVersion: '26.2' },
          ['ios', '--select-and-boot'],
          (bin, args) => {
            calls.push([bin, ...args]);
          },
          () => {
            assert.fail('must not persist without --github-env');
          },
        ),
      { message: SELECT_AND_BOOT_GITHUB_ENV_ERROR },
    );
    assert.deepEqual(calls, [['xcrun', 'simctl', 'bootstatus', 'udid', '-b']]);
  });

  test('defaults to exact iPhone 17 and prefers an already booted match', () => {
    assert.equal(DEFAULT_IOS_DEVICE_NAME, 'iPhone 17');
    const simulators = parseAvailableIosSimulators(
      JSON.stringify({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
            { name: 'iPhone 17', udid: 'ios-26-shutdown', state: 'Shutdown', isAvailable: true },
            { name: 'iPhone 17 Pro', udid: 'pro', state: 'Booted', isAvailable: true },
          ],
          'com.apple.CoreSimulator.SimRuntime.iOS-25-5': [
            { name: 'iPhone 17', udid: 'ios-25-booted', state: 'Booted', isAvailable: true },
          ],
        },
      }),
    );
    assert.equal(selectIosSimulator(simulators)?.udid, 'ios-25-booted');
  });

  test('selects the newest exact-name runtime deterministically when none is booted', () => {
    const simulators = parseAvailableIosSimulators(
      JSON.stringify({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-25-5': [
            { name: 'iPhone 17', udid: 'older', state: 'Shutdown', isAvailable: true },
          ],
          'com.apple.CoreSimulator.SimRuntime.iOS-26-1': [
            { name: 'iPhone 17', udid: 'newer-b', state: 'Shutdown', isAvailable: true },
            { name: 'iPhone 17', udid: 'newer-a', state: 'Shutdown', isAvailable: true },
          ],
        },
      }),
    );
    assert.equal(selectIosSimulator(simulators)?.udid, 'newer-a');
    assert.equal(
      selectIosSimulator(simulators, { platformVersion: '25.5' })?.udid,
      'older',
    );
  });

  test('rejects absent exact-name, unavailable, version, and UDID selections', () => {
    const simulators = parseAvailableIosSimulators(
      JSON.stringify({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
            { name: 'iPhone 16', udid: 'old-model', state: 'Shutdown', isAvailable: true },
            { name: 'iPhone 17', udid: 'unavailable', state: 'Shutdown', isAvailable: false },
            { name: 'iPhone 17', udid: 'available', state: 'Shutdown', isAvailable: true },
          ],
        },
      }),
    );
    assert.equal(selectIosSimulator(simulators, { deviceName: 'iPhone 18' }), null);
    assert.equal(selectIosSimulator(simulators, { platformVersion: '25.5' }), null);
    assert.equal(selectIosSimulator(simulators, { udid: 'missing' }), null);
    assert.equal(selectIosSimulator(simulators, { udid: 'available' })?.udid, 'available');
  });

  test('discovers only iOS app bundles with a regular inner executable', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'rngma-ios-app-'));
    const originalConfiguredApp = process.env.RNGMA_IOS_APP;
    try {
      const staleApp = join(fixtureRoot, 'stale', 'ReactTestApp.app');
      const completeApp = join(fixtureRoot, 'complete', 'ReactTestApp.app');
      const missingApp = join(fixtureRoot, 'missing.app');
      const directoryExecutableApp = join(fixtureRoot, 'directory-executable', 'ReactTestApp.app');
      mkdirSync(staleApp, { recursive: true });
      mkdirSync(completeApp, { recursive: true });
      mkdirSync(join(directoryExecutableApp, 'ReactTestApp'), { recursive: true });
      writeFileSync(join(completeApp, 'ReactTestApp'), 'fixture executable');

      assert.equal(isCompleteIosAppBundle(staleApp), false);
      assert.equal(isCompleteIosAppBundle(directoryExecutableApp), false);
      assert.equal(isCompleteIosAppBundle(completeApp), true);
      assert.equal(findCompleteIosAppBundle([staleApp, completeApp]), completeApp);
      assert.equal(findCompleteIosAppBundle([staleApp]), undefined);
      assert.deepEqual(resolveIosAppBundle([staleApp]), {
        kind: 'incomplete',
        path: staleApp,
      });
      assert.deepEqual(resolveIosAppBundle([missingApp]), {
        kind: 'absent',
      });
      assert.deepEqual(resolveIosAppBundle([staleApp, completeApp]), {
        kind: 'complete',
        path: completeApp,
      });

      process.env.RNGMA_IOS_APP = missingApp;
      assert.deepEqual(iosAppBundleResolution(), {
        kind: 'incomplete',
        path: missingApp,
      });
    } finally {
      if (originalConfiguredApp == null) {
        delete process.env.RNGMA_IOS_APP;
      } else {
        process.env.RNGMA_IOS_APP = originalConfiguredApp;
      }
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
