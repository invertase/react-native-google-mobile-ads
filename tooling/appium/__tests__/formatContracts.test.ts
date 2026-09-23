import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
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
  formatRequestOutcomeAttempt,
  hasNonzeroRectangle,
  nativeFingerprintFromAndroidLog,
  representativeRequestBackoffMs,
  representativeRequestOperation,
  requestIdFromText,
  runRepresentativeRequestOutcomeContract,
  REPRESENTATIVE_REQUEST_MAX_ATTEMPTS,
  REQUEST_OUTCOME_LOADED,
  REQUEST_OUTCOME_NO_FILL,
  type RequestOutcomeClassification,
  type RepresentativeRequestPath,
} from '../src/requestOutcomes.ts';
import { AppiumTestIds } from '../src/testIds.ts';

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

test('extracts the monotonic request identity from the runtime marker', () => {
  assert.equal(
    requestIdFromText('Request id: 42; Request attempt: 1; Request outcome: loaded'),
    42,
  );
  assert.equal(requestIdFromText('Request attempt: 1; Request outcome: loaded'), undefined);
});

test('uses bounded exponential backoff for attempts two through ten', () => {
  assert.deepEqual(
    Array.from({ length: REPRESENTATIVE_REQUEST_MAX_ATTEMPTS }, (_, index) =>
      representativeRequestBackoffMs(index + 1),
    ),
    [0, 250, 500, 1000, 2000, 2000, 2000, 2000, 2000, 2000],
  );
});

test('formats stable machine-readable attempt output', () => {
  assert.equal(
    formatRequestOutcomeAttempt({
      format: 'gma.format.native',
      platform: 'android',
      attempt: 2,
      requestId: 17,
      classification: 'internal-error',
      detail: 'Request error: internal-error: fingerprint',
      fingerprint: {
        status: 'matched',
        evidence: 'request-scoped native evidence',
      },
    }),
    '[request-outcome-attempt] {"format":"gma.format.native","platform":"android","attempt":2,"requestId":17,"classification":"internal-error","detail":"Request error: internal-error: fingerprint","fingerprint":{"status":"matched","evidence":"request-scoped native evidence"}}',
  );
});

test('runtime exhausts rejected outcomes with stable JSON, backoff, and diagnostics', async () => {
  const lines: string[] = [];
  const delays: number[] = [];
  const calls: string[] = [];
  await assert.rejects(
    runRepresentativeRequestOutcomeContract({
      format: 'gma.format.banner.Banner',
      platform: 'ios',
      path: 'banner',
      runtime: runtimeRecorder(
        calls,
        Array.from({ length: REPRESENTATIVE_REQUEST_MAX_ATTEMPTS }, (_, index) =>
          observedRequest(101 + index, index % 2 === 0 ? 'no-fill' : 'other-error'),
        ),
      ),
      sleep: async delayMs => {
        delays.push(delayMs);
      },
      emit: line => lines.push(line),
    }),
    error => {
      const message = String(error);
      return (
        message.includes('exhausted 10 attempts without acceptance') &&
        message.includes('"requestId":101') &&
        message.includes('"requestId":110') &&
        message.includes('"classification":"no-fill"') &&
        message.includes('"classification":"other-error"') &&
        message.includes('"status":"not-applicable"')
      );
    },
  );

  assert.equal(lines.length, REPRESENTATIVE_REQUEST_MAX_ATTEMPTS);
  assert.ok(lines.every(line => line.startsWith('[request-outcome-attempt] {')));
  assert.deepEqual(delays, [250, 500, 1000, 2000, 2000, 2000, 2000, 2000, 2000]);
  assert.equal(calls.filter(call => call === 'reload').length, 9);
  assert.notEqual(calls.at(-1), 'back');
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
    await runRepresentativeRequestOutcomeContract({
      format: 'gma.format.native',
      platform: 'android',
      path: 'native',
      runtime: runtimeRecorder([], [observation]),
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
    'observe:2',
    'back',
  ]);
  assert.ok(!calls.includes('load'));
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
    'observe:2',
    'back',
  ]);
  assert.ok(!calls.includes('load'));
  assert.ok(!calls.includes('reload'));
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
  assert.match(gallerySource, /classifyHookLoadOutcome/);
  assert.match(gallerySource, /classifyPoolFilledOutcome/);
  assert.match(gallerySource, /observePoolFilledOutcome/);
  assert.match(gallerySource, /format\.renderProof === 'banner'/);
  assert.match(gallerySource, /root\.\$\$\('\.\/\/\*'\)/);
  assert.match(gallerySource, /hasNonzeroRectangle\(size\)/);
  assert.match(gallerySource, /\[render-proof\]/);
  assert.match(gallerySource, /descendantType/);
  assert.match(gallerySource, /emitStatusLabel: 'probe-seam'/);
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
