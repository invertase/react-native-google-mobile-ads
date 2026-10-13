import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  dispositionSummary,
  PUBLIC_API_CONTRACTS,
  type PublicApiContract,
  validatePublicApiContracts,
} from '../src/contracts.ts';
import {
  discoverPublishedAdapters,
  listValueExportsFromSource,
  packageSurfaceSummary,
  PACKAGE_SURFACE_CONTRACTS,
  validatePackageSurfaceContracts,
} from '../src/packageSurfaces.ts';
import {
  EXAMPLE_PROBE_SURFACES,
  derivePublicApiMatrix,
  type PublicApiExport,
} from '../src/publicApiMatrix.ts';
import {
  TYPE_PROOF_DEFERRED,
  typeProofSummary,
  validateTypeProofRegistry,
} from '../src/typeProofRegistry.ts';

const matrix = derivePublicApiMatrix();
const exampleSource = readFileSync(
  new URL('../../../RNGoogleMobileAdsExample/App.tsx', import.meta.url),
  'utf8',
);
const typeTestSources = [
  readFileSync(new URL('../../../packages/core/type-test.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../../../packages/core/type-test.tsx', import.meta.url), 'utf8'),
];

function clonedContracts(): PublicApiContract[] {
  return structuredClone(PUBLIC_API_CONTRACTS) as PublicApiContract[];
}

test('compiler-derived runtime API has exactly one valid disposition', () => {
  assert.deepEqual(validatePublicApiContracts(matrix, PUBLIC_API_CONTRACTS, exampleSource), []);
  const summary = dispositionSummary();
  const absent = PUBLIC_API_CONTRACTS.filter(
    contract => contract.disposition === 'absent-from-example',
  ).map(contract => contract.api);
  const memberCount = matrix.reduce(
    (count, entry) => count + (entry.runtime ? entry.members.length : 0),
    0,
  );
  console.log(
    `[public-api-dispositions] ${JSON.stringify({
      ...summary,
      memberCount,
      absentFromExample: absent,
    })}`,
  );
});

test('MobileAds factory methods are matrix members with dispositions', () => {
  const mobileAds = matrix.find(entry => entry.name === 'MobileAds');
  assert.ok(mobileAds);
  const methodNames = mobileAds.members.map(member => member.name).sort();
  assert.deepEqual(methodNames, [
    'MobileAds.disableMediationAdapterInitialization',
    'MobileAds.disableSdkCrashReporting',
    'MobileAds.getVersion',
    'MobileAds.initialize',
    'MobileAds.openAdInspector',
    'MobileAds.openDebugMenu',
    'MobileAds.registerWebView',
    'MobileAds.setAppMuted',
    'MobileAds.setAppVolume',
    'MobileAds.setAudioSessionIsApplicationManaged',
    'MobileAds.setPublisherFirstPartyIdEnabled',
    'MobileAds.setRequestConfiguration',
    'MobileAds.subscribeToNativeModuleEvent',
  ]);
  assert.equal(methodNames.length, 13);
  for (const api of methodNames) {
    assert.ok(
      PUBLIC_API_CONTRACTS.some(contract => contract.api === api),
      `missing disposition for ${api}`,
    );
  }
});

test('ad-class and component significant members require dispositions', () => {
  for (const api of [
    'InterstitialAd.load',
    'InterstitialAd.show',
    'NativeAd.createForAdRequest',
    'BannerAd.onAdLoaded',
    'GAMBannerAd.recordManualImpression',
    'NativeAdView.nativeAd',
    'AdPoolProvider.pools',
  ]) {
    assert.ok(
      PUBLIC_API_CONTRACTS.some(contract => contract.api === api),
      `missing disposition for ${api}`,
    );
  }
});

test('type-only exports are compiler-classified and need no Appium disposition', () => {
  const typeOnly = matrix.filter(entry => !entry.runtime);
  assert.ok(typeOnly.length > 0);
  assert.ok(typeOnly.every(entry => entry.kind === 'type-only'));
  assert.ok(typeOnly.every(entry => entry.partition === 'product'));
  assert.ok(
    typeOnly.every(entry => !PUBLIC_API_CONTRACTS.some(contract => contract.api === entry.name)),
  );
});

test('type-proof registry is fail-closed for hooks, components, and type-only exports', () => {
  assert.deepEqual(validateTypeProofRegistry(matrix, typeTestSources), []);
  const summary = typeProofSummary(matrix, typeTestSources);
  assert.ok(summary.covered > 0);
  assert.ok(summary.deferred > 0);
  assert.ok(Object.keys(TYPE_PROOF_DEFERRED).length === summary.deferred);
  console.log(`[type-proof] ${JSON.stringify(summary)}`);
});

test('scoped adapter and plugin package surfaces are dispositioned', () => {
  assert.deepEqual(validatePackageSurfaceContracts(), []);
  const adapters = discoverPublishedAdapters();
  const summary = packageSurfaceSummary();
  // core plugin + js/plugin per published adapter (roster derived from packages tree)
  assert.equal(PACKAGE_SURFACE_CONTRACTS.length, 1 + adapters.length * 2);
  assert.ok(adapters.length >= 9);
  assert.ok(summary['jest-owned'] >= 11);
  assert.ok(summary['plugin-fixture-pending'] >= 8);

  const facebookPlugin = PACKAGE_SURFACE_CONTRACTS.find(
    contract => contract.id === '@react-native-google-mobile-ads/facebook#plugin',
  );
  assert.deepEqual(facebookPlugin?.members, [
    'default',
    'KNOWN_PLUGIN_PARAMETER_KEYS',
    'warnUnknownPluginParameters',
  ]);
  const applovinPlugin = PACKAGE_SURFACE_CONTRACTS.find(
    contract => contract.id === '@react-native-google-mobile-ads/applovin#plugin',
  );
  assert.deepEqual(applovinPlugin?.members, ['default']);
  const corePlugin = PACKAGE_SURFACE_CONTRACTS.find(
    contract => contract.id === 'react-native-google-mobile-ads#plugin',
  );
  assert.deepEqual(corePlugin?.members, [
    'default',
    'KNOWN_PLUGIN_PARAMETER_KEYS',
    'setAndroidSdkGradleProperties',
    'warnUnknownPluginParameters',
    'withAndroidSdk',
  ]);

  // Fail-closed: a published adapter without a contract row must error.
  const withoutFacebook = PACKAGE_SURFACE_CONTRACTS.filter(
    contract => !contract.id.startsWith('@react-native-google-mobile-ads/facebook#'),
  );
  assert.ok(
    validatePackageSurfaceContracts(withoutFacebook).some(error =>
      error.includes('@react-native-google-mobile-ads/facebook#js'),
    ),
  );

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  assert.deepEqual(
    listValueExportsFromSource(
      path.join(repoRoot, 'packages/applovin/plugin/src/index.ts'),
    ),
    ['default'],
  );
  console.log(
    `[package-surfaces] ${JSON.stringify({ ...summary, adapterCount: adapters.length })}`,
  );
});

test('example-only probes stay outside the product API matrix and contracts', () => {
  for (const probe of EXAMPLE_PROBE_SURFACES) {
    assert.equal(probe.partition, 'example-probe');
    assert.ok(
      !matrix.some(
        entry =>
          entry.name === probe.id || entry.members.some(member => member.name === probe.id),
      ),
      `${probe.id} must not appear in the product matrix`,
    );
    assert.ok(
      !PUBLIC_API_CONTRACTS.some(contract => contract.api === probe.id),
      `${probe.id} must not appear in product Appium dispositions`,
    );
  }
});

test('a newly runtime public export fails until dispositioned', () => {
  const typeOnly = matrix.find(entry => !entry.runtime);
  assert.ok(typeOnly);
  const changed: PublicApiExport[] = matrix.map(entry =>
    entry === typeOnly ? { ...entry, runtime: true, kind: 'function' } : entry,
  );
  assert.ok(
    validatePublicApiContracts(changed, PUBLIC_API_CONTRACTS, exampleSource).includes(
      `runtime public API ${typeOnly.name} has no disposition`,
    ),
  );
});

test('a removed export or member leaves a failing stale disposition', () => {
  const withoutExport = matrix.filter(entry => entry.name !== 'BannerAd');
  const withoutMember = matrix.map(entry =>
    entry.name === 'AdPools'
      ? { ...entry, members: entry.members.filter(member => member.name !== 'AdPools.create') }
      : entry,
  );
  const withoutMobileAdsMethod = matrix.map(entry =>
    entry.name === 'MobileAds'
      ? {
          ...entry,
          members: entry.members.filter(member => member.name !== 'MobileAds.initialize'),
        }
      : entry,
  );
  for (const [changed, api] of [
    [withoutExport, 'BannerAd'],
    [withoutMember, 'AdPools.create'],
    [withoutMobileAdsMethod, 'MobileAds.initialize'],
  ] as const) {
    assert.ok(
      validatePublicApiContracts(changed, PUBLIC_API_CONTRACTS, exampleSource).includes(
        `registry references missing runtime API ${api}`,
      ),
    );
  }
});

test('compiler-versus-registry classification drift fails', () => {
  const contracts = clonedContracts();
  const banner = contracts.find(contract => contract.api === 'BannerAd');
  assert.ok(banner);
  banner.kind = 'class';
  assert.ok(
    validatePublicApiContracts(matrix, contracts, exampleSource).some(error =>
      error.startsWith('classification drift for BannerAd:'),
    ),
  );
});

test('empty and presence-only outcome assertions fail', () => {
  for (const assertion of ['', 'The element is present']) {
    const contracts = clonedContracts();
    const banner = contracts.find(contract => contract.api === 'BannerAd');
    assert.ok(banner?.disposition === 'e2e-outcome');
    banner.assertion = assertion;
    assert.ok(
      validatePublicApiContracts(matrix, contracts, exampleSource).some(error =>
        error.includes(`e2e-outcome BannerAd has`),
      ),
    );
  }
});

test('missing example screens and testIDs fail', () => {
  for (const change of [
    { exampleComponent: 'MissingFormat' },
    { assertionTestId: 'gma.missing.assertion' },
    { assertionTestIdExpression: "AppiumTestIds.action.loaded('missing')" },
  ]) {
    const contracts = clonedContracts();
    const banner = contracts.find(contract => contract.api === 'BannerAd');
    assert.ok(banner?.disposition === 'e2e-outcome');
    Object.assign(banner, change);
    assert.ok(
      validatePublicApiContracts(matrix, contracts, exampleSource).some(error =>
        error.includes('e2e-outcome BannerAd references missing'),
      ),
    );
  }
});

test('generic reasons fail for both reason-gated categories', () => {
  for (const api of ['AdEventType', 'SDK_VERSION']) {
    const contracts = clonedContracts();
    const contract = contracts.find(candidate => candidate.api === api);
    assert.ok(contract && contract.disposition !== 'e2e-outcome');
    contract.reason = 'Hard to test';
    assert.ok(
      validatePublicApiContracts(matrix, contracts, exampleSource).some(error =>
        error.includes(`${contract.disposition} ${api} has a missing or non-specific reason`),
      ),
    );
  }
});

test('consent and UMP exports remain explicitly parked', () => {
  const derivedConsentApis = matrix
    .filter(entry => entry.runtime && entry.name.startsWith('AdsConsent'))
    .flatMap(entry => [entry.name, ...entry.members.map(member => member.name)])
    .sort();
  const consent = PUBLIC_API_CONTRACTS.filter(
    contract => contract.api === 'AdsConsent' || contract.api.startsWith('AdsConsent'),
  );
  assert.deepEqual(
    consent.map(contract => contract.api).sort(),
    derivedConsentApis,
  );
  assert.ok(consent.every(contract => contract.disposition === 'not-appium-capable'));
  assert.ok(
    consent.every(
      contract =>
        contract.disposition !== 'e2e-outcome' &&
        contract.reason.includes('parked by explicit maintainer decision'),
    ),
  );
});

test('undispositioned MobileAds method fails closed', () => {
  const contracts = PUBLIC_API_CONTRACTS.filter(
    contract => contract.api !== 'MobileAds.initialize',
  );
  assert.ok(
    validatePublicApiContracts(matrix, contracts, exampleSource).includes(
      'runtime public API MobileAds.initialize has no disposition',
    ),
  );
});
