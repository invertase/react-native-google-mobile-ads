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
  classifyRequestOutcome,
  formatRequestOutcomeAttempt,
  nativeFingerprintFromAndroidLog,
  representativeRequestBackoffMs,
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
) {
  return {
    requestId,
    classification,
    detail: `request ${requestId}`,
    fingerprint: NOT_APPLICABLE_FINGERPRINT,
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

test('SDK internal-error passes through the explicit warning path', () => {
  const warnings: string[] = [];
  assert.equal(
    acceptRepresentativeRequestOutcome(
      'gma.format.example',
      'Request error: internal-error: [googleMobileAds/internal-error] Internal error.',
      warning => warnings.push(warning),
    ),
    true,
  );
  assert.deepEqual(warnings, ['[request-outcome] gma.format.example: SDK internal-error accepted']);
});

test('other SDK errors remain temporarily accepted with details', () => {
  const warnings: string[] = [];
  assert.equal(
    acceptRepresentativeRequestOutcome(
      'gma.format.example',
      'Request error: network-error: offline',
      warning => warnings.push(warning),
    ),
    true,
  );
  assert.deepEqual(warnings, [
    '[request-outcome] gma.format.example: SDK other-error accepted: Request error: network-error: offline',
  ]);
});

test('non-terminal request outcomes keep waiting instead of passing', () => {
  for (const text of ['Request outcome: pending', 'Loaded? false', '']) {
    assert.equal(acceptRepresentativeRequestOutcome('gma.format.example', text), false);
  }
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

test('runtime retries terminal degradation with capped backoff and stable records', async () => {
  const lines: string[] = [];
  const delays: number[] = [];
  const calls: string[] = [];
  const attempts = await runRepresentativeRequestOutcomeContract({
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
  });

  assert.equal(attempts.length, REPRESENTATIVE_REQUEST_MAX_ATTEMPTS);
  assert.equal(lines.length, REPRESENTATIVE_REQUEST_MAX_ATTEMPTS);
  assert.deepEqual(delays, [250, 500, 1000, 2000, 2000, 2000, 2000, 2000, 2000]);
  assert.deepEqual(
    attempts.map(attempt => attempt.requestId),
    [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
  );
  assert.deepEqual(calls.slice(0, 4), ['navigate', 'observe:1', 'reload', 'observe:2']);
  assert.equal(calls.filter(call => call === 'reload').length, 9);
  assert.equal(calls.at(-1), 'back');
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

test('fullscreen and GAM runtime load every attempt and never expose Show', async () => {
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
    assert.ok(calls.every(call => call !== 'show'));
  }
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
  const navigationCases = [
    ...NAVIGATION_SMOKE_PRIMARY,
    ...NAVIGATION_SMOKE_SECONDARY,
    ...NAVIGATION_SMOKE_TERTIARY,
  ];
  assert.equal(navigationCases.length, 17);
  assert.ok(navigationCases.every(contract => contract.contract === 'navigation'));
  assert.ok(navigationCases.every(contract => !contract.requiresAppRestart));
});
