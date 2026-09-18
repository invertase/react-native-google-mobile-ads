import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NAVIGATION_SMOKE_PRIMARY,
  NAVIGATION_SMOKE_SECONDARY,
  NAVIGATION_SMOKE_TERTIARY,
  REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS,
  SMOKE_BANNER_VARIANT,
} from '../src/formats.ts';
import {
  acceptRepresentativeRequestOutcome,
  REQUEST_OUTCOME_LOADED,
  REQUEST_OUTCOME_NO_FILL,
} from '../src/requestOutcomes.ts';
import { AppiumTestIds } from '../src/testIds.ts';

test('locks one representative request-outcome contract per required path', () => {
  assert.deepEqual(
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.map(contract => [contract.path, contract.id]),
    [
      ['banner', SMOKE_BANNER_VARIANT],
      ['native', AppiumTestIds.format.native],
      ['fullscreen', AppiumTestIds.format.interstitial],
      ['gam', AppiumTestIds.format.gamInterstitial],
    ],
  );
  assert.ok(
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.every(
      contract => contract.contract === 'request-outcome',
    ),
  );
});

test('representative request-outcome contracts never invoke Show actions', () => {
  for (const contract of REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS) {
    assert.notEqual(contract.actionId, AppiumTestIds.action.show(contract.id));
    if (contract.actionId) {
      assert.equal(contract.actionId, AppiumTestIds.action.load(contract.id));
    }
  }
});

test('loaded request outcomes pass without warning', () => {
  const warnings: string[] = [];
  assert.equal(
    acceptRepresentativeRequestOutcome('gma.format.example', REQUEST_OUTCOME_LOADED, warning =>
      warnings.push(warning),
    ),
    true,
  );
  assert.deepEqual(warnings, []);
});

test('SDK no-fill passes through the explicit warning path', () => {
  const warnings: string[] = [];
  assert.equal(
    acceptRepresentativeRequestOutcome('gma.format.example', REQUEST_OUTCOME_NO_FILL, warning =>
      warnings.push(warning),
    ),
    true,
  );
  assert.deepEqual(warnings, ['[request-outcome] gma.format.example: SDK no-fill accepted']);
});

test('non-no-fill SDK errors fail immediately with details', () => {
  assert.throws(
    () =>
      acceptRepresentativeRequestOutcome(
        'gma.format.example',
        'Request error: network-error: offline',
      ),
    /gma\.format\.example.*network-error: offline/,
  );
});

test('non-terminal request outcomes keep waiting instead of passing', () => {
  for (const text of ['Request outcome: pending', 'Loaded? false', '']) {
    assert.equal(acceptRepresentativeRequestOutcome('gma.format.example', text), false);
  }
});

test('broad format coverage remains navigation/container-only', () => {
  const navigationCases = [
    ...NAVIGATION_SMOKE_PRIMARY,
    ...NAVIGATION_SMOKE_SECONDARY,
    ...NAVIGATION_SMOKE_TERTIARY,
  ];
  assert.equal(navigationCases.length, 17);
  assert.ok(navigationCases.every(contract => contract.contract === 'navigation'));
  assert.ok(navigationCases.every(contract => !contract.requiresAppRestart));
});
