import assert from 'node:assert/strict';
import test from 'node:test';

// wdio.ios.conf.ts calls requireIosUdid() at module load; provide a value so this
// device-free import resolves without selecting a real simulator.
process.env.RNGMA_IOS_UDID = process.env.RNGMA_IOS_UDID || 'device-free-udid';

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
  const { config } = await import('../wdio.android.conf.ts');
  const cap = firstCapability(config);
  assert.equal(cap['appium:enforceAppInstall'], true, 'expected appium:enforceAppInstall to be true');
  // noReset stays false so per-session app data is still reset.
  assert.equal(cap['appium:noReset'], false, 'expected appium:noReset to remain false');
});

test('ios capabilities force a fresh app install', async () => {
  const { config } = await import('../wdio.ios.conf.ts');
  const cap = firstCapability(config);
  assert.equal(cap['appium:enforceAppInstall'], true, 'expected appium:enforceAppInstall to be true');
  assert.equal(cap['appium:noReset'], false, 'expected appium:noReset to remain false');
});
