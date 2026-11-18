import assert from 'node:assert/strict';
import test from 'node:test';
import {
  androidNextgenShowCloseClosedAccepted,
  ANDROID_SHOW_LIFECYCLE_CLOSED,
  isAndroidFullscreenChromeClear,
  isAndroidNextgenE2eBackend,
} from '../src/androidShowCloseClosed.ts';

const clearChrome = {
  adActivity: false,
  testAdObstructing: false,
  interstitialCloseChrome: false,
};

test('isAndroidNextgenE2eBackend recognizes nextgen env', () => {
  assert.equal(isAndroidNextgenE2eBackend({ RNGMA_ANDROID_BACKEND: 'nextgen' }), true);
  assert.equal(isAndroidNextgenE2eBackend({ RNGMA_ANDROID_BACKEND: 'classic' }), false);
  assert.equal(isAndroidNextgenE2eBackend({}), false);
});

test('androidNextgenShowCloseClosedAccepted honors lifecycle text on any backend', () => {
  assert.equal(
    androidNextgenShowCloseClosedAccepted({
      phase: `prefix ${ANDROID_SHOW_LIFECYCLE_CLOSED}`,
      chrome: { adActivity: true, testAdObstructing: true, interstitialCloseChrome: true },
      exampleAppForeground: false,
      showActionEnabled: false,
      consecutiveChromeClearPolls: 0,
    }),
    true,
  );
});

test('androidNextgenShowCloseClosedAccepted requires chrome, foreground, and show enabled', () => {
  const base = {
    phase: '',
    chrome: clearChrome,
    exampleAppForeground: true,
    showActionEnabled: true,
    consecutiveChromeClearPolls: 3,
  };
  assert.equal(androidNextgenShowCloseClosedAccepted(base), true);
  assert.equal(
    androidNextgenShowCloseClosedAccepted({ ...base, consecutiveChromeClearPolls: 2 }),
    false,
  );
  assert.equal(
    androidNextgenShowCloseClosedAccepted({
      ...base,
      chrome: { ...clearChrome, interstitialCloseChrome: true },
    }),
    false,
  );
  assert.equal(
    androidNextgenShowCloseClosedAccepted({ ...base, exampleAppForeground: false }),
    false,
  );
  assert.equal(
    androidNextgenShowCloseClosedAccepted({ ...base, showActionEnabled: false }),
    false,
  );
});

test('isAndroidFullscreenChromeClear is false when any chrome flag is set', () => {
  assert.equal(isAndroidFullscreenChromeClear(clearChrome), true);
  assert.equal(
    isAndroidFullscreenChromeClear({ ...clearChrome, adActivity: true }),
    false,
  );
});