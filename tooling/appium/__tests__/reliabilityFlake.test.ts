import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import {
  createCampaignController,
  runRiskPilot,
} from '../src/reliabilityCampaign.ts';
import { createCircuitBreaker } from '../src/reliabilityCircuitBreaker.ts';
import {
  buildFailureArtifact,
  classifyFailureDetail,
  failureSignature,
  flakeInterstitialCommitSubject,
  normalizeFailureDetail,
  openFailureArtifactStore,
} from '../src/reliabilityFailureArtifacts.ts';
import {
  caseIdsForReducedContext,
  createFlakeReducer,
} from '../src/reliabilityReducer.ts';
import {
  RISK_THRESHOLDS,
  createRiskLedger,
  deriveRiskColor,
  evaluateBurnInGate,
  evaluateBurnInSuiteGate,
  greenScopeForWorkerPass,
  isRejectedRootCauseClaim,
  scheduleByRisk,
} from '../src/reliabilityRisk.ts';

describe('risk ledger and scheduler', () => {
  test('greenScopeForWorkerPass scopes isolated / candidate / final by mode', () => {
    assert.equal(
      greenScopeForWorkerPass({
        mode: 'qualify',
        layoutKind: 'final',
        coRunCaseCount: 1,
      }),
      'individual',
    );
    assert.equal(
      greenScopeForWorkerPass({
        mode: 'qualify',
        layoutKind: 'temporary',
        coRunCaseCount: 4,
      }),
      'candidate-shard',
    );
    assert.equal(
      greenScopeForWorkerPass({
        mode: 'qualify',
        layoutKind: 'final',
        coRunCaseCount: 4,
      }),
      'final-layout',
    );
    assert.equal(
      greenScopeForWorkerPass({
        mode: 'burn-in',
        layoutKind: 'final',
        coRunCaseCount: 4,
      }),
      'final-layout',
    );
    assert.equal(
      greenScopeForWorkerPass({
        mode: 'diagnose',
        layoutKind: 'final',
        coRunCaseCount: 4,
      }),
      'candidate-shard',
    );
    assert.equal(
      greenScopeForWorkerPass({
        mode: 'burn-in',
        layoutKind: 'temporary',
        coRunCaseCount: 4,
      }),
      'candidate-shard',
    );
  });

  test('progresses red → amber → green → qualification-ready on consecutive greens', () => {
    const ledger = createRiskLedger();
    const key = { caseId: 'banner', platform: 'android' as const };
    assert.equal(ledger.get(key).color, 'red');

    for (let i = 0; i < RISK_THRESHOLDS.amberIndividualGreens; i += 1) {
      ledger.recordPass(key, 'individual');
    }
    assert.equal(ledger.get(key).color, 'amber');

    for (
      let i = 0;
      i < RISK_THRESHOLDS.greenCandidateShardGreens;
      i += 1
    ) {
      ledger.recordPass(key, 'candidate-shard');
    }
    assert.equal(ledger.get(key).color, 'green');

    for (
      let i = 0;
      i < RISK_THRESHOLDS.qualificationReadyFinalLayoutGreens;
      i += 1
    ) {
      ledger.recordPass(key, 'final-layout');
    }
    assert.equal(ledger.get(key).color, 'qualification-ready');
  });

  test('any failure resets counters and forces red until cleared', () => {
    const ledger = createRiskLedger();
    const key = { caseId: 'rewarded', platform: 'ios' as const };
    for (let i = 0; i < 15; i += 1) {
      ledger.recordPass(key, 'individual');
    }
    assert.equal(ledger.get(key).color, 'amber');
    const failed = ledger.recordFailure(key, 'sig-abc');
    assert.equal(failed.color, 'red');
    assert.equal(failed.consecutiveIndividualGreens, 0);
    assert.equal(failed.unresolvedFailure, true);
    assert.equal(failed.lastFailureSignature, 'sig-abc');
    assert.equal(
      deriveRiskColor({ ...failed, unresolvedFailure: true }),
      'red',
    );
    ledger.clearUnresolvedFailure(key);
    assert.equal(ledger.get(key).color, 'red');
    assert.equal(ledger.get(key).unresolvedFailure, false);
  });

  test('schedules high-risk isolated first and affinity-groups low-risk', () => {
    const ledger = createRiskLedger();
    for (let i = 0; i < 30; i += 1) {
      ledger.recordPass({ caseId: 'banner', platform: 'android' }, 'candidate-shard');
      ledger.recordPass({ caseId: 'native', platform: 'android' }, 'candidate-shard');
      ledger.recordPass({ caseId: 'fluid', platform: 'android' }, 'candidate-shard');
    }
    ledger.recordFailure({ caseId: 'rewarded', platform: 'android' }, 'x');

    const units = scheduleByRisk({
      platform: 'android',
      caseIds: ['banner', 'rewarded', 'native', 'fluid'],
      ledger,
      affinityGroupSize: 2,
    });
    assert.equal(units[0]!.kind, 'isolated');
    assert.deepEqual(units[0]!.caseIds, ['rewarded']);
    assert.equal(units[0]!.risk, 'red');
    const affinity = units.filter(unit => unit.kind === 'affinity');
    assert.equal(affinity.length >= 1, true);
    assert.equal(
      affinity.every(unit => unit.caseIds.length <= 2),
      true,
    );
    assert.equal(
      affinity.every(unit => !unit.caseIds.includes('rewarded')),
      true,
    );
  });

  test('evaluateBurnInGate reports thresholds and suite closed only when ready', () => {
    const ledger = createRiskLedger();
    const key = { caseId: 'banner', platform: 'android' as const };
    let decision = evaluateBurnInGate(ledger.get(key));
    assert.equal(decision.color, 'red');
    assert.equal(decision.affinityEligible, false);
    assert.equal(decision.qualificationReady, false);
    assert.equal(decision.progress.nextColor, 'amber');
    assert.equal(decision.progress.remaining, RISK_THRESHOLDS.amberIndividualGreens);

    for (let i = 0; i < RISK_THRESHOLDS.amberIndividualGreens; i += 1) {
      ledger.recordPass(key, 'individual');
    }
    decision = evaluateBurnInGate(ledger.get(key));
    assert.equal(decision.color, 'amber');
    assert.equal(decision.progress.nextColor, 'green');
    assert.equal(
      decision.progress.remaining,
      RISK_THRESHOLDS.greenCandidateShardGreens,
    );

    for (let i = 0; i < RISK_THRESHOLDS.greenCandidateShardGreens; i += 1) {
      ledger.recordPass(key, 'candidate-shard');
    }
    decision = evaluateBurnInGate(ledger.get(key));
    assert.equal(decision.color, 'green');
    assert.equal(decision.affinityEligible, true);
    assert.equal(decision.progress.nextColor, 'qualification-ready');

    for (
      let i = 0;
      i < RISK_THRESHOLDS.qualificationReadyFinalLayoutGreens;
      i += 1
    ) {
      ledger.recordPass(key, 'final-layout');
    }
    decision = evaluateBurnInGate(ledger.get(key));
    assert.equal(decision.qualificationReady, true);
    assert.equal(decision.progress.remaining, 0);

    const openSuite = evaluateBurnInSuiteGate([
      ledger.get(key),
      ledger.get({ caseId: 'rewarded', platform: 'android' }),
    ]);
    assert.equal(openSuite.closed, false);
    assert.equal(openSuite.blocking.length, 1);
    assert.equal(openSuite.blocking[0]!.reason, 'below-threshold');

    const closedSuite = evaluateBurnInSuiteGate([ledger.get(key)]);
    assert.equal(closedSuite.closed, true);
    assert.equal(evaluateBurnInSuiteGate([]).closed, false);
  });

  test('rejects host-load root-cause claims and names durable interstitial subjects', () => {
    assert.equal(isRejectedRootCauseClaim('host load caused the flake'), true);
    assert.equal(isRejectedRootCauseClaim('CPU pressure on the Mac'), true);
    assert.equal(isRejectedRootCauseClaim('timeout waiting for assertion'), false);
    assert.equal(
      classifyFailureDetail('failed because of host load / CPU pressure'),
      'unknown',
    );
    const hostLoadArtifact = buildFailureArtifact({
      caseId: 'rewarded',
      platform: 'android',
      detail: 'failed because of host load / CPU pressure on the Mac',
      createArtifactId: () => 'fail_host_load',
    });
    assert.equal(hostLoadArtifact.rejectedRootCauseClaim, true);
    assert.equal(hostLoadArtifact.classification, 'unknown');
    const subject = flakeInterstitialCommitSubject({
      caseId: 'gma.format.rewarded',
      classification: 'assertion',
      signature: 'abcdef0123456789',
    });
    assert.equal(
      subject,
      'fix(appium): harden format-rewarded after assertion (abcdef01)',
    );
    assert.equal(/ED-\d+/i.test(subject), false);
  });
});

describe('failure artifacts', () => {
  test('normalizes volatile detail and classifies ad-service failures', () => {
    assert.equal(
      classifyFailureDetail('ERROR_CODE_NO_FILL inventory exhausted'),
      'ad-service',
    );
    assert.equal(
      classifyFailureDetail('timeout waiting for assertion toHaveText'),
      'assertion',
    );
    const normalized = normalizeFailureDetail(
      'fail job_abcdef123 path /tmp/rngma-e2e/abc lease_android_1',
    );
    assert.match(normalized, /job_\*/);
    assert.match(normalized, /<path>/);
    assert.match(normalized, /lease_\*/);

    const a = failureSignature({
      caseId: 'rewarded',
      platform: 'android',
      classification: 'ad-service',
      detail: 'ERROR_CODE_NO_FILL at /tmp/one',
    });
    const b = failureSignature({
      caseId: 'rewarded',
      platform: 'android',
      classification: 'ad-service',
      detail: 'ERROR_CODE_NO_FILL at /tmp/two',
    });
    assert.equal(a, b);
  });

  test('persists exact artifacts with neighbors and log pointers', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-fail-art-'));
    const store = openFailureArtifactStore(root);
    const artifact = buildFailureArtifact({
      caseId: 'interstitial',
      platform: 'ios',
      detail: 'ERROR_CODE_NETWORK_ERROR',
      neighbors: ['banner', 'native'],
      logPath: '/tmp/shard.log',
      jobId: 'job_test',
      iteration: 2,
      shardId: 'a-primary',
      createArtifactId: () => 'fail_fixed',
      recordedAt: '2026-10-13T00:00:00.000Z',
    });
    store.write(artifact);
    const loaded = store.read('fail_fixed');
    assert.equal(loaded.classification, 'ad-service');
    assert.equal(loaded.rejectedRootCauseClaim, false);
    assert.deepEqual(loaded.neighbors, ['banner', 'native']);
    assert.equal(loaded.logPath, '/tmp/shard.log');
    assert.equal(store.findBySignature(loaded.signature).length, 1);
    assert.equal(store.findByClusterKey(loaded.clusterKey).length, 1);
    const other = buildFailureArtifact({
      caseId: 'rewarded',
      platform: 'ios',
      detail: 'ERROR_CODE_NETWORK_ERROR',
      createArtifactId: () => 'fail_other',
    });
    assert.equal(other.clusterKey, loaded.clusterKey);
    assert.notEqual(other.signature, loaded.signature);
  });
});

describe('circuit breaker', () => {
  test('trips on correlated ad-service failures across distinct cases', () => {
    let clock = 1000;
    const breaker = createCircuitBreaker({
      distinctCaseThreshold: 3,
      volumeThreshold: 10,
      windowMs: 60_000,
      cooldownMs: 5_000,
      now: () => clock,
    });
    const make = (caseId: string) =>
      buildFailureArtifact({
        caseId,
        platform: 'android',
        detail: 'ERROR_CODE_NO_FILL inventory',
        createArtifactId: () => `fail_${caseId}`,
      });

    assert.equal(breaker.observe(make('a')).state, 'closed');
    assert.equal(breaker.observe(make('b')).state, 'closed');
    const tripped = breaker.observe(make('c'));
    assert.equal(tripped.state, 'open');
    assert.equal(tripped.lastTrip?.kind, 'distinct-cases');
    assert.equal(breaker.shouldPauseCampaign(), true);

    clock += 5_001;
    assert.equal(breaker.maybeHalfOpen().state, 'half-open');
    assert.equal(breaker.observe(make('d')).state, 'open');

    clock += 5_001;
    breaker.maybeHalfOpen();
    assert.equal(breaker.recordSuccess().state, 'closed');
    assert.equal(breaker.shouldPauseCampaign(), false);
  });

  test('ignores non-ad-service classifications by default', () => {
    const breaker = createCircuitBreaker({ distinctCaseThreshold: 2 });
    for (const caseId of ['a', 'b', 'c']) {
      const snap = breaker.observe(
        buildFailureArtifact({
          caseId,
          platform: 'android',
          detail: 'timeout waiting for assertion',
          createArtifactId: () => `fail_${caseId}`,
        }),
      );
      assert.equal(snap.state, 'closed');
    }
  });
});

describe('flake reducer', () => {
  test('isolates failures and samples probabilistic neighbor retention', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-reducer-'));
    const values = [0.1, 0.9, 0.2];
    let index = 0;
    const reducer = createFlakeReducer({
      artifactRoot: root,
      defaultRetentionProbability: 0.5,
      random: () => values[index++] ?? 0,
    });

    const result = reducer.reduceFailure({
      caseId: 'rewarded',
      platform: 'android',
      detail: 'order pollution suspected',
      neighbors: ['banner', 'native', 'fluid'],
    });
    assert.equal(result.cell.color, 'red');
    assert.equal(result.artifact.rejectedRootCauseClaim, false);
    assert.equal(result.isolated.retainedNeighbors.length, 0);
    assert.deepEqual(result.probabilistic.retainedNeighbors, ['banner', 'fluid']);
    assert.deepEqual(caseIdsForReducedContext(result.isolated), ['rewarded']);
    assert.deepEqual(caseIdsForReducedContext(result.probabilistic), [
      'rewarded',
      'banner',
      'fluid',
    ]);
    assert.equal(reducer.artifacts.list().length, 1);

    const hostLoad = reducer.reduceFailure({
      caseId: 'app-open',
      platform: 'android',
      detail: 'flake blamed on host load / system under load',
      neighbors: [],
    });
    assert.equal(hostLoad.artifact.rejectedRootCauseClaim, true);
    assert.equal(hostLoad.artifact.classification, 'unknown');
  });
});

describe('campaign wiring', () => {
  test('noteFailure trips pause and blocks dispatch until resume', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-campaign-risk-'));
    let clock = 1000;
    const controller = createCampaignController(
      {
        mode: 'diagnose',
        layoutKind: 'temporary',
        slotSet: { android: [1], ios: [] },
        dryRun: true,
        allowForceAcquire: false,
        receiptRoot: root,
        logRoot: path.join(root, 'logs'),
        artifactRoot: path.join(root, 'artifacts'),
      },
      { now: () => clock },
    );
    await controller.leases.acquireAll({ dryRun: true, async checkClear() { return true; } });

    for (const caseId of ['a', 'b', 'c']) {
      controller.noteFailure({
        caseId,
        platform: 'android',
        detail: 'ERROR_CODE_NO_FILL',
      });
    }
    assert.equal(controller.circuitState().state, 'open');
    assert.equal(controller.capacity.state, 'paused');
    assert.equal(controller.dispatch({ workItemId: 'x' }, 'w'), null);

    controller.resume();
    const assigned = controller.dispatch({ workItemId: 'y' }, 'w');
    assert.equal(assigned?.workItemId, 'y');
    controller.finish(assigned!.leaseId);
  });

  test('after circuit open, stealExpired reclaims but does not start idle lanes', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-campaign-steal-'));
    let clock = 1000;
    const controller = createCampaignController(
      {
        mode: 'diagnose',
        layoutKind: 'temporary',
        slotSet: { android: [1, 2], ios: [] },
        dryRun: true,
        allowForceAcquire: false,
        receiptRoot: root,
        logRoot: path.join(root, 'logs'),
        artifactRoot: path.join(root, 'artifacts'),
        heartbeatTimeoutMs: 50,
      },
      { now: () => clock },
    );
    await controller.leases.acquireAll({ dryRun: true, async checkClear() { return true; } });
    const [laneA, laneB] = controller.leases.list();
    assert.ok(laneA && laneB);
    controller.heartbeat(laneA.leaseId, 'w1');
    controller.heartbeat(laneB.leaseId, 'w1');
    const running = controller.dispatch({ workItemId: 'job-steal' }, 'w1');
    assert.equal(running?.state, 'owned-running');
    const idleBefore = controller.leases
      .list()
      .find(lease => lease.state === 'owned-idle');
    assert.ok(idleBefore);

    for (const caseId of ['a', 'b', 'c']) {
      controller.noteFailure({
        caseId,
        platform: 'android',
        detail: 'ERROR_CODE_NO_FILL',
      });
    }
    assert.equal(controller.circuitState().state, 'open');
    assert.equal(controller.capacity.state, 'paused');

    clock += 51;
    const steal = controller.stealExpired('stealer');
    assert.equal(steal.stolen?.leaseId, running!.leaseId);
    assert.equal(steal.reassignedTo, null);
    assert.equal(
      controller.leases.list().every(lease => lease.state !== 'owned-running'),
      true,
    );
    assert.equal(
      controller.leases.list().filter(lease => lease.state === 'owned-idle').length,
      2,
    );
    assert.equal(controller.dispatch({ workItemId: 'blocked' }, 'w'), null);
  });

  test('runRiskPilot exercises scheduler reducer circuit breaker and burn-in gate', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-risk-pilot-'));
    const result = await runRiskPilot({
      artifactRoot: root,
      random: () => 0.25,
    });
    assert.equal(result.scheduledIsolated >= 1, true);
    assert.equal(result.scheduledAffinity >= 1, true);
    assert.equal(result.artifactsWritten >= 3, true);
    assert.equal(result.circuitTripped, true);
    assert.equal(result.dispatchBlockedWhileOpen, true);
    assert.equal(result.resumedAcceptingWork, true);
    assert.equal(result.probabilisticNeighbors, 3);
    assert.equal(result.burnInGateClosed, true);
    assert.equal(result.burnInGateCellCount, 1);
    assert.equal(result.burnInGateQualificationReady, 1);
    assert.equal(result.hostLoadClaimRejected, true);
  });
});
