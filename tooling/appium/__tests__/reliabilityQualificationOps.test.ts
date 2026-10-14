import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CLASSIC_CANARY_NEXTGEN_SUITE_INTERVAL,
  HARDWARE_DIVERSITY_PREFERRED_SLOTS,
  REDUCED_DIVERSITY_MIN_COLD_EPOCHS,
  WARM_EPOCH_CREDITED_SUITE_CAP,
  assertCoverageFlushGate,
  buildQualificationEvidencePackage,
  createClassicCanaryScheduler,
  createCoverageFlushGateReceipt,
  createWarmEpochTracker,
  evaluateClassicCanaryCadence,
  evaluateCoverageFlushGate,
  evaluateHardwareDiversity,
} from '../src/reliabilityQualificationOps.ts';
import { STATS_PROJECTION_DISCLAIMER } from '../src/reliabilityStats.ts';

describe('warm-epoch suite cap', () => {
  test('requires cold restart after 50 credited suites', () => {
    assert.equal(WARM_EPOCH_CREDITED_SUITE_CAP, 50);
    const tracker = createWarmEpochTracker();
    for (let i = 0; i < 49; i += 1) {
      assert.equal(tracker.noteCreditedSuitePass().mustColdRestart, false);
    }
    assert.equal(tracker.noteCreditedSuitePass().mustColdRestart, true);
    assert.equal(tracker.state().creditedSuitesInWarmEpoch, 50);

    const afterCold = tracker.coldRestart();
    assert.equal(afterCold.mustColdRestart, false);
    assert.equal(afterCold.creditedSuitesInWarmEpoch, 0);
    assert.equal(afterCold.coldEpochCount, 1);
    assert.equal(afterCold.warmEpochId, 2);
  });
});

describe('hardware diversity', () => {
  test('prefers three slots and discloses reduced diversity otherwise', () => {
    assert.equal(HARDWARE_DIVERSITY_PREFERRED_SLOTS, 3);
    assert.equal(REDUCED_DIVERSITY_MIN_COLD_EPOCHS, 60);

    const full = evaluateHardwareDiversity({
      availableSlots: 3,
      coldEpochCount: 0,
    });
    assert.equal(full.preferredDiversityMet, true);
    assert.equal(full.reducedHardwareDiversity, false);
    assert.equal(full.diversityRequirementMet, true);

    const byTimeBlocks = evaluateHardwareDiversity({
      availableSlots: 1,
      timeBlocks: 3,
      coldEpochCount: 0,
    });
    assert.equal(byTimeBlocks.preferredDiversityMet, true);
    assert.equal(byTimeBlocks.reducedHardwareDiversity, false);

    const reducedEarly = evaluateHardwareDiversity({
      availableSlots: 1,
      coldEpochCount: 10,
    });
    assert.equal(reducedEarly.reducedHardwareDiversity, true);
    assert.equal(reducedEarly.diversityRequirementMet, false);
    assert.match(reducedEarly.detail, /Reduced hardware diversity disclosed/);

    const reducedMet = evaluateHardwareDiversity({
      availableSlots: 2,
      coldEpochCount: 60,
    });
    assert.equal(reducedMet.reducedHardwareDiversity, true);
    assert.equal(reducedMet.diversityRequirementMet, true);
  });
});

describe('classic canary cadence', () => {
  test('dues on interval, executable change, and final validation', () => {
    assert.equal(CLASSIC_CANARY_NEXTGEN_SUITE_INTERVAL, 100);

    assert.equal(
      evaluateClassicCanaryCadence({
        creditedNextGenSuitePasses: 99,
      }).due,
      false,
    );
    assert.deepEqual(
      evaluateClassicCanaryCadence({
        creditedNextGenSuitePasses: 100,
      }).triggers,
      ['interval'],
    );
    assert.deepEqual(
      evaluateClassicCanaryCadence({
        creditedNextGenSuitePasses: 10,
        executableChangedSinceLastCanary: true,
      }).triggers,
      ['executable-change'],
    );
    assert.deepEqual(
      evaluateClassicCanaryCadence({
        creditedNextGenSuitePasses: 0,
        finalValidation: true,
      }).triggers,
      ['final-validation'],
    );

    const scheduler = createClassicCanaryScheduler({
      createReceiptId: (() => {
        let n = 0;
        return () => `canary_${++n}`;
      })(),
    });
    for (let i = 0; i < 100; i += 1) {
      scheduler.noteNextGenSuitePass();
    }
    assert.equal(scheduler.decision().due, true);
    const receipt = scheduler.recordCanary({
      trigger: 'interval',
      outcome: 'pass',
      layoutDigest: 'layout-a',
      executableDigest: 'exec-a',
    });
    assert.equal(receipt.kind, 'classic-canary');
    assert.equal(scheduler.decision().due, false);
    assert.equal(
      scheduler.decision({ executableChangedSinceLastCanary: true }).due,
      true,
    );
  });
});

describe('coverage flush gate', () => {
  test('fails the coverage run when flush/pull/report receipts are missing or failed', () => {
    const incomplete = evaluateCoverageFlushGate([
      createCoverageFlushGateReceipt({ stage: 'flush', outcome: 'pass', receiptId: 'f1' }),
    ]);
    assert.equal(incomplete.ok, false);
    assert.deepEqual(incomplete.missingStages, ['pull', 'report']);

    const failedFlush = evaluateCoverageFlushGate([
      createCoverageFlushGateReceipt({
        stage: 'flush',
        outcome: 'fail',
        receiptId: 'f2',
        detail: 'control missing',
      }),
      createCoverageFlushGateReceipt({ stage: 'pull', outcome: 'pass', receiptId: 'p2' }),
      createCoverageFlushGateReceipt({ stage: 'report', outcome: 'pass', receiptId: 'r2' }),
    ]);
    assert.equal(failedFlush.ok, false);
    assert.deepEqual(failedFlush.failedStages, ['flush']);
    assert.throws(() => assertCoverageFlushGate(failedFlush.receipts), /flush gate failed/);

    const ok = assertCoverageFlushGate([
      createCoverageFlushGateReceipt({ stage: 'flush', outcome: 'pass', receiptId: 'f3' }),
      createCoverageFlushGateReceipt({ stage: 'pull', outcome: 'pass', receiptId: 'p3' }),
      createCoverageFlushGateReceipt({ stage: 'report', outcome: 'pass', receiptId: 'r3' }),
    ]);
    assert.equal(ok.ok, true);
  });
});

describe('qualification evidence package', () => {
  test('keeps non-authoritative disclaimer until pilot/live ledger has credits', () => {
    const warm = createWarmEpochTracker().state();
    const diversity = [
      evaluateHardwareDiversity({ availableSlots: 1, coldEpochCount: 60 }),
    ];
    const empty = buildQualificationEvidencePackage({
      freezeDigests: {
        layout: 'layout-digest',
        policy: 'policy-digest',
        executable: 'executable-digest',
      },
      ledgerSource: 'none',
      epoch: 1,
      perCellStatus: [],
      suiteSignals: [],
      coverageFlushReceipts: [
        createCoverageFlushGateReceipt({ stage: 'flush', outcome: 'pass', receiptId: 'f' }),
        createCoverageFlushGateReceipt({ stage: 'pull', outcome: 'pass', receiptId: 'p' }),
        createCoverageFlushGateReceipt({ stage: 'report', outcome: 'pass', receiptId: 'r' }),
      ],
      warmEpoch: warm,
      hardwareDiversity: diversity,
    });
    assert.equal(empty.kind, 'qualification-evidence');
    assert.equal(empty.statisticalAuthoritative, false);
    assert.equal(empty.disclaimer, STATS_PROJECTION_DISCLAIMER);
    assert.equal(empty.coverageFlushGate.ok, true);
    assert.equal(empty.hardwareDiversity[0]?.reducedHardwareDiversity, true);

    const withCredits = buildQualificationEvidencePackage({
      freezeDigests: empty.freezeDigests,
      ledgerSource: 'pilot',
      epoch: 2,
      perCellStatus: [
        {
          cellKey: {
            configuration: 'ios',
            cellKind: 'startup',
            cellId: 'session-create',
          },
          epoch: 2,
          validPasses: 1,
          retainedFailures: 0,
          validObservations: 1,
          requiredObservations: 2995,
          remaining: 2994,
          qualified: false,
          upperBound: 0.95,
          checkpoint: { retainedFailures: 0, requiredObservations: 2995 },
        },
      ],
      suiteSignals: [
        {
          configuration: 'ios',
          epoch: 2,
          creditedSuitePasses: 0,
          suiteFailures: 0,
          independentOfPerCell: true,
        },
      ],
      canaryReceipts: [],
      coverageFlushReceipts: empty.coverageFlushGate.receipts,
      warmEpoch: warm,
      hardwareDiversity: diversity,
    });
    assert.equal(withCredits.statisticalAuthoritative, true);
    assert.equal(withCredits.disclaimer, null);
    // Do not invent a 2,995 qualified claim from a single credit.
    assert.equal(withCredits.perCellStatus[0]?.qualified, false);
  });
});
