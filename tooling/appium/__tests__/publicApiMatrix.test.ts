import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  dispositionSummary,
  PUBLIC_API_CONTRACTS,
  type PublicApiContract,
  validatePublicApiContracts,
} from '../src/contracts.ts';
import {
  derivePublicApiMatrix,
  type PublicApiExport,
} from '../src/publicApiMatrix.ts';

const matrix = derivePublicApiMatrix();
const exampleSource = readFileSync(
  new URL('../../../RNGoogleMobileAdsExample/App.tsx', import.meta.url),
  'utf8',
);

function clonedContracts(): PublicApiContract[] {
  return structuredClone(PUBLIC_API_CONTRACTS) as PublicApiContract[];
}

test('compiler-derived runtime API has exactly one valid disposition', () => {
  assert.deepEqual(validatePublicApiContracts(matrix, PUBLIC_API_CONTRACTS, exampleSource), []);
  const summary = dispositionSummary();
  const absent = PUBLIC_API_CONTRACTS.filter(
    contract => contract.disposition === 'absent-from-example',
  ).map(contract => contract.api);
  console.log(
    `[public-api-dispositions] ${JSON.stringify({ ...summary, absentFromExample: absent })}`,
  );
});

test('type-only exports are compiler-classified and need no hand-written disposition', () => {
  const typeOnly = matrix.filter(entry => !entry.runtime);
  assert.ok(typeOnly.length > 0);
  assert.ok(typeOnly.every(entry => entry.kind === 'type-only'));
  assert.ok(typeOnly.every(entry => !PUBLIC_API_CONTRACTS.some(contract => contract.api === entry.name)));
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
  for (const [changed, api] of [
    [withoutExport, 'BannerAd'],
    [withoutMember, 'AdPools.create'],
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
