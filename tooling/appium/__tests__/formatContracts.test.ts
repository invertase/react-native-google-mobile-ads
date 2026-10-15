import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  NAVIGATION_SMOKE_CASES,
  NATIVE_RNGMA_TESTING_PROBE,
  REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS,
  SMOKE_BANNER_VARIANT,
  SMOKE_GAM_BANNER_VARIANT,
} from '../src/formats.ts';
import {
  classifyHookLoadOutcome,
  classifyPoolFilledOutcome,
  classifyPoolStructuredUnsupportedGate,
  classifyRequestOutcome,
  evaluateRepresentativeRequestAttempt,
  formatRepresentativeRequestTimeoutMsg,
  acceptedAdUnitAgeMs,
  formatRequestOutcomeAttempt,
  formatRequestOutcomeTimeout,
  googleTestAdUnitForFormat,
  hasNonzeroRectangle,
  isRepresentativeRequestWaitTimeout,
  nativeFingerprintFromAndroidLog,
  pendingTimeoutClassification,
  noteAcceptedAdUnit,
  representativeRequestBackoffMs,
  representativeRequestOperation,
  requestIdFromText,
  requestOutcomeConfiguration,
  resetAcceptedAdUnitMemory,
  runRepresentativeRequestOutcomeContract,
  sharedAdUnitCooldownRemainingMs,
  terminalOutcomeFromMarkerText,
  truncateLogSnippet,
  REPRESENTATIVE_REQUEST_MAX_ATTEMPTS,
  REPRESENTATIVE_REQUEST_RECENT_NOFILL_BASE_BACKOFF_MS,
  REPRESENTATIVE_REQUEST_RECENT_NOFILL_MAX_BACKOFF_MS,
  REPRESENTATIVE_REQUEST_TIMEOUT_LAST_SEEN_DEFERRED,
  REQUEST_OUTCOME_LOADED,
  REQUEST_OUTCOME_LOG_SHARED_COOLDOWN_PREFIX,
  REQUEST_OUTCOME_NO_FILL,
  REQUEST_OUTCOME_TIMEOUT_LOG_PREFIX,
  SHARED_AD_UNIT_PRE_FORMAT_COOLDOWN_MS,
  type RequestOutcomeClassification,
  type RepresentativeRequestPath,
} from '../src/requestOutcomes.ts';
import { AppiumTestIds } from '../src/testIds.ts';

test.beforeEach(() => {
  resetAcceptedAdUnitMemory();
});

const NOT_APPLICABLE_FINGERPRINT = {
  status: 'not-applicable' as const,
  evidence: 'not-native-internal-error',
};

function observedRequest(
  requestId: number,
  classification: RequestOutcomeClassification = 'other-error',
  fingerprint = NOT_APPLICABLE_FINGERPRINT,
) {
  return {
    requestId,
    classification,
    detail: `request ${requestId}`,
    fingerprint,
  };
}

function runtimeRecorder(
  calls: string[],
  observations: ReturnType<typeof observedRequest>[],
) {
  return {
    navigate: async () => {
      calls.push('navigate');
    },
    backToGallery: async () => {
      calls.push('back');
    },
    clearNativeLogs: async () => {
      calls.push('clear-logs');
    },
    reload: async () => {
      calls.push('reload');
    },
    load: async () => {
      calls.push('load');
    },
    observe: async (uiAttempt: number) => {
      calls.push(`observe:${uiAttempt}`);
      const observation = observations.shift();
      if (!observation) {
        throw new Error('missing fake observation');
      }
      return observation;
    },
  };
}

test('locks representative request-outcome contracts for classic ad success paths', () => {
  assert.ok(
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.every(
      contract => contract.contract === 'request-outcome',
    ),
  );
  assert.deepEqual(
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.map(contract => contract.id),
    [
      SMOKE_BANNER_VARIANT,
      AppiumTestIds.format.collapsibleBanner,
      SMOKE_GAM_BANNER_VARIANT,
      AppiumTestIds.format.native,
      AppiumTestIds.format.appOpen,
      AppiumTestIds.format.interstitial,
      AppiumTestIds.format.rewarded,
      AppiumTestIds.format.rewardedInterstitial,
      AppiumTestIds.format.gamInterstitial,
      AppiumTestIds.format.appOpenHook,
      AppiumTestIds.format.interstitialHook,
      AppiumTestIds.format.rewardedHook,
      AppiumTestIds.format.rewardedInterstitialHook,
      AppiumTestIds.format.poolInterstitialProvider,
      AppiumTestIds.format.poolInterstitialImperative,
      AppiumTestIds.format.poolCapabilityGates,
      AppiumTestIds.format.poolRwiPreloadGate,
      AppiumTestIds.format.multiFormatRequest,
      AppiumTestIds.format.multiFormatHook,
    ],
  );
  assert.deepEqual(
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.filter(contract => contract.showClose).map(
      contract => contract.id,
    ),
    [
      AppiumTestIds.format.appOpen,
      AppiumTestIds.format.interstitial,
      AppiumTestIds.format.rewarded,
      AppiumTestIds.format.rewardedInterstitial,
      AppiumTestIds.format.gamInterstitial,
    ],
  );
  assert.deepEqual(
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.filter(contract => contract.hookLifecycle).map(
      contract => contract.id,
    ),
    [
      AppiumTestIds.format.appOpenHook,
      AppiumTestIds.format.interstitialHook,
      AppiumTestIds.format.rewardedHook,
      AppiumTestIds.format.rewardedInterstitialHook,
    ],
  );
  assert.deepEqual(
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.filter(contract => contract.poolShowClose).map(
      contract => contract.id,
    ),
    [
      AppiumTestIds.format.poolInterstitialProvider,
      AppiumTestIds.format.poolInterstitialImperative,
    ],
  );
  assert.deepEqual(
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.filter(
      contract => contract.retry === 'remount' && contract.observeTimeoutMs === 20_000,
    ).map(contract => contract.id),
    [AppiumTestIds.format.appOpen, AppiumTestIds.format.appOpenHook],
  );
  for (const id of [AppiumTestIds.format.appOpen, AppiumTestIds.format.appOpenHook]) {
    const contract = REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.find(c => c.id === id);
    assert.ok(contract);
    assert.equal(contract.retry, 'remount');
    assert.equal(contract.observeTimeoutMs, 20_000);
  }
});

test('representative load actions never alias Show controls', () => {
  for (const contract of REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS) {
    if (!contract.actionId) {
      continue;
    }
    assert.notEqual(contract.actionId, AppiumTestIds.action.show(contract.id));
    assert.equal(contract.actionId, AppiumTestIds.action.load(contract.id));
  }
});

test('locks the acceptance matrix for every format path and platform', () => {
  const paths = ['banner', 'native', 'fullscreen', 'gam'] as const;
  const platforms = ['android', 'ios'] as const;
  const classifications: RequestOutcomeClassification[] = [
    'loaded',
    'no-fill',
    'internal-error',
    'other-error',
    'pending-timeout',
  ];
  for (const path of paths) {
    for (const platform of platforms) {
      for (const classification of classifications) {
        for (const fingerprintStatus of [
          'matched',
          'not-matched',
          'unavailable',
          'not-applicable',
        ] as const) {
          const result = evaluateRepresentativeRequestAttempt({
            path,
            platform,
            attempt: {
              classification,
              fingerprint: { status: fingerprintStatus, evidence: 'matrix' },
            },
          });
          const accepted =
            classification === 'loaded' ||
            ((path === 'native' || path === 'multi-format') &&
              platform === 'android' &&
              classification === 'internal-error' &&
              fingerprintStatus === 'matched');
          assert.equal(result.status, accepted ? 'accepted' : 'retry');
        }
      }
    }
  }
});

test('render rectangle proof rejects zero dimensions', () => {
  assert.equal(hasNonzeroRectangle({ width: 320, height: 50 }), true);
  assert.equal(hasNonzeroRectangle({ width: 0, height: 50 }), false);
  assert.equal(hasNonzeroRectangle({ width: 320, height: 0 }), false);
});

test('classifies terminal pooled fill markers from pool status text', () => {
  assert.equal(
    classifyPoolFilledOutcome('poolStatus=ready; pooledStatus=filled; available=true'),
    'loaded',
  );
  assert.equal(
    classifyPoolStructuredUnsupportedGate(
      'peek=structured-unsupported reason=pool/peek-unsupported',
      'peek',
    ),
    'loaded',
  );
  assert.equal(
    classifyPoolStructuredUnsupportedGate(
      'rwi=structured-unsupported reason=pool/format-preload-unsupported',
      'rwi-preload',
    ),
    'loaded',
  );
});

test('classifies terminal hook load markers from hook status text', () => {
  assert.equal(classifyHookLoadOutcome('Status: loaded'), 'loaded');
  assert.equal(classifyHookLoadOutcome('Status: no-fill'), 'no-fill');
  assert.equal(classifyHookLoadOutcome('Status: error'), 'other-error');
  assert.equal(classifyHookLoadOutcome('Status: loading'), undefined);
});

test('classifies terminal outcomes and leaves non-terminal markers unclassified', () => {
  assert.equal(classifyRequestOutcome(REQUEST_OUTCOME_LOADED), 'loaded');
  assert.equal(classifyRequestOutcome(REQUEST_OUTCOME_NO_FILL), 'no-fill');
  assert.equal(
    classifyRequestOutcome(
      'Request error: internal-error: <Google:HTML> Incorrect native ad response.',
    ),
    'internal-error',
  );
  assert.equal(
    classifyRequestOutcome('Request error: network-error: offline'),
    'other-error',
  );
  assert.equal(classifyRequestOutcome('Request outcome: pending'), undefined);
  assert.equal(classifyRequestOutcome(''), undefined);
});

test('defers lastSeen into the representative request timeout message', () => {
  const pending =
    'Request id: 4; Request attempt: 1; Request outcome: pending';
  assert.equal(
    formatRepresentativeRequestTimeoutMsg({
      testId: 'gma.format.gam-banner.AnchoredAdaptiveBanner.loaded',
      attempt: 1,
      lastSeen: pending,
    }),
    'testID gma.format.gam-banner.AnchoredAdaptiveBanner.loaded did not report terminal request attempt 1 (lastSeen="Request id: 4; Request attempt: 1; Request outcome: pending")',
  );
  assert.ok(
    !formatRepresentativeRequestTimeoutMsg({
      testId: 'x',
      attempt: 1,
      lastSeen: pending,
    }).includes('lastSeen=""'),
  );
});

test('formats request-outcome-timeout JSON for CI correlation', () => {
  const line = formatRequestOutcomeTimeout({
    format: 'gma.format.gam-banner.AnchoredAdaptiveBanner',
    requestId: 4,
    lastSeen: 'Request id: 4; Request attempt: 1; Request outcome: pending',
    elapsedMs: 10012,
    adsLogSnippet: 'Ads: This request is sent from a test device',
  });
  assert.ok(line.startsWith(`${REQUEST_OUTCOME_TIMEOUT_LOG_PREFIX} {`));
  assert.deepEqual(JSON.parse(line.slice(REQUEST_OUTCOME_TIMEOUT_LOG_PREFIX.length + 1)), {
    format: 'gma.format.gam-banner.AnchoredAdaptiveBanner',
    requestId: 4,
    lastSeen: 'Request id: 4; Request attempt: 1; Request outcome: pending',
    elapsedMs: 10012,
    adsLogSnippet: 'Ads: This request is sent from a test device',
  });
  assert.equal(truncateLogSnippet('abcdefghij', 4), 'ghij');
});

test('pending-timeout classification is remountable only for remount contracts', () => {
  const pending =
    'Request id: 4; Request attempt: 1; Request outcome: pending';
  assert.equal(
    pendingTimeoutClassification({ lastSeen: pending, retry: 'remount' }),
    'pending-timeout',
  );
  assert.equal(
    pendingTimeoutClassification({ lastSeen: pending, retry: 'default' }),
    undefined,
  );
  assert.equal(
    pendingTimeoutClassification({
      lastSeen: REQUEST_OUTCOME_LOADED,
      retry: 'remount',
    }),
    undefined,
  );
  assert.equal(
    pendingTimeoutClassification({
      lastSeen: 'Request attempt: 1; Request outcome: pending',
      retry: 'remount',
    }),
    undefined,
  );
  assert.deepEqual(
    evaluateRepresentativeRequestAttempt({
      path: 'gam',
      platform: 'android',
      attempt: {
        classification: 'pending-timeout',
        fingerprint: { status: 'not-applicable', evidence: 'pending-timeout' },
      },
    }),
    { status: 'retry', reason: 'outcome-not-accepted' },
  );
});

test('only deferred waitUntil timeouts qualify as remountable pending-timeout waits', () => {
  assert.equal(
    isRepresentativeRequestWaitTimeout(
      new Error(
        formatRepresentativeRequestTimeoutMsg({
          testId: 'gma.format.gam-banner.AnchoredAdaptiveBanner.loaded',
          attempt: 1,
          lastSeen: REPRESENTATIVE_REQUEST_TIMEOUT_LAST_SEEN_DEFERRED,
        }),
      ),
    ),
    true,
  );
  assert.equal(
    isRepresentativeRequestWaitTimeout(
      new Error(
        'waitUntil condition failed with the following reason: [request-outcome] x: marker x disappeared',
      ),
    ),
    false,
  );
  assert.equal(
    isRepresentativeRequestWaitTimeout(
      new Error('[request-outcome] x: wait completed without a terminal outcome'),
    ),
    false,
  );
  assert.equal(
    isRepresentativeRequestWaitTimeout(
      new Error(
        formatRepresentativeRequestTimeoutMsg({
          testId: 'gma.format.gam-banner.AnchoredAdaptiveBanner.loaded',
          attempt: 1,
          lastSeen: 'Request id: 4; Request attempt: 1; Request outcome: pending',
        }),
      ),
    ),
    false,
  );
});

test('extracts the monotonic request identity from the runtime marker', () => {
  assert.equal(
    requestIdFromText('Request id: 42; Request attempt: 1; Request outcome: loaded'),
    42,
  );
  assert.equal(requestIdFromText('Request attempt: 1; Request outcome: loaded'), undefined);
});

test('accepts a terminal marker from a post-timeout re-read', () => {
  const loaded =
    'Request id: 4; Request attempt: 1; Request outcome: loaded; Lifecycle: onAdLoaded';
  assert.deepEqual(terminalOutcomeFromMarkerText(loaded, 1), {
    requestId: 4,
    classification: 'loaded',
    detail: loaded,
  });
  assert.equal(terminalOutcomeFromMarkerText(loaded, 2), undefined);
  assert.equal(
    terminalOutcomeFromMarkerText('Request id: 4; Request attempt: 1; Request outcome: pending', 1),
    undefined,
  );
});

test('uses bounded exponential backoff for attempts two through ten', () => {
  assert.deepEqual(
    Array.from({ length: REPRESENTATIVE_REQUEST_MAX_ATTEMPTS }, (_, index) =>
      representativeRequestBackoffMs(index + 1),
    ),
    [0, 250, 500, 1000, 2000, 2000, 2000, 2000, 2000, 2000],
  );
});

test('uses a longer backoff schedule while a shared ad unit is recently accepted', () => {
  assert.deepEqual(
    Array.from({ length: REPRESENTATIVE_REQUEST_MAX_ATTEMPTS }, (_, index) =>
      representativeRequestBackoffMs(index + 1, { recentSameUnit: true }),
    ),
    [
      0,
      REPRESENTATIVE_REQUEST_RECENT_NOFILL_BASE_BACKOFF_MS,
      4_000,
      8_000,
      REPRESENTATIVE_REQUEST_RECENT_NOFILL_MAX_BACKOFF_MS,
      REPRESENTATIVE_REQUEST_RECENT_NOFILL_MAX_BACKOFF_MS,
      REPRESENTATIVE_REQUEST_RECENT_NOFILL_MAX_BACKOFF_MS,
      REPRESENTATIVE_REQUEST_RECENT_NOFILL_MAX_BACKOFF_MS,
      REPRESENTATIVE_REQUEST_RECENT_NOFILL_MAX_BACKOFF_MS,
      REPRESENTATIVE_REQUEST_RECENT_NOFILL_MAX_BACKOFF_MS,
    ],
  );
});

test('consecutive no-fill on a cold unit uses the longer RECENT_NOFILL backoff schedule', async () => {
  const adUnitId = googleTestAdUnitForFormat(
    AppiumTestIds.format.rewardedInterstitial,
    'android',
  );
  assert.ok(adUnitId);
  assert.equal(acceptedAdUnitAgeMs(adUnitId), null);

  const sleeps: number[] = [];
  const attempts = await runRepresentativeRequestOutcomeContract({
    format: AppiumTestIds.format.rewardedInterstitial,
    platform: 'android',
    path: 'fullscreen',
    configuration: 'android-nextgen',
    now: () => 5_000_000,
    sleep: async delayMs => {
      sleeps.push(delayMs);
    },
    runtime: runtimeRecorder(
      [],
      [
        observedRequest(1, 'no-fill'),
        observedRequest(2, 'no-fill'),
        observedRequest(3, 'no-fill'),
        observedRequest(4, 'loaded'),
      ],
    ),
  });
  assert.equal(attempts.length, 4);
  assert.equal(attempts[0]!.longerBackoff, false);
  assert.equal(attempts[0]!.consecutiveNoFillBefore, 0);
  assert.equal(attempts[0]!.sharedUnitHot, false);
  assert.equal(attempts[0]!.acceptedAtAgeMs, null);
  assert.equal(attempts[0]!.backoffMs, 0);
  assert.equal(attempts[1]!.longerBackoff, true);
  assert.equal(attempts[1]!.consecutiveNoFillBefore, 1);
  assert.equal(attempts[1]!.backoffMs, REPRESENTATIVE_REQUEST_RECENT_NOFILL_BASE_BACKOFF_MS);
  assert.equal(attempts[2]!.longerBackoff, true);
  assert.equal(attempts[2]!.consecutiveNoFillBefore, 2);
  assert.equal(attempts[2]!.backoffMs, 4_000);
  assert.equal(attempts[3]!.longerBackoff, true);
  assert.equal(attempts[3]!.consecutiveNoFillBefore, 3);
  assert.equal(attempts[3]!.backoffMs, 8_000);
  assert.deepEqual(sleeps, [
    REPRESENTATIVE_REQUEST_RECENT_NOFILL_BASE_BACKOFF_MS,
    4_000,
    8_000,
  ]);
});

test('rewarded and rewarded-hook share the same Google demo units', () => {
  assert.equal(
    googleTestAdUnitForFormat(AppiumTestIds.format.rewarded, 'android'),
    googleTestAdUnitForFormat(AppiumTestIds.format.rewardedHook, 'android'),
  );
  assert.equal(
    googleTestAdUnitForFormat(AppiumTestIds.format.rewarded, 'ios'),
    googleTestAdUnitForFormat(AppiumTestIds.format.rewardedHook, 'ios'),
  );
  assert.equal(
    googleTestAdUnitForFormat(AppiumTestIds.format.rewardedInterstitial, 'android'),
    googleTestAdUnitForFormat(AppiumTestIds.format.rewardedInterstitialHook, 'android'),
  );
});

test('cools down before attempt one when the shared ad unit was just accepted', async () => {
  const adUnitId = googleTestAdUnitForFormat(AppiumTestIds.format.rewarded, 'android');
  assert.ok(adUnitId);
  const t0 = 1_000_000;
  noteAcceptedAdUnit(adUnitId, t0);
  assert.equal(sharedAdUnitCooldownRemainingMs(adUnitId, t0 + 1_000), SHARED_AD_UNIT_PRE_FORMAT_COOLDOWN_MS);
  // Still hot after a same-shard gap of several minutes.
  assert.equal(
    sharedAdUnitCooldownRemainingMs(adUnitId, t0 + 5 * 60_000),
    SHARED_AD_UNIT_PRE_FORMAT_COOLDOWN_MS,
  );

  const sleeps: number[] = [];
  const lines: string[] = [];
  const attempts = await runRepresentativeRequestOutcomeContract({
    format: AppiumTestIds.format.rewardedHook,
    platform: 'android',
    path: 'hook',
    configuration: 'android-nextgen',
    now: () => t0 + 5 * 60_000,
    sleep: async delayMs => {
      sleeps.push(delayMs);
    },
    emit: line => {
      lines.push(line);
    },
    runtime: runtimeRecorder([], [observedRequest(1, 'loaded')]),
  });
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0]!.backoffMs, SHARED_AD_UNIT_PRE_FORMAT_COOLDOWN_MS);
  assert.deepEqual(sleeps, [SHARED_AD_UNIT_PRE_FORMAT_COOLDOWN_MS]);
  assert.ok(lines.some(line => line.startsWith(REQUEST_OUTCOME_LOG_SHARED_COOLDOWN_PREFIX)));
});

test('uses recent-nofill retry backoff while the shared ad unit stays hot', async () => {
  const adUnitId = googleTestAdUnitForFormat(AppiumTestIds.format.rewarded, 'android');
  assert.ok(adUnitId);
  const t0 = 2_000_000;
  noteAcceptedAdUnit(adUnitId, t0);
  let nowMs = t0 + 3 * 60_000;
  const sleeps: number[] = [];
  const attempts = await runRepresentativeRequestOutcomeContract({
    format: AppiumTestIds.format.rewardedHook,
    platform: 'android',
    path: 'hook',
    configuration: 'android-nextgen',
    now: () => nowMs,
    sleep: async delayMs => {
      sleeps.push(delayMs);
      nowMs += delayMs;
    },
    runtime: runtimeRecorder(
      [],
      [observedRequest(1, 'no-fill'), observedRequest(2, 'no-fill'), observedRequest(3, 'loaded')],
    ),
  });
  assert.equal(attempts.length, 3);
  assert.equal(attempts[0]!.backoffMs, SHARED_AD_UNIT_PRE_FORMAT_COOLDOWN_MS);
  assert.equal(attempts[1]!.backoffMs, REPRESENTATIVE_REQUEST_RECENT_NOFILL_BASE_BACKOFF_MS);
  assert.equal(attempts[2]!.backoffMs, 4_000);
  assert.deepEqual(sleeps, [
    SHARED_AD_UNIT_PRE_FORMAT_COOLDOWN_MS,
    REPRESENTATIVE_REQUEST_RECENT_NOFILL_BASE_BACKOFF_MS,
    4_000,
  ]);
});

test('stamps shared-unit memory after onAccepted show-close, not at load accept', async () => {
  const adUnitId = googleTestAdUnitForFormat(AppiumTestIds.format.rewarded, 'android');
  assert.ok(adUnitId);
  const order: string[] = [];
  let nowMs = 3_000_000;
  await runRepresentativeRequestOutcomeContract({
    format: AppiumTestIds.format.rewarded,
    platform: 'android',
    path: 'fullscreen',
    configuration: 'android-nextgen',
    now: () => nowMs,
    sleep: async () => {},
    onAccepted: async () => {
      order.push('onAccepted');
      assert.equal(sharedAdUnitCooldownRemainingMs(adUnitId, nowMs), 0);
      nowMs += 1_000;
    },
    runtime: runtimeRecorder([], [observedRequest(1, 'loaded')]),
  });
  order.push('after');
  assert.deepEqual(order, ['onAccepted', 'after']);
  assert.equal(sharedAdUnitCooldownRemainingMs(adUnitId, nowMs), SHARED_AD_UNIT_PRE_FORMAT_COOLDOWN_MS);
});

test('maps platform and RNGMA_ANDROID_BACKEND to request-outcome cell configuration', () => {
  assert.equal(requestOutcomeConfiguration('ios'), 'ios');
  assert.equal(requestOutcomeConfiguration('android', {}), 'android-classic');
  assert.equal(
    requestOutcomeConfiguration('android', { RNGMA_ANDROID_BACKEND: 'classic' }),
    'android-classic',
  );
  assert.equal(
    requestOutcomeConfiguration('android', { RNGMA_ANDROID_BACKEND: 'legacy' }),
    'android-classic',
  );
  assert.equal(
    requestOutcomeConfiguration('android', { RNGMA_ANDROID_BACKEND: 'nextgen' }),
    'android-nextgen',
  );
  assert.throws(
    () => requestOutcomeConfiguration('android', { RNGMA_ANDROID_BACKEND: 'unsupported' }),
    /must be classic, legacy, or nextgen/,
  );
});

test('formats stable machine-readable attempt output', () => {
  assert.equal(
    formatRequestOutcomeAttempt({
      format: 'gma.format.native',
      platform: 'android',
      configuration: 'android-classic',
      attempt: 2,
      requestId: 17,
      classification: 'internal-error',
      detail: 'Request error: internal-error: fingerprint',
      fingerprint: {
        status: 'matched',
        evidence: 'request-scoped native evidence',
      },
      backoffMs: 250,
      elapsedMs: 1400,
      adUnitId: 'ca-app-pub-3940256099942544/2247696110',
      errorCode: 'internal-error',
      longerBackoff: false,
      consecutiveNoFillBefore: 0,
      sharedUnitHot: false,
      acceptedAtAgeMs: null,
    }),
    '[request-outcome-attempt] {"format":"gma.format.native","platform":"android","configuration":"android-classic","attempt":2,"requestId":17,"classification":"internal-error","detail":"Request error: internal-error: fingerprint","fingerprint":{"status":"matched","evidence":"request-scoped native evidence"},"backoffMs":250,"elapsedMs":1400,"adUnitId":"ca-app-pub-3940256099942544/2247696110","errorCode":"internal-error","longerBackoff":false,"consecutiveNoFillBefore":0,"sharedUnitHot":false,"acceptedAtAgeMs":null}',
  );
});

function platformTestIdFromSource(
  source: string,
  platform: 'android' | 'ios',
  key: string,
): string {
  const block = new RegExp(`${platform}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`).exec(source);
  assert.ok(block?.[1], `expected Platform.select ${platform} block in TestIds.ts`);
  const match = new RegExp(`\\b${key}:\\s*'([^']+)'`).exec(block[1]);
  assert.ok(match?.[1], `expected TestIds.${key} for ${platform}`);
  return match[1];
}

function sharedTestIdFromSource(source: string, key: string): string {
  const match = new RegExp(`\\b${key}:\\s*'([^']+)'`).exec(source);
  assert.ok(match?.[1], `expected TestIds.${key}`);
  return match[1];
}

test('googleTestAdUnitForFormat maps banner smoke ids to TestIds', () => {
  const testIdsSource = readFileSync(
    fileURLToPath(new URL('../../../packages/core/src/TestIds.ts', import.meta.url)),
    'utf8',
  );
  const expected = {
    banner: {
      android: platformTestIdFromSource(testIdsSource, 'android', 'BANNER'),
      ios: platformTestIdFromSource(testIdsSource, 'ios', 'BANNER'),
    },
    adaptive: {
      android: platformTestIdFromSource(testIdsSource, 'android', 'ADAPTIVE_BANNER'),
      ios: platformTestIdFromSource(testIdsSource, 'ios', 'ADAPTIVE_BANNER'),
    },
    gamBanner: sharedTestIdFromSource(testIdsSource, 'GAM_BANNER'),
  };

  assert.equal(SMOKE_BANNER_VARIANT, AppiumTestIds.bannerVariant('Banner'));
  assert.equal(
    googleTestAdUnitForFormat(SMOKE_BANNER_VARIANT, 'android'),
    expected.banner.android,
  );
  assert.equal(googleTestAdUnitForFormat(SMOKE_BANNER_VARIANT, 'ios'), expected.banner.ios);
  assert.equal(
    googleTestAdUnitForFormat(AppiumTestIds.format.collapsibleBanner, 'android'),
    expected.adaptive.android,
  );
  assert.equal(
    googleTestAdUnitForFormat(AppiumTestIds.format.collapsibleBanner, 'ios'),
    expected.adaptive.ios,
  );
  assert.equal(
    googleTestAdUnitForFormat(SMOKE_GAM_BANNER_VARIANT, 'android'),
    expected.gamBanner,
  );
  assert.equal(googleTestAdUnitForFormat(SMOKE_GAM_BANNER_VARIANT, 'ios'), expected.gamBanner);
});

test('exhausted no-fill attempts name ad unit, error code, and backend', async () => {
  const lines: string[] = [];
  await assert.rejects(
    runRepresentativeRequestOutcomeContract({
      format: AppiumTestIds.format.rewarded,
      platform: 'android',
      path: 'fullscreen',
      configuration: 'android-classic',
      runtime: runtimeRecorder(
        [],
        Array.from({ length: REPRESENTATIVE_REQUEST_MAX_ATTEMPTS }, (_, index) =>
          observedRequest(index + 1, 'no-fill'),
        ),
      ),
      sleep: async () => {},
      emit: line => lines.push(line),
    }),
    error => {
      const message = String(error);
      return (
        message.includes('android-classic') &&
        message.includes('"adUnitId":"ca-app-pub-3940256099942544/5224354917"') &&
        message.includes('"errorCode":"no-fill"') &&
        message.includes('"longerBackoff":true') &&
        message.includes('"consecutiveNoFillBefore":9') &&
        message.includes('"sharedUnitHot":false') &&
        message.includes('"acceptedAtAgeMs":null')
      );
    },
  );
  assert.ok(lines.every(line => line.includes('"adUnitId":"ca-app-pub-3940256099942544/5224354917"')));
  assert.ok(lines.every(line => line.includes('"errorCode":"no-fill"')));
  assert.ok(lines.every(line => line.includes('"configuration":"android-classic"')));
  assert.ok(lines[0]!.includes('"longerBackoff":false'));
  assert.ok(lines[0]!.includes('"consecutiveNoFillBefore":0'));
  assert.ok(lines[1]!.includes('"longerBackoff":true'));
  assert.ok(lines[1]!.includes('"consecutiveNoFillBefore":1'));
  assert.ok(lines[9]!.includes('"consecutiveNoFillBefore":9'));
});

test('runtime exhausts rejected outcomes with stable JSON, backoff, and diagnostics', async () => {
  const lines: string[] = [];
  const delays: number[] = [];
  const calls: string[] = [];
  let clock = 1_000;
  await assert.rejects(
    runRepresentativeRequestOutcomeContract({
      format: 'gma.format.banner.Banner',
      platform: 'ios',
      path: 'banner',
      configuration: 'ios',
      runtime: runtimeRecorder(
        calls,
        Array.from({ length: REPRESENTATIVE_REQUEST_MAX_ATTEMPTS }, (_, index) =>
          observedRequest(101 + index, index % 2 === 0 ? 'no-fill' : 'other-error'),
        ),
      ),
      sleep: async delayMs => {
        delays.push(delayMs);
        clock += delayMs;
      },
      now: () => clock,
      emit: line => lines.push(line),
    }),
    error => {
      const message = String(error);
      return (
        message.includes(
          '[request-outcome] gma.format.banner.Banner/ios/ios: exhausted 10 attempts without acceptance',
        ) &&
        message.includes('"requestId":101') &&
        message.includes('"requestId":110') &&
        message.includes('"classification":"no-fill"') &&
        message.includes('"classification":"other-error"') &&
        message.includes('"status":"not-applicable"') &&
        message.includes('"adUnitId":"ca-app-pub-3940256099942544/2934735716"') &&
        message.includes('"backoffMs":0') &&
        message.includes('"backoffMs":2000') &&
        message.includes('"elapsedMs":')
      );
    },
  );

  assert.equal(lines.length, REPRESENTATIVE_REQUEST_MAX_ATTEMPTS);
  assert.ok(lines.every(line => line.startsWith('[request-outcome-attempt] {')));
  assert.ok(lines.every(line => line.includes('"configuration":"ios"')));
  assert.ok(
    lines.every(line =>
      line.includes('"adUnitId":"ca-app-pub-3940256099942544/2934735716"'),
    ),
  );
  assert.ok(lines.every(line => !line.includes('"adUnitId":null')));
  assert.ok(lines.every(line => line.includes('"longerBackoff":')));
  assert.ok(lines.every(line => line.includes('"consecutiveNoFillBefore":')));
  assert.ok(lines.every(line => line.includes('"sharedUnitHot":false')));
  assert.ok(lines.every(line => line.includes('"acceptedAtAgeMs":null')));
  assert.ok(lines[0]!.includes('"backoffMs":0'));
  // Alternating no-fill / other-error: after each no-fill the next attempt uses longer backoff.
  assert.ok(lines[1]!.includes('"backoffMs":2000'));
  assert.ok(lines[1]!.includes('"longerBackoff":true'));
  assert.ok(lines[1]!.includes('"consecutiveNoFillBefore":1'));
  assert.ok(lines[2]!.includes('"backoffMs":500'));
  assert.ok(lines[2]!.includes('"longerBackoff":false'));
  assert.deepEqual(delays, [2000, 500, 8000, 2000, 8000, 2000, 8000, 2000, 8000]);
  assert.equal(calls.filter(call => call === 'reload').length, 9);
  assert.notEqual(calls.at(-1), 'back');
});

test('exhaust diagnostic names android-classic vs android-nextgen cell', async () => {
  await assert.rejects(
    runRepresentativeRequestOutcomeContract({
      format: 'gma.format.rewarded-hook',
      platform: 'android',
      path: 'hook',
      configuration: 'android-classic',
      runtime: runtimeRecorder(
        [],
        Array.from({ length: REPRESENTATIVE_REQUEST_MAX_ATTEMPTS }, (_, index) =>
          observedRequest(index + 1, 'no-fill'),
        ),
      ),
      sleep: async () => {},
      emit: () => {},
    }),
    /gma\.format\.rewarded-hook\/android\/android-classic: exhausted 10 attempts/,
  );
  await assert.rejects(
    runRepresentativeRequestOutcomeContract({
      format: 'gma.format.rewarded-hook',
      platform: 'android',
      path: 'hook',
      configuration: 'android-nextgen',
      runtime: runtimeRecorder(
        [],
        Array.from({ length: REPRESENTATIVE_REQUEST_MAX_ATTEMPTS }, (_, index) =>
          observedRequest(index + 1, 'no-fill'),
        ),
      ),
      sleep: async () => {},
      emit: () => {},
    }),
    /gma\.format\.rewarded-hook\/android\/android-nextgen: exhausted 10 attempts/,
  );
});

test('all rejected classifications and fingerprints hard-fail at attempt ten', async () => {
  const rejected = [
    observedRequest(1, 'no-fill'),
    observedRequest(1, 'other-error'),
    observedRequest(1, 'internal-error', {
      status: 'not-matched' as const,
      evidence: 'signature absent',
    }),
    observedRequest(1, 'internal-error', {
      status: 'unavailable' as const,
      evidence: 'ios unavailable',
    }),
  ];
  for (const seed of rejected) {
    await assert.rejects(
      runRepresentativeRequestOutcomeContract({
        format: 'gma.format.native',
        platform: seed.fingerprint.status === 'unavailable' ? 'ios' : 'android',
        path: 'native',
        runtime: runtimeRecorder(
          [],
          Array.from({ length: 10 }, (_, index) => ({
            ...seed,
            requestId: index + 1,
          })),
        ),
        sleep: async () => {},
        emit: () => {},
      }),
      error => {
        const message = String(error);
        return (
          message.includes('exhausted 10 attempts without acceptance') &&
          message.includes(`"classification":"${seed.classification}"`) &&
          message.includes(`"status":"${seed.fingerprint.status}"`)
        );
      },
    );
  }
});

test('runtime stops immediately after a loaded outcome', async () => {
  const calls: string[] = [];
  const attempts = await runRepresentativeRequestOutcomeContract({
    format: 'gma.format.interstitial',
    platform: 'android',
    path: 'fullscreen',
    runtime: runtimeRecorder(calls, [
      observedRequest(1),
      observedRequest(2),
      observedRequest(3, 'loaded'),
      observedRequest(4),
    ]),
    sleep: async () => {},
    emit: () => {},
  });

  assert.deepEqual(
    attempts.map(attempt => attempt.classification),
    ['other-error', 'other-error', 'loaded'],
  );
  assert.equal(calls.filter(call => call === 'load').length, 3);
  assert.equal(calls.filter(call => call.startsWith('observe:')).length, 3);
});

test('Android Native matched fingerprint stops immediately without requiring loaded', async () => {
  const calls: string[] = [];
  const attempts = await runRepresentativeRequestOutcomeContract({
    format: 'gma.format.native',
    platform: 'android',
    path: 'native',
    runtime: runtimeRecorder(calls, [
      observedRequest(1, 'internal-error', {
        status: 'matched',
        evidence: 'request-scoped exact signature',
      }),
      observedRequest(2, 'loaded'),
    ]),
    sleep: async () => {},
    emit: () => {},
  });
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].fingerprint.status, 'matched');
  assert.equal(calls.filter(call => call === 'navigate').length, 1);
});

test('matched fingerprint does not waive non-Native or iOS sessions', async () => {
  for (const [path, platform] of [
    ['banner', 'android'],
    ['native', 'ios'],
    ['fullscreen', 'android'],
    ['gam', 'android'],
  ] as const) {
    await assert.rejects(
      runRepresentativeRequestOutcomeContract({
        format: `gma.format.${path}`,
        platform,
        path,
        maxAttempts: 1,
        runtime: runtimeRecorder(
          [],
          [
            observedRequest(1, 'internal-error', {
              status: 'matched',
              evidence: 'must not waive',
            }),
          ],
        ),
        sleep: async () => {},
        emit: () => {},
      }),
      /exhausted 1 attempts without acceptance/,
    );
  }
});

test('accepted callback distinguishes loaded render from Native fingerprint waiver', async () => {
  const accepted: RequestOutcomeClassification[] = [];
  for (const observation of [
    observedRequest(1, 'loaded'),
    observedRequest(1, 'internal-error', {
      status: 'matched' as const,
      evidence: 'request-scoped exact signature',
    }),
  ]) {
    resetAcceptedAdUnitMemory();
    await runRepresentativeRequestOutcomeContract({
      format: 'gma.format.native',
      platform: 'android',
      path: 'native',
      runtime: runtimeRecorder([], [observation]),
      sleep: async () => {},
      emit: () => {},
      onAccepted: async attempt => {
        accepted.push(attempt.classification);
      },
    });
  }
  assert.deepEqual(accepted, ['loaded', 'internal-error']);
});

test('runtime propagates timeout, WebDriver, and instrumentation errors without recovery', async () => {
  for (const error of [
    new Error('required marker is missing'),
    new Error('terminal marker timeout'),
    new Error('WebDriver disconnected'),
    new Error('socket hang up'),
    new Error('Could not proxy command to instrumentation'),
  ]) {
    let calls = 0;
    await assert.rejects(
      runRepresentativeRequestOutcomeContract({
        format: 'gma.format.native',
        platform: 'android',
        path: 'native',
        maxAttempts: 2,
        runtime: {
          ...runtimeRecorder([], [observedRequest(1)]),
          navigate: async () => {
            calls += 1;
          },
          observe: async () => {
          throw error;
        },
        },
      }),
      candidate => candidate === error,
    );
    assert.equal(calls, 1);
  }

  let navigationCalls = 0;
  await assert.rejects(
    runRepresentativeRequestOutcomeContract({
      format: 'gma.format.banner.Banner',
      platform: 'android',
      path: 'banner',
      runtime: {
        ...runtimeRecorder([], [observedRequest(1)]),
        navigate: async () => {
          navigationCalls += 1;
          throw new Error('instrumentation process is not running');
        },
      },
    }),
    /instrumentation process is not running/,
  );
  assert.equal(navigationCalls, 1);
});

test('runtime rejects missing, duplicate, and non-monotonic request identities', async () => {
  const cases = [
    {
      observations: [
        {
          ...observedRequest(1),
          requestId: undefined,
        } as unknown as ReturnType<typeof observedRequest>,
      ],
      expected: /did not report a valid request id/,
    },
    {
      observations: [observedRequest(9), observedRequest(9)],
      expected: /attempt 2 reused request id 9/,
    },
    {
      observations: [observedRequest(9), observedRequest(8)],
      expected: /request id 8 was not greater than 9/,
    },
  ];
  for (const { observations, expected } of cases) {
    await assert.rejects(
      runRepresentativeRequestOutcomeContract({
        format: 'gma.format.native',
        platform: 'android',
        path: 'native',
        maxAttempts: 2,
        runtime: runtimeRecorder([], observations),
        sleep: async () => {},
        emit: () => {},
      }),
      expected,
    );
  }
});

test('Native runtime remounts, clears logs, and observes fresh request ids every attempt', async () => {
  const calls: string[] = [];
  const attempts = await runRepresentativeRequestOutcomeContract({
    format: 'gma.format.native',
    platform: 'android',
    path: 'native',
    maxAttempts: 3,
    runtime: runtimeRecorder(calls, [
      observedRequest(41, 'internal-error'),
      observedRequest(42, 'internal-error'),
      observedRequest(43, 'loaded'),
    ]),
    sleep: async () => {},
    emit: () => {},
  });
  assert.deepEqual(
    attempts.map(attempt => attempt.requestId),
    [41, 42, 43],
  );
  assert.deepEqual(calls, [
    'clear-logs',
    'navigate',
    'observe:1',
    'back',
    'clear-logs',
    'navigate',
    'observe:1',
    'back',
    'clear-logs',
    'navigate',
    'observe:1',
    'back',
  ]);
});

test('fullscreen and GAM runtime load every attempt before observing', async () => {
  for (const path of ['fullscreen', 'gam'] satisfies RepresentativeRequestPath[]) {
    const calls: string[] = [];
    await runRepresentativeRequestOutcomeContract({
      format: `gma.format.${path}`,
      platform: 'ios',
      path,
      maxAttempts: 2,
      runtime: runtimeRecorder(calls, [
        observedRequest(1, 'no-fill'),
        observedRequest(2, 'loaded'),
      ]),
      sleep: async () => {},
      emit: () => {},
    });
    assert.deepEqual(calls, [
      'navigate',
      'load',
      'observe:1',
      'load',
      'observe:2',
      'back',
    ]);
  }
});

test('hook auto-load runtime remounts between rejected hook load attempts', async () => {
  const calls: string[] = [];
  await runRepresentativeRequestOutcomeContract({
    format: AppiumTestIds.format.interstitialHook,
    platform: 'android',
    path: 'hook',
    hookAutoLoad: true,
    maxAttempts: 2,
    runtime: runtimeRecorder(calls, [
      observedRequest(1, 'no-fill'),
      observedRequest(2, 'loaded'),
    ]),
    sleep: async () => {},
    emit: () => {},
  });
  assert.deepEqual(calls, [
    'navigate',
    'observe:1',
    'back',
    'navigate',
    // Collection attempt (not UI attempt 1) so synthetic hook requestIds stay unique.
    'observe:2',
    'back',
  ]);
  assert.ok(!calls.includes('load'));
});

test('App Open fullscreen remount retries Load after remount before observing', async () => {
  const calls: string[] = [];
  await runRepresentativeRequestOutcomeContract({
    format: AppiumTestIds.format.appOpen,
    platform: 'ios',
    path: 'fullscreen',
    retry: 'remount',
    maxAttempts: 2,
    runtime: runtimeRecorder(calls, [
      observedRequest(1, 'pending-timeout'),
      observedRequest(2, 'loaded'),
    ]),
    sleep: async () => {},
    emit: () => {},
  });
  assert.deepEqual(calls, [
    'navigate',
    'load',
    'observe:1',
    'back',
    'navigate',
    'load',
    // Fresh mount after Load resets the UI marker to attempt 1.
    'observe:1',
    'back',
  ]);
});

test('App Open hook remount retries Load after remount with unique synthetic request ids', async () => {
  const calls: string[] = [];
  await runRepresentativeRequestOutcomeContract({
    format: AppiumTestIds.format.appOpenHook,
    platform: 'ios',
    path: 'hook',
    retry: 'remount',
    maxAttempts: 2,
    runtime: runtimeRecorder(calls, [
      observedRequest(1, 'pending-timeout'),
      observedRequest(2, 'loaded'),
    ]),
    sleep: async () => {},
    emit: () => {},
  });
  assert.deepEqual(calls, [
    'navigate',
    'load',
    'observe:1',
    'back',
    'navigate',
    'load',
    // Collection attempt (not UI attempt 1) so synthetic hook requestIds stay unique.
    'observe:2',
    'back',
  ]);
});

test('remount retry revisits the format screen instead of tapping Load', async () => {
  const calls: string[] = [];
  await runRepresentativeRequestOutcomeContract({
    format: AppiumTestIds.format.collapsibleBanner,
    platform: 'android',
    path: 'banner',
    retry: 'remount',
    maxAttempts: 2,
    runtime: runtimeRecorder(calls, [
      observedRequest(1, 'no-fill'),
      observedRequest(2, 'loaded'),
    ]),
    sleep: async () => {},
    emit: () => {},
  });
  assert.deepEqual(calls, [
    'navigate',
    'observe:1',
    'back',
    'navigate',
    'observe:1',
    'back',
  ]);
  assert.ok(!calls.includes('load'));
  assert.ok(!calls.includes('reload'));
});

test('pending-timeout observations remount instead of aborting the session', async () => {
  const calls: string[] = [];
  const lines: string[] = [];
  await runRepresentativeRequestOutcomeContract({
    format: SMOKE_GAM_BANNER_VARIANT,
    platform: 'android',
    path: 'gam',
    retry: 'remount',
    maxAttempts: 2,
    runtime: runtimeRecorder(calls, [
      observedRequest(4, 'pending-timeout'),
      observedRequest(5, 'loaded'),
    ]),
    sleep: async () => {},
    emit: line => lines.push(line),
  });
  assert.deepEqual(calls, [
    'navigate',
    'observe:1',
    'back',
    'navigate',
    'observe:1',
    'back',
  ]);
  assert.ok(lines.some(line => line.includes('"classification":"pending-timeout"')));
  assert.ok(lines.some(line => line.includes('"classification":"loaded"')));
});

test('GAM banner remount retry auto-loads instead of tapping Load', () => {
  assert.equal(representativeRequestOperation('gam', 1, 'remount'), 'auto-load');
  assert.equal(representativeRequestOperation('gam', 2, 'remount'), 'remount');
  assert.equal(representativeRequestOperation('gam', 2, 'default'), 'load');
});

test('Native fingerprint requires the exact adjacent same-process GMA sequence', () => {
  const signature =
    'Received log message: <Google:HTML> Incorrect native ad response. Click actions were not properly specified';
  const line = (
    time: string,
    processId: number,
    message: string,
    tag = 'Ads',
  ) => `09-18 12:52:${time}  ${processId}  5433 I ${tag.padEnd(8)}: ${message}`;
  const exact = [
    line('26.799', 4223, signature),
    line('26.804', 4223, 'Ad failed to load : 0'),
  ].join('\n');
  assert.equal(nativeFingerprintFromAndroidLog(exact).status, 'matched');
  assert.equal(nativeFingerprintFromAndroidLog(`${exact}\n`).status, 'matched');
  assert.equal(
    nativeFingerprintFromAndroidLog(`${exact.replaceAll('\n', '\r\n')}\r\n`).status,
    'matched',
  );

  const negativeLogs = [
    line('26.799', 4223, signature),
    line('26.799', 4223, 'Ad failed to load : 0'),
    [line('26.804', 4223, 'Ad failed to load : 0'), line('26.799', 4223, signature)].join(
      '\n',
    ),
    [line('26.799', 4223, signature), line('27.100', 4223, 'Ad failed to load : 0')].join(
      '\n',
    ),
    [line('26.799', 4223, signature), line('26.804', 5516, 'Ad failed to load : 0')].join(
      '\n',
    ),
    [
      line('26.799', 4223, signature),
      line('26.801', 4223, 'Ad failed to load : 3'),
      line('26.804', 4223, 'Ad failed to load : 0'),
    ].join('\n'),
    [
      line('26.799', 4223, signature),
      line('26.801', 4223, 'unrelated chronological log entry', 'ReactNativeJS'),
      line('26.804', 4223, 'Ad failed to load : 0'),
    ].join('\n'),
    [
      line('26.799', 4223, signature),
      '',
      line('26.804', 4223, 'Ad failed to load : 0'),
    ].join('\n'),
    [
      line('26.799', 4223, signature),
      '   ',
      line('26.804', 4223, 'Ad failed to load : 0'),
    ].join('\n'),
    line('26.799', 4223, signature),
    line('26.804', 4223, 'Ad failed to load : 0'),
    [
      line('26.700', 4223, signature),
      line('26.705', 4223, 'Ad failed to load : 0'),
      line('26.799', 4223, signature),
    ].join('\n'),
  ];
  const expectedEvidence = [
    'android-logcat-request-window:signature-without-gma-error-0',
    'android-logcat-request-window:no-known-native-response-signature',
    'android-logcat-request-window:signature-without-gma-error-0',
    'android-logcat-request-window:signature-without-gma-error-0',
    'android-logcat-request-window:signature-without-gma-error-0',
    'android-logcat-request-window:signature-without-gma-error-0',
    'android-logcat-request-window:signature-without-gma-error-0',
    'android-logcat-request-window:signature-without-gma-error-0',
    'android-logcat-request-window:signature-without-gma-error-0',
    'android-logcat-request-window:signature-without-gma-error-0',
    'android-logcat-request-window:no-known-native-response-signature',
    'android-logcat-request-window:signature-without-gma-error-0',
  ];
  assert.deepEqual(
    negativeLogs.map(log => nativeFingerprintFromAndroidLog(log).evidence),
    expectedEvidence,
  );
});

test('broad format coverage remains navigation/container-only', () => {
  assert.ok(NAVIGATION_SMOKE_CASES.every(contract => contract.contract === 'navigation'));
  assert.ok(NAVIGATION_SMOKE_CASES.every(contract => !contract.requiresAppRestart));
  assert.equal(
    new Set(NAVIGATION_SMOKE_CASES.map(contract => contract.id)).size,
    NAVIGATION_SMOKE_CASES.length,
  );
});

test('retires blanket per-attempt acceptance and locks real render probes', () => {
  const outcomeSource = readFileSync(
    new URL('../src/requestOutcomes.ts', import.meta.url),
    'utf8',
  );
  const exampleSource = readFileSync(
    new URL('../../../RNGoogleMobileAdsExample/App.tsx', import.meta.url),
    'utf8',
  );
  const gallerySource = readFileSync(
    new URL('../test/helpers/gallery.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(outcomeSource, /acceptRepresentativeRequestOutcome/);
  assert.match(
    exampleSource,
    /<View testID=\{AppiumTestIds\.action\.rendered\(formatId\)\} collapsable=\{false\}>[\s\S]*?<BannerAd[\s\S]*?onAdLoaded=/,
  );
  assert.match(
    exampleSource,
    /<NativeAdView[\s\S]*?testID=\{AppiumTestIds\.action\.rendered\(AppiumTestIds\.format\.native\)\}/,
  );
  assert.match(gallerySource, /attempt\.classification !== 'loaded'/);
  assert.match(gallerySource, /\[show-close-proof\]/);
  assert.match(gallerySource, /\[hook-lifecycle-proof\]/);
  assert.match(gallerySource, /\[earned-reward-proof\]/);
  assert.match(gallerySource, /\[paid-event-canary\]/);
  assert.match(gallerySource, /\[manual-impression-canary\]/);
  assert.match(gallerySource, /classifyHookLoadOutcome/);
  assert.match(gallerySource, /classifyPoolFilledOutcome/);
  assert.match(gallerySource, /observePoolFilledOutcome/);
  assert.match(gallerySource, /format\.renderProof === 'banner'/);
  assert.match(gallerySource, /root\.\$\$\('\.\/\/\*'\)/);
  assert.match(gallerySource, /hasNonzeroRectangle\(size\)/);
  assert.match(gallerySource, /\[render-proof\]/);
  assert.match(gallerySource, /descendantType/);
  assert.match(gallerySource, /emitStatusLabel: 'probe-seam'/);
  assert.match(gallerySource, /\[utility-open-close-proof\]/);
  assert.match(gallerySource, /proveSdkUtilitySurface/);
});

test('deterministic NativeRNGMATesting seam requires exact state markers', () => {
  assert.equal(NATIVE_RNGMA_TESTING_PROBE.expectedStatusText, 'ok ping=');
  assert.deepEqual(NATIVE_RNGMA_TESTING_PROBE.expectedPingByPlatform, {
    android: 'ok ping=ok:android',
    ios: 'ok ping=ok:ios',
  });
  assert.deepEqual(NATIVE_RNGMA_TESTING_PROBE.expectedStatusMarkers, [
    'ttl=60000',
    'cleared=-1',
    'attach=true',
    'fixtures=fixture-loaded-response,null,fixture-paid-response',
  ]);
  assert.ok(
    NATIVE_RNGMA_TESTING_PROBE.expectedStatusMarkers.every(
      marker => !marker.startsWith('pool='),
    ),
  );
});
