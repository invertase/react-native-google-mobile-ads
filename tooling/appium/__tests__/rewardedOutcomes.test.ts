import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS } from '../src/formats.ts';
import { PUBLIC_API_CONTRACTS } from '../src/contracts.ts';
import {
  assertEarnedRewardLifecycleText,
  EARNED_TRUE_MARKER,
  lifecycleReportsEarnedReward,
  manualImpressionCanaryFromText,
  paidEventCanaryFromLifecycle,
  paidEventCountFromLifecycle,
} from '../src/rewardedOutcomes.ts';
import { AppiumTestIds } from '../src/testIds.ts';

const REQUIRED_EARNED_FORMATS = [
  AppiumTestIds.format.rewarded,
  AppiumTestIds.format.rewardedInterstitial,
  AppiumTestIds.format.rewardedHook,
  AppiumTestIds.format.rewardedInterstitialHook,
] as const;

test('locks requireEarnedReward on official rewarded / rewarded-interstitial flows', () => {
  assert.deepEqual(
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.filter(contract => contract.requireEarnedReward).map(
      contract => contract.id,
    ),
    [...REQUIRED_EARNED_FORMATS],
  );
});

test('locks manualImpressionCanary on the smoke GAM banner only', () => {
  assert.deepEqual(
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.filter(
      contract => contract.manualImpressionCanary,
    ).map(contract => contract.id),
    [AppiumTestIds.gamBannerVariant('AnchoredAdaptiveBanner')],
  );
});

test('earned=true is blocking while paid absence stays non-blocking', () => {
  assert.equal(
    lifecycleReportsEarnedReward(
      'Show lifecycle: closed; earned=true; paid=0',
    ),
    true,
  );
  assert.equal(lifecycleReportsEarnedReward('Show lifecycle: closed; paid=1'), false);
  assert.equal(paidEventCountFromLifecycle('Show lifecycle: closed; paid=2'), 2);
  assert.equal(paidEventCountFromLifecycle('Show lifecycle: closed; earned=true'), undefined);

  assert.doesNotThrow(() =>
    assertEarnedRewardLifecycleText(
      AppiumTestIds.format.rewarded,
      `Hook lifecycle: status=closed; impression=true; clicked=false; ${EARNED_TRUE_MARKER}; paid=0`,
    ),
  );
  assert.throws(
    () =>
      assertEarnedRewardLifecycleText(
        AppiumTestIds.format.rewarded,
        'Show lifecycle: closed; paid=1',
      ),
    /earned-reward-proof/,
  );

  assert.deepEqual(
    paidEventCanaryFromLifecycle(
      AppiumTestIds.format.rewarded,
      'android',
      'Show lifecycle: closed; earned=true',
    ),
    {
      format: AppiumTestIds.format.rewarded,
      platform: 'android',
      paid: 'absent',
      blocking: false,
    },
  );
});

test('manual-impression canary never blocks on missing callback', () => {
  assert.deepEqual(
    manualImpressionCanaryFromText(
      AppiumTestIds.gamBannerVariant('AnchoredAdaptiveBanner'),
      'ios',
      'Manual impression: recorded=true; callback=false',
    ),
    {
      format: AppiumTestIds.gamBannerVariant('AnchoredAdaptiveBanner'),
      platform: 'ios',
      recorded: true,
      callback: false,
      blocking: false,
    },
  );
});

test('public API assertions require earned=true and keep paid non-blocking', () => {
  for (const api of [
    'RewardedAd',
    'RewardedInterstitialAd',
    'useRewardedAd',
    'useRewardedInterstitialAd',
  ] as const) {
    const contract = PUBLIC_API_CONTRACTS.find(candidate => candidate.api === api);
    assert.ok(contract?.disposition === 'e2e-outcome');
    assert.match(contract.assertion, /earned=true/);
    assert.match(contract.assertion, /paid-event/);
    assert.match(contract.assertion, /must not fail/);
  }
  const rewardedEventType = PUBLIC_API_CONTRACTS.find(
    contract => contract.api === 'RewardedAdEventType',
  );
  assert.ok(rewardedEventType && rewardedEventType.disposition !== 'e2e-outcome');
  assert.match(rewardedEventType.reason, /earned=true/);
});

test('gallery and example wire blocking earned and non-blocking canaries', () => {
  const gallerySource = readFileSync(
    new URL('../test/helpers/gallery.ts', import.meta.url),
    'utf8',
  );
  const exampleSource = readFileSync(
    new URL('../../../RNGoogleMobileAdsExample/App.tsx', import.meta.url),
    'utf8',
  );
  const formatsSource = readFileSync(new URL('../src/formats.ts', import.meta.url), 'utf8');

  assert.match(gallerySource, /assertEarnedRewardLifecycleText/);
  assert.match(gallerySource, /\[earned-reward-proof\]/);
  assert.match(gallerySource, /\[paid-event-canary\]/);
  assert.match(gallerySource, /\[manual-impression-canary\]/);
  assert.match(gallerySource, /requireEarnedReward/);
  assert.match(gallerySource, /manualImpressionCanary/);
  assert.match(formatsSource, /requireEarnedReward:\s*true/);
  assert.match(formatsSource, /manualImpressionCanary:\s*true/);

  assert.match(exampleSource, /RewardedAdEventType\.EARNED_REWARD/);
  assert.match(exampleSource, /earned=\$\{/);
  assert.match(exampleSource, /paid=\$\{/);
  assert.match(exampleSource, /Manual impression: recorded=/);
  assert.match(exampleSource, /onAdImpression/);
  assert.match(gallerySource, /dismissFullscreenAdWithoutCreativeTap/);
});
