/**
 * Intermittent-failure reducer: isolate failing tests and probabilistically
 * shrink co-running context to expose order/context pollution.
 */

import {
  buildFailureArtifact,
  openFailureArtifactStore,
  type FailureArtifact,
  type FailureArtifactStore,
} from './reliabilityFailureArtifacts.ts';
import {
  createRiskLedger,
  scheduleByRisk,
  type RiskLedger,
  type ScheduledUnit,
} from './reliabilityRisk.ts';

export type ReducedContext = {
  /** Failing case under investigation. */
  focusCaseId: string;
  platform: 'android' | 'ios';
  /** Neighbor case ids retained in this reduced run (may be empty = isolated). */
  retainedNeighbors: readonly string[];
  /** Full neighbor set observed at the original failure. */
  originalNeighbors: readonly string[];
  /** Inclusion probability used to sample retainedNeighbors. */
  retentionProbability: number;
  kind: 'isolated' | 'probabilistic';
};

export type FlakeReducerOptions = {
  artifactRoot: string;
  ledger?: RiskLedger;
  /** Default Bernoulli retention probability for neighbors (0..1). */
  defaultRetentionProbability?: number;
  /** Injected RNG in [0, 1); tests pass a deterministic source. */
  random?: () => number;
  now?: () => Date;
};

export type ReduceFailureInput = {
  caseId: string;
  platform: 'android' | 'ios';
  detail?: string;
  neighbors?: readonly string[];
  shardId?: string;
  jobId?: string;
  iteration?: number;
  logPath?: string;
  retentionProbability?: number;
};

export type ReduceFailureResult = {
  artifact: FailureArtifact;
  artifactPath: string;
  cell: ReturnType<RiskLedger['recordFailure']>;
  /** Immediate isolation plan (no neighbors). */
  isolated: ReducedContext;
  /** One probabilistic reduction sample for the next diagnose attempt. */
  probabilistic: ReducedContext;
};

export type FlakeReducer = {
  ledger: RiskLedger;
  artifacts: FailureArtifactStore;
  /**
   * Record a failure: persist exact artifact, mark risk red, and emit isolation
   * plus probabilistic context-reduction plans.
   */
  reduceFailure(input: ReduceFailureInput): ReduceFailureResult;
  /** Record a pass against the risk ledger at individual scope. */
  recordPass(
    caseId: string,
    platform: 'android' | 'ios',
    scope?: 'individual' | 'candidate-shard' | 'final-layout',
  ): ReturnType<RiskLedger['recordPass']>;
  /**
   * Build a risk-aware schedule for the given cases (isolated high-risk first,
   * affinity groups for low-risk).
   */
  schedule(platform: 'android' | 'ios', caseIds: readonly string[]): ScheduledUnit[];
  /**
   * Sample a reduced neighbor set. Probability 0 ⇒ isolated; 1 ⇒ keep all.
   * Deterministic when `random` is injected.
   */
  sampleReducedNeighbors(
    neighbors: readonly string[],
    retentionProbability: number,
  ): readonly string[];
};

function assertProbability(value: number, label: string): void {
  if (!(value >= 0 && value <= 1)) {
    throw new Error(`${label} must be in [0, 1]; received ${value}.`);
  }
}

export function createFlakeReducer(options: FlakeReducerOptions): FlakeReducer {
  const defaultRetentionProbability = options.defaultRetentionProbability ?? 0.5;
  assertProbability(defaultRetentionProbability, 'defaultRetentionProbability');
  const random = options.random ?? Math.random;
  const ledger = options.ledger ?? createRiskLedger();
  const artifacts = openFailureArtifactStore(options.artifactRoot);
  const now = options.now ?? (() => new Date());

  function sampleReducedNeighbors(
    neighbors: readonly string[],
    retentionProbability: number,
  ): readonly string[] {
    assertProbability(retentionProbability, 'retentionProbability');
    if (neighbors.length === 0 || retentionProbability === 0) {
      return [];
    }
    if (retentionProbability === 1) {
      return [...neighbors];
    }
    return neighbors.filter(() => random() < retentionProbability);
  }

  return {
    ledger,
    artifacts,
    sampleReducedNeighbors,
    reduceFailure(input) {
      const neighbors = input.neighbors ?? [];
      const retentionProbability =
        input.retentionProbability ?? defaultRetentionProbability;
      assertProbability(retentionProbability, 'retentionProbability');

      const artifact = buildFailureArtifact({
        caseId: input.caseId,
        platform: input.platform,
        detail: input.detail,
        neighbors,
        shardId: input.shardId,
        jobId: input.jobId,
        iteration: input.iteration,
        logPath: input.logPath,
        recordedAt: now().toISOString(),
      });
      const artifactPath = artifacts.write(artifact);
      const cell = ledger.recordFailure(
        { caseId: input.caseId, platform: input.platform },
        artifact.signature,
      );

      const isolated: ReducedContext = {
        focusCaseId: input.caseId,
        platform: input.platform,
        retainedNeighbors: [],
        originalNeighbors: neighbors,
        retentionProbability: 0,
        kind: 'isolated',
      };
      const retained = sampleReducedNeighbors(neighbors, retentionProbability);
      const probabilistic: ReducedContext = {
        focusCaseId: input.caseId,
        platform: input.platform,
        retainedNeighbors: retained,
        originalNeighbors: neighbors,
        retentionProbability,
        kind: retained.length === 0 ? 'isolated' : 'probabilistic',
      };

      return { artifact, artifactPath, cell, isolated, probabilistic };
    },
    recordPass(caseId, platform, scope = 'individual') {
      return ledger.recordPass({ caseId, platform }, scope);
    },
    schedule(platform, caseIds) {
      return scheduleByRisk({ platform, caseIds, ledger });
    },
  };
}

/**
 * Convert a reduced context into the case list for the next diagnose shard.
 * Focus case is always first so mocha-bail still surfaces it.
 */
export function caseIdsForReducedContext(context: ReducedContext): string[] {
  return [context.focusCaseId, ...context.retainedNeighbors.filter(
    caseId => caseId !== context.focusCaseId,
  )];
}
