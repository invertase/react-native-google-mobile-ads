'use strict';

/**
 * Refresh the example iOS CocoaPods lockfile so release commits keep
 * RNGoogleMobileAdsExample/ios/Podfile.lock aligned with packages/core
 * (pod version + sdkVersions.ios pins). Mirrors the Darwin path in RNFB
 * scripts/version.js, adapted for semantic-release.
 *
 * Usage:
 *   node ./scripts/refresh-ios-pod-lockfile.js
 *   node ./scripts/refresh-ios-pod-lockfile.js --assert-pins-only
 *   node ./scripts/refresh-ios-pod-lockfile.js --self-check
 *   yarn release:refresh-ios-pod-lockfile
 */

const { execSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'packages/core/package.json');
const PODFILE_LOCK_PATH = path.join(REPO_ROOT, 'RNGoogleMobileAdsExample/ios/Podfile.lock');
const POD_LOCKFILE_RELATIVE = 'RNGoogleMobileAdsExample/ios/Podfile.lock';

function readCorePackage(packageJsonPath = PACKAGE_JSON_PATH) {
  return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
}

function extractLockedPodVersion(lockfileContents, podName) {
  // Top-level PODS entries use exactly two spaces before `-` (nested deps use four+).
  const escaped = podName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = lockfileContents.match(new RegExp(`^  - ${escaped} \\(([^)]+)\\)`, 'm'));
  return match ? match[1] : undefined;
}

function assertPinsMatch(packageJson, lockfileContents) {
  const expectedPackageVersion = packageJson.version;
  const expectedGma = packageJson.sdkVersions && packageJson.sdkVersions.ios.googleMobileAds;
  const expectedUmp = packageJson.sdkVersions && packageJson.sdkVersions.ios.googleUmp;

  if (!expectedPackageVersion || !expectedGma || !expectedUmp) {
    throw new Error(
      'packages/core/package.json missing version or sdkVersions.ios.googleMobileAds/googleUmp',
    );
  }

  const lockedPackage = extractLockedPodVersion(lockfileContents, 'RNGoogleMobileAds');
  const lockedGma = extractLockedPodVersion(lockfileContents, 'Google-Mobile-Ads-SDK');
  const lockedUmp = extractLockedPodVersion(lockfileContents, 'GoogleUserMessagingPlatform');

  const mismatches = [];
  if (lockedPackage !== expectedPackageVersion) {
    mismatches.push(
      `RNGoogleMobileAds lock=${lockedPackage} package.json=${expectedPackageVersion}`,
    );
  }
  if (lockedGma !== expectedGma) {
    mismatches.push(
      `Google-Mobile-Ads-SDK lock=${lockedGma} sdkVersions.ios.googleMobileAds=${expectedGma}`,
    );
  }
  if (lockedUmp !== expectedUmp) {
    mismatches.push(
      `GoogleUserMessagingPlatform lock=${lockedUmp} sdkVersions.ios.googleUmp=${expectedUmp}`,
    );
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Podfile.lock pins out of sync with packages/core:\n- ${mismatches.join('\n- ')}`,
    );
  }

  return {
    packageVersion: expectedPackageVersion,
    googleMobileAds: expectedGma,
    googleUmp: expectedUmp,
  };
}

function assertCurrentPins() {
  if (!existsSync(PACKAGE_JSON_PATH)) {
    throw new Error(`missing ${PACKAGE_JSON_PATH}`);
  }
  if (!existsSync(PODFILE_LOCK_PATH)) {
    throw new Error(`missing ${PODFILE_LOCK_PATH}`);
  }
  return assertPinsMatch(readCorePackage(), readFileSync(PODFILE_LOCK_PATH, 'utf8'));
}

function runPodInstall() {
  execSync('yarn tests:ios:pod:install', { cwd: REPO_ROOT, stdio: 'inherit' });
}

function stageAndVerifyIdempotent() {
  execSync(`git add -- ${POD_LOCKFILE_RELATIVE}`, { cwd: REPO_ROOT, stdio: 'inherit' });
  runPodInstall();
  execSync(`git diff --exit-code -- ${POD_LOCKFILE_RELATIVE}`, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
}

function refreshIosPodLockfile(options = {}) {
  const { requireDarwin = true } = options;

  if (requireDarwin && process.platform !== 'darwin') {
    throw new Error(
      'refresh-ios-pod-lockfile requires Darwin (CocoaPods). Publish CI must run on macOS.',
    );
  }

  console.log('Refreshing example iOS Podfile.lock via yarn tests:ios:pod:install…');
  runPodInstall();
  const pins = assertCurrentPins();
  console.log(
    `Pins OK after refresh: RNGoogleMobileAds=${pins.packageVersion} GMA=${pins.googleMobileAds} UMP=${pins.googleUmp}`,
  );

  // Second install verifies the staged lockfile is idempotent (RNFB #9208 pattern).
  stageAndVerifyIdempotent();
  console.log(`Idempotent: ${POD_LOCKFILE_RELATIVE}`);
  return pins;
}

function selfCheck() {
  const sampleLock = `
PODS:
  - Google-Mobile-Ads-SDK (13.5.0):
    - GoogleUserMessagingPlatform (>= 1.1)
  - GoogleUserMessagingPlatform (3.1.0)
  - RNGoogleMobileAds (16.5.0):
`;
  const okPkg = {
    version: '16.5.0',
    sdkVersions: { ios: { googleMobileAds: '13.5.0', googleUmp: '3.1.0' } },
  };
  const badPkg = {
    version: '16.5.0',
    sdkVersions: { ios: { googleMobileAds: '13.1.0', googleUmp: '3.1.0' } },
  };

  assertPinsMatch(okPkg, sampleLock);
  let rejected = false;
  try {
    assertPinsMatch(badPkg, sampleLock);
  } catch (error) {
    rejected = /Google-Mobile-Ads-SDK/.test(String(error && error.message));
  }
  if (!rejected) {
    throw new Error('self-check failed: drifted GMA pin must reject');
  }

  if (extractLockedPodVersion(sampleLock, 'RNGoogleMobileAds') !== '16.5.0') {
    throw new Error('self-check failed: RNGoogleMobileAds extract');
  }

  console.log('refresh-ios-pod-lockfile self-check: ok');
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-check')) {
    selfCheck();
    return;
  }
  if (argv.includes('--assert-pins-only')) {
    const pins = assertCurrentPins();
    console.log(
      `Pins OK: RNGoogleMobileAds=${pins.packageVersion} GMA=${pins.googleMobileAds} UMP=${pins.googleUmp}`,
    );
    return;
  }
  refreshIosPodLockfile();
}

module.exports = {
  POD_LOCKFILE_RELATIVE,
  assertPinsMatch,
  assertCurrentPins,
  extractLockedPodVersion,
  refreshIosPodLockfile,
  selfCheck,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  }
}
