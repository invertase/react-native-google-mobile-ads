import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IOS_SESSION_RETRY_TIMEOUT_MS,
  IOS_WDA_DERIVED_DATA_PATH,
  WDA_LAUNCH_TIMEOUT_MS,
} from '../src/hostPreflight.ts';

// wdio.ios.conf.ts calls requireIosUdid() at module load; provide a value so this
// device-free import resolves without selecting a real simulator.
process.env.RNGMA_IOS_UDID = process.env.RNGMA_IOS_UDID || 'device-free-udid';
process.env.RNGMA_IOS_VERSION = process.env.RNGMA_IOS_VERSION || '26.2';
process.env.RNGMA_WDA_PREBUILT = '1';

type Capability = Record<string, unknown>;

function firstCapability(config: { capabilities?: unknown }): Capability {
  const caps = config.capabilities;
  assert.ok(Array.isArray(caps) && caps.length > 0, 'expected a non-empty capabilities array');
  return caps[0] as Capability;
}

// Regression lock for the stale-app CI failure: CI caches the whole emulator image
// (`~/.android/avd/*`) after the app is installed, so a freshly built APK with an
// unchanged versionCode was skipped and a stale native app ran against fresh Metro JS
// (surfacing as `getSdkVersion() is unavailable`). enforceAppInstall forces a reinstall.
test('android capabilities force a fresh app install', async () => {
  const { config, prepareAndroidApp } = await import('../wdio.android.conf.ts');
  const cap = firstCapability(config);
  assert.equal(cap['appium:enforceAppInstall'], true, 'expected appium:enforceAppInstall to be true');
  // noReset stays false so per-session app data is still reset.
  assert.equal(cap['appium:noReset'], false, 'expected appium:noReset to remain false');
  assert.equal(
    cap['appium:autoLaunch'],
    false,
    'expected app launch only after instrumentation startup',
  );
  assert.equal(typeof config.before, 'function', 'expected a post-session Android launch hook');
  const adbCalls: string[][] = [];
  const startupCalls: Array<{ operation: string; value: unknown }> = [];
  await prepareAndroidApp(
    {
      execute: async (command: string, options: unknown) => {
        startupCalls.push({ operation: command, value: options });
      },
      activateApp: async (packageName: string) => {
        startupCalls.push({ operation: 'activateApp', value: packageName });
      },
    },
    'emulator-5554',
    (bin, args) => {
      adbCalls.push([bin, ...args]);
      return args.at(-1) === '--list'
        ? 'emulator-5554 tcp:8081 tcp:8081\n'
        : '';
    },
  );
  assert.deepEqual(adbCalls, [
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
  assert.equal(startupCalls[0]?.operation, 'mobile: shell');
  assert.deepEqual(
    (startupCalls[0]?.value as { command: string; args: string[] }).args.slice(0, 3),
    ['com.microsoft.reacttestapp', 'mkdir', '-p'],
  );
  assert.equal(
    (startupCalls[0]?.value as { command: string; args: string[] }).args[3],
    'shared_prefs',
  );
  const writeScript =
    (startupCalls[1]?.value as { command: string; args: string[] }).args[3] ?? '';
  const encodedPreferences = /echo ([A-Za-z0-9+/=]+) \|/.exec(writeScript)?.[1];
  assert.ok(encodedPreferences, 'expected base64-encoded preferences write');
  assert.match(Buffer.from(encodedPreferences, 'base64').toString(), /debug_http_host/);
  assert.match(Buffer.from(encodedPreferences, 'base64').toString(), /127\.0\.0\.1:8081/);
  assert.deepEqual(startupCalls[2], {
    operation: 'activateApp',
    value: 'com.microsoft.reacttestapp',
  });
});

test('android startup fails before launch when the post-session reverse is absent', async () => {
  const { prepareAndroidApp } = await import('../wdio.android.conf.ts');
  let appTouched = false;
  await assert.rejects(
    prepareAndroidApp(
      {
        execute: async () => {
          appTouched = true;
        },
        activateApp: async () => {
          appTouched = true;
        },
      },
      'emulator-5554',
      () => '',
    ),
    /did not retain the required tcp:8081 reverse/,
  );
  assert.equal(appTouched, false, 'app launch must not proceed without the reverse');
});

test('ios capabilities force a fresh app install', async () => {
  const { config } = await import('../wdio.ios.conf.ts');
  const cap = firstCapability(config);
  assert.equal(cap['appium:enforceAppInstall'], true, 'expected appium:enforceAppInstall to be true');
  assert.equal(cap['appium:noReset'], false, 'expected appium:noReset to remain false');
});

test('ios timeout ordering lets WDA finish before WDIO gives up', async () => {
  const { config } = await import('../wdio.ios.conf.ts');
  const cap = firstCapability(config);
  assert.equal(cap['appium:wdaLaunchTimeout'], WDA_LAUNCH_TIMEOUT_MS);
  assert.equal(WDA_LAUNCH_TIMEOUT_MS, 300_000);
  assert.equal(config.connectionRetryTimeout, IOS_SESSION_RETRY_TIMEOUT_MS);
  assert.ok(IOS_SESSION_RETRY_TIMEOUT_MS > WDA_LAUNCH_TIMEOUT_MS);
});

test('ios prebuilt capability consumes the shared prebuild output path', async () => {
  const { config } = await import('../wdio.ios.conf.ts');
  const cap = firstCapability(config);
  assert.equal(cap['appium:platformVersion'], process.env.RNGMA_IOS_VERSION);
  assert.equal(cap['appium:usePrebuiltWDA'], true);
  assert.equal(cap['appium:derivedDataPath'], IOS_WDA_DERIVED_DATA_PATH);
});
