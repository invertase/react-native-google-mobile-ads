import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { iosAppBundleResolution } from '../src/formats.ts';
import {
  findCompleteIosAppBundle,
  isCompleteIosAppBundle,
  MIN_ANDROID_API,
  MIN_NODE_MAJOR,
  nodeMajor,
  nodeMeetsMinimum,
  parseAvdApi,
  PREFERRED_ANDROID_API,
  resolveIosAppBundle,
  selectConnectedAndroidDevice,
  selectAndroidAvd,
} from '../src/hostPreflight.ts';

describe('hostPreflight', () => {
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
