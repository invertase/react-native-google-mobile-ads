import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import {
  createCampaignController,
  runStatsPilot,
} from '../src/reliabilityCampaign.ts';
import {
  caseDependencyScopeId,
  cellDependencyScopeId,
  createEvidenceLedger,
  defaultCellDependencyDigests,
  dependencyDigest,
} from '../src/reliabilityEvidence.ts';
import {
  ZERO_FAILURE_OBSERVATION_TARGET,
  PRE_REGISTERED_FAILURE_CHECKPOINTS,
  QUALIFICATION_MAX_FLAKE_RATE,
  QUALIFICATION_POLICY,
  STATS_PROJECTION_DISCLAIMER,
  assertPreRegisteredCheckpointsConsistent,
  checkpointForRetainedFailures,
  clopperPearsonUpperBound,
  configurationForPlatformBackend,
  evaluateCellQualification,
  minObservationsForRetainedFailures,
  scheduleQualificationWork,
} from '../src/reliabilityStats.ts';
import {
  createDryRunReliabilityRunner,
  runReliabilityWorker,
} from '../src/reliabilityWorker.ts';
import { buildReliabilityLayout } from '../src/reliabilityLayouts.ts';
import { SMOKE_SHARDS } from '../src/sessionShards.ts';

describe('statistical qualification policy', () => {
  test('locks zero-failure target and pre-registered CP checkpoints', () => {
    assert.equal(ZERO_FAILURE_OBSERVATION_TARGET, 2995);
    assert.equal(QUALIFICATION_POLICY.confidence, 0.95);
    assert.equal(QUALIFICATION_POLICY.maxFlakeRate, 0.001);
    assert.equal(
      Math.ceil(Math.log(0.05) / Math.log(0.999)),
      ZERO_FAILURE_OBSERVATION_TARGET,
    );
    assertPreRegisteredCheckpointsConsistent();
    assert.equal(PRE_REGISTERED_FAILURE_CHECKPOINTS[0]?.requiredObservations, 2995);
    assert.equal(
      checkpointForRetainedFailures(1).requiredObservations,
      minObservationsForRetainedFailures(1),
    );
    const bound = clopperPearsonUpperBound(0, 2995);
    assert.equal(bound <= QUALIFICATION_MAX_FLAKE_RATE, true);
    assert.equal(clopperPearsonUpperBound(0, 2994) > QUALIFICATION_MAX_FLAKE_RATE, true);
  });

  test('maps classic Android out of qualifying configurations', () => {
    assert.equal(configurationForPlatformBackend('ios'), 'ios');
    assert.equal(configurationForPlatformBackend('android', 'nextgen'), 'android-nextgen');
    assert.equal(configurationForPlatformBackend('android', 'classic'), 'android-classic');
    assert.equal(configurationForPlatformBackend('android'), 'android-nextgen');
  });

  test('schedules unfinished cells by remaining observations', () => {
    const statuses = [
      evaluateCellQualification({
        cellKey: {
          configuration: 'ios',
          cellKind: 'test',
          cellId: 'banner',
        },
        epoch: 1,
        validPasses: 10,
        retainedFailures: 0,
      }),
      evaluateCellQualification({
        cellKey: {
          configuration: 'ios',
          cellKind: 'startup',
          cellId: 'session-create',
        },
        epoch: 1,
        validPasses: 10,
        retainedFailures: 0,
      }),
      evaluateCellQualification({
        cellKey: {
          configuration: 'android-nextgen',
          cellKind: 'test',
          cellId: 'rewarded',
        },
        epoch: 1,
        validPasses: 2995,
        retainedFailures: 0,
      }),
    ];
    assert.equal(statuses[2]!.qualified, true);
    const schedule = scheduleQualificationWork(statuses);
    assert.equal(schedule.length, 2);
    assert.equal(schedule[0]!.cellKey.cellId, 'session-create');
    assert.equal(schedule[0]!.remaining, 2985);
    assert.equal(schedule[1]!.cellKey.cellId, 'banner');
  });
});

describe('scoped evidence invalidation', () => {
  test('credits cells independently and invalidates only reviewed dependency scope', () => {
    const ledger = createEvidenceLedger({
      createCreditId: (() => {
        let n = 0;
        return () => `ev_${++n}`;
      })(),
    });
    const bannerKey = {
      configuration: 'android-nextgen' as const,
      cellKind: 'test' as const,
      cellId: 'banner',
    };
    const nativeKey = {
      configuration: 'android-nextgen' as const,
      cellKind: 'test' as const,
      cellId: 'native',
    };
    const bannerCaseScope = caseDependencyScopeId('android-nextgen', 'banner');
    const nativeCaseScope = caseDependencyScopeId('android-nextgen', 'native');
    const bannerDigests = defaultCellDependencyDigests({
      cellKey: bannerKey,
      layoutDigest: 'layout-a',
      extra: {
        [bannerCaseScope]: dependencyDigest(bannerCaseScope, { v: 1 }).digest,
      },
    });
    const nativeDigests = defaultCellDependencyDigests({
      cellKey: nativeKey,
      layoutDigest: 'layout-a',
      extra: {
        [nativeCaseScope]: dependencyDigest(nativeCaseScope, { v: 1 }).digest,
      },
    });

    for (let i = 0; i < 5; i += 1) {
      ledger.creditPass({ cellKey: bannerKey, dependencyDigests: bannerDigests });
    }
    ledger.creditPass({ cellKey: nativeKey, dependencyDigests: nativeDigests });
    ledger.creditRetainedFailure({
      cellKey: nativeKey,
      dependencyDigests: nativeDigests,
      detail: 'irreproducible',
    });
    // Later shard failure on native does not erase banner credits.
    assert.equal(ledger.cellStatus(bannerKey).validPasses, 5);
    assert.equal(ledger.cellStatus(nativeKey).retainedFailures, 1);

    ledger.creditSuite({ configuration: 'android-nextgen', outcome: 'pass' });
    ledger.creditSuite({ configuration: 'android-nextgen', outcome: 'fail' });
    const suiteBefore = ledger.suiteSignal('android-nextgen');
    assert.equal(suiteBefore.independentOfPerCell, true);
    assert.equal(suiteBefore.creditedSuitePasses, 1);
    assert.equal(suiteBefore.suiteFailures, 1);

    const invalidation = ledger.invalidateScopeAndFreezeEpoch(nativeCaseScope, {
      reason: 'reviewed-fix',
      matchingDigest: nativeDigests[nativeCaseScope],
    });
    assert.equal(invalidation.invalidatedCredits, 2);
    assert.equal(invalidation.newEpoch, 2);
    assert.equal(ledger.cellStatus(bannerKey).validPasses, 5);
    assert.equal(ledger.cellStatus(nativeKey).validPasses, 0);
    assert.equal(ledger.cellStatus(nativeKey).retainedFailures, 0);
    // Suite signal remains independent and is not wiped by cell-scope invalidation.
    assert.deepEqual(ledger.suiteSignal('android-nextgen'), {
      ...suiteBefore,
      epoch: 2,
    });

    const projection = ledger.projection();
    assert.equal(projection.authoritative, false);
    assert.equal(projection.disclaimer, STATS_PROJECTION_DISCLAIMER);
    assert.equal(projection.schedule.some(row => row.cellKey.cellId === 'banner'), true);
  });

  test('invalidating an iOS cell leaves the Android Next-Gen cell valid', () => {
    const ledger = createEvidenceLedger();
    const iosKey = {
      configuration: 'ios' as const,
      cellKind: 'test' as const,
      cellId: 'banner',
    };
    const androidKey = {
      configuration: 'android-nextgen' as const,
      cellKind: 'test' as const,
      cellId: 'banner',
    };
    const iosDigests = defaultCellDependencyDigests({
      cellKey: iosKey,
      layoutDigest: 'layout-a',
    });
    const androidDigests = defaultCellDependencyDigests({
      cellKey: androidKey,
      layoutDigest: 'layout-a',
    });
    assert.notEqual(cellDependencyScopeId(iosKey), cellDependencyScopeId(androidKey));
    assert.equal(iosDigests[cellDependencyScopeId(iosKey)] != null, true);
    assert.equal(androidDigests[cellDependencyScopeId(androidKey)] != null, true);

    for (let i = 0; i < 3; i += 1) {
      ledger.creditPass({ cellKey: iosKey, dependencyDigests: iosDigests });
      ledger.creditPass({ cellKey: androidKey, dependencyDigests: androidDigests });
    }

    const invalidation = ledger.invalidateScopeAndFreezeEpoch(
      cellDependencyScopeId(iosKey),
      { reason: 'reviewed-ios-banner-fix' },
    );
    assert.equal(invalidation.invalidatedCredits, 3);
    assert.equal(ledger.cellStatus(iosKey).validPasses, 0);
    assert.equal(ledger.cellStatus(androidKey).validPasses, 3);
  });

  test('freezeEpoch stores reason without dropping credits; policy restart uses policy scope', () => {
    const ledger = createEvidenceLedger();
    const cellKey = {
      configuration: 'ios' as const,
      cellKind: 'startup' as const,
      cellId: 'session-create',
    };
    const digests = defaultCellDependencyDigests({
      cellKey,
      layoutDigest: 'layout-a',
    });
    ledger.creditPass({ cellKey, dependencyDigests: digests });
    assert.equal(ledger.epoch(), 1);

    const nextEpoch = ledger.freezeEpoch('bookkeeping-only');
    assert.equal(nextEpoch, 2);
    assert.equal(ledger.lastEpochFreezeReason(), 'bookkeeping-only');
    assert.equal(ledger.cellStatus(cellKey).validPasses, 1);

    const policyRestart = ledger.invalidateScopeAndFreezeEpoch('policy', {
      reason: 'policy-restart',
    });
    assert.equal(policyRestart.invalidatedCredits, 1);
    assert.equal(policyRestart.newEpoch, 3);
    assert.equal(ledger.cellStatus(cellKey).validPasses, 0);
  });
});

describe('campaign and worker statistical surfaces', () => {
  test('runStatsPilot proves scoped invalidation and non-authoritative projection', async () => {
    const result = await runStatsPilot();
    assert.equal(result.zeroFailureTarget, 2995);
    assert.equal(result.checkpointsLocked, PRE_REGISTERED_FAILURE_CHECKPOINTS.length);
    assert.equal(result.unaffectedCellStillValid, true);
    assert.equal(result.invalidatedCredits >= 1, true);
    assert.equal(result.suiteIndependent, true);
    assert.equal(result.projectionAuthoritative, false);
    assert.equal(result.projectionDisclaimer, STATS_PROJECTION_DISCLAIMER);
  });

  test('campaign controller refuses classic statistical credits', () => {
    const controller = createCampaignController({
      mode: 'qualify',
      layoutKind: 'final',
      slotSet: { android: [1], ios: [] },
      dryRun: true,
      allowForceAcquire: false,
      receiptRoot: mkdtempSync(path.join(tmpdir(), 'rngma-stats-ctrl-')),
      logRoot: mkdtempSync(path.join(tmpdir(), 'rngma-stats-logs-')),
    });
    assert.equal(
      controller.creditObservation({
        platform: 'android',
        backend: 'classic',
        cellKind: 'test',
        cellId: 'banner',
        outcome: 'pass',
        layoutDigest: 'x',
      }),
      null,
    );
    assert.equal(
      controller.creditObservation({
        platform: 'android',
        backend: 'nextgen',
        cellKind: 'startup',
        cellId: 'session-create',
        outcome: 'pass',
        layoutDigest: 'x',
      })?.valid,
      true,
    );
    assert.equal(controller.statsProjection().authoritative, false);
  });

  test('qualify worker projects statistical credits without authoritative dashboard claim', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-stats-worker-'));
    const layout = buildReliabilityLayout('temporary', SMOKE_SHARDS, {
      temporaryShardIds: [SMOKE_SHARDS[0]!.id],
      id: 'stats-temp',
    });
    const evidence = createEvidenceLedger();
    const summary = await runReliabilityWorker(
      {
        mode: 'qualify',
        platform: 'android',
        slot: 1,
        layoutKind: 'temporary',
        iterations: 1,
        receiptRoot: root,
        logRoot: path.join(root, 'logs'),
        dryRun: true,
        allowForceAcquire: false,
        androidBackend: 'nextgen',
        layout,
      },
      { runner: createDryRunReliabilityRunner(), evidence },
    );
    assert.equal(summary.statsProjection.authoritative, false);
    assert.equal(summary.statsProjection.disclaimer, STATS_PROJECTION_DISCLAIMER);
    assert.equal(summary.statsProjection.cells.length > 0, true);
    assert.equal(
      summary.statsProjection.cells.every(cell => cell.cellKey.configuration === 'android-nextgen'),
      true,
    );
    // Temporary layout does not mint suite signal (final-layout only).
    assert.equal(summary.statsProjection.suites.every(suite => suite.creditedSuitePasses === 0), true);
    const credits = evidence.listCredits({ validOnly: true });
    assert.equal(credits.length > 0, true);
    assert.equal(
      credits.every(credit => typeof credit.receiptId === 'string' && credit.receiptId.length > 0),
      true,
    );
    assert.equal(
      credits.some(credit => credit.cellKey.cellKind === 'startup' && credit.receiptId != null),
      true,
    );
    assert.equal(
      credits.every(credit => {
        const cellScope = cellDependencyScopeId(credit.cellKey);
        return credit.dependencyDigests[cellScope] != null;
      }),
      true,
    );
  });

  test('diagnose and burn-in workers mint zero statistical cell credits', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-stats-nonqualify-'));
    const layout = buildReliabilityLayout('temporary', SMOKE_SHARDS, {
      temporaryShardIds: [SMOKE_SHARDS[0]!.id],
      id: 'stats-nonqualify',
    });

    for (const mode of ['diagnose', 'burn-in'] as const) {
      const evidence = createEvidenceLedger();
      const summary = await runReliabilityWorker(
        {
          mode,
          platform: 'android',
          slot: 1,
          layoutKind: 'temporary',
          iterations: 1,
          receiptRoot: path.join(root, `${mode}-receipts`),
          logRoot: path.join(root, `${mode}-logs`),
          dryRun: true,
          allowForceAcquire: false,
          androidBackend: 'nextgen',
          layout,
        },
        { runner: createDryRunReliabilityRunner(), evidence },
      );
      assert.equal(evidence.listCredits().length, 0, `${mode} minted statistical credits`);
      assert.equal(summary.statsProjection.cells.length, 0, `${mode} projected statistical cells`);
      assert.equal(summary.credited.startup, 0);
      assert.equal(summary.credited.preamble, 0);
      assert.equal(summary.credited.test, 0);
    }
  });
});
