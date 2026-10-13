/**
 * Dependency digests and scoped evidence invalidation for statistical
 * qualification. Receipt JSONL stays append-only; this ledger projects which
 * credits remain valid in the active epoch without erasing earlier rows.
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  evaluateCellQualification,
  isQualifyingConfiguration,
  scheduleQualificationWork,
  STATS_PROJECTION_DISCLAIMER,
  type CellQualificationStatus,
  type QualifyingConfiguration,
  type ScheduledQualificationWork,
  type StatCellKey,
  type StatsProjection,
  type SuiteSignal,
  QUALIFICATION_POLICY,
  statCellKeyString,
} from './reliabilityStats.ts';
import type { ReceiptCellKind } from './reliabilityReceipts.ts';

export type DependencyDigestMap = Readonly<Record<string, string>>;

/** Stable sha256 over a canonical JSON payload for a named dependency scope. */
export function dependencyDigest(
  scopeId: string,
  payload: unknown,
): { scopeId: string; digest: string } {
  if (scopeId.trim() === '') {
    throw new Error('dependency scopeId must be non-empty.');
  }
  const canonical = JSON.stringify({ scopeId, payload });
  return {
    scopeId,
    digest: createHash('sha256').update(canonical).digest('hex'),
  };
}

export function digestsFromEntries(
  entries: ReadonlyArray<{ scopeId: string; payload: unknown }>,
): DependencyDigestMap {
  const out: Record<string, string> = {};
  for (const entry of entries) {
    const { scopeId, digest } = dependencyDigest(entry.scopeId, entry.payload);
    if (out[scopeId] != null) {
      throw new Error(`Duplicate dependency scopeId "${scopeId}".`);
    }
    out[scopeId] = digest;
  }
  return out;
}

/**
 * Configuration-qualified cell dependency scope. Invalidating an iOS cell must
 * not match the Android Next-Gen cell with the same kind/id.
 */
export function cellDependencyScopeId(cellKey: StatCellKey): string {
  return `cell:${cellKey.configuration}:${cellKey.cellKind}:${cellKey.cellId}`;
}

/**
 * Configuration-qualified case dependency scope for optional extras.
 */
export function caseDependencyScopeId(
  configuration: QualifyingConfiguration,
  caseId: string,
): string {
  return `case:${configuration}:${caseId}`;
}

/**
 * Default scopes attached to a cell credit. Operators may add case-/native-
 * specific digests (prefer {@link caseDependencyScopeId}); invalidation matches
 * on scopeId presence.
 */
export function defaultCellDependencyDigests(input: {
  cellKey: StatCellKey;
  layoutDigest: string;
  policyDigest?: string;
  extra?: DependencyDigestMap;
}): DependencyDigestMap {
  const base = digestsFromEntries([
    {
      scopeId: 'policy',
      payload: input.policyDigest ?? QUALIFICATION_POLICY,
    },
    {
      scopeId: 'layout',
      payload: { digest: input.layoutDigest },
    },
    {
      scopeId: `configuration:${input.cellKey.configuration}`,
      payload: { configuration: input.cellKey.configuration },
    },
    {
      scopeId: cellDependencyScopeId(input.cellKey),
      payload: {
        configuration: input.cellKey.configuration,
        cellKind: input.cellKey.cellKind,
        cellId: input.cellKey.cellId,
      },
    },
  ]);
  return { ...base, ...(input.extra ?? {}) };
}

export type EvidenceCredit = {
  creditId: string;
  receiptId?: string;
  cellKey: StatCellKey;
  epoch: number;
  outcome: 'pass' | 'fail';
  /**
   * Failures that remain in the statistical sample (unknown or irreproducible
   * retained). Root-caused failures that trigger scoped invalidation should
   * not be credited as retained sample failures after the reviewed fix.
   */
  retainedInSample: boolean;
  dependencyDigests: DependencyDigestMap;
  /** False after scoped invalidation of a matching dependency. */
  valid: boolean;
  recordedAt: string;
  detail?: string;
};

export type InvalidateScopeResult = {
  previousEpoch: number;
  newEpoch: number;
  invalidatedCredits: number;
  affectedCells: StatCellKey[];
  scopeId: string;
};

export type EvidenceLedger = {
  epoch(): number;
  credit(input: {
    cellKey: StatCellKey;
    outcome: 'pass' | 'fail';
    retainedInSample?: boolean;
    dependencyDigests: DependencyDigestMap;
    receiptId?: string;
    detail?: string;
    recordedAt?: string;
    creditId?: string;
  }): EvidenceCredit;
  /**
   * Credit an independent cell observation. A later shard failure calling this
   * for another cell never flips prior credits' `valid` flag.
   */
  creditPass(input: {
    cellKey: StatCellKey;
    dependencyDigests: DependencyDigestMap;
    receiptId?: string;
    detail?: string;
  }): EvidenceCredit;
  /** Retain an irreproducible failure in-sample without erasing prior passes. */
  creditRetainedFailure(input: {
    cellKey: StatCellKey;
    dependencyDigests: DependencyDigestMap;
    receiptId?: string;
    detail?: string;
  }): EvidenceCredit;
  /** Full final-layout suite outcome (separate from per-cell confidence). */
  creditSuite(input: {
    configuration: QualifyingConfiguration;
    outcome: 'pass' | 'fail';
    detail?: string;
  }): SuiteSignal;
  /**
   * Invalidate only credits that list `scopeId` in their dependency digests,
   * then freeze a new epoch. Unaffected cells keep valid credits.
   */
  invalidateScopeAndFreezeEpoch(
    scopeId: string,
    options?: { reason?: string; matchingDigest?: string },
  ): InvalidateScopeResult;
  /**
   * Advance epoch identity without invalidating credits. Optional `reason` is
   * retained for ledger bookkeeping only — it does not drop evidence.
   * Policy/layout restarts that must drop matching credits use
   * {@link invalidateScopeAndFreezeEpoch} on `policy`, `layout`, or another
   * dependency scope — never this no-op-invalidation freeze alone.
   */
  freezeEpoch(reason?: string): number;
  /** Most recent {@link freezeEpoch} reason, if any. */
  lastEpochFreezeReason(): string | undefined;
  cellStatus(key: StatCellKey): CellQualificationStatus;
  listCellStatuses(configuration?: QualifyingConfiguration): CellQualificationStatus[];
  suiteSignal(configuration: QualifyingConfiguration): SuiteSignal;
  listSuiteSignals(): SuiteSignal[];
  schedule(): ScheduledQualificationWork[];
  /**
   * Non-authoritative in-memory projection for pilots/tests. Campaign dashboards
   * must go through `reliabilityDashboard` (ledger-derived); only pilot/live
   * ledgers with credits promote statistical counts there.
   */
  projection(): StatsProjection;
  listCredits(filter?: { validOnly?: boolean; cellKey?: StatCellKey }): EvidenceCredit[];
};

type SuiteCounters = {
  configuration: QualifyingConfiguration;
  creditedSuitePasses: number;
  suiteFailures: number;
};

export function createEvidenceLedger(
  options: {
    now?: () => Date;
    createCreditId?: () => string;
    initialEpoch?: number;
  } = {},
): EvidenceLedger {
  const now = options.now ?? (() => new Date());
  const nextCreditId = options.createCreditId ?? (() => `ev_${randomUUID().replace(/-/g, '')}`);
  let epoch = options.initialEpoch ?? 1;
  let lastEpochFreezeReason: string | undefined;
  const credits: EvidenceCredit[] = [];
  const suites = new Map<QualifyingConfiguration, SuiteCounters>();

  function ensureSuite(configuration: QualifyingConfiguration): SuiteCounters {
    const existing = suites.get(configuration);
    if (existing) return existing;
    const created: SuiteCounters = {
      configuration,
      creditedSuitePasses: 0,
      suiteFailures: 0,
    };
    suites.set(configuration, created);
    return created;
  }

  function assertQualifyingCell(cellKey: StatCellKey): void {
    if (!isQualifyingConfiguration(cellKey.configuration)) {
      throw new Error(
        `Evidence ledger accepts only qualifying configurations; received "${cellKey.configuration}".`,
      );
    }
    if (cellKey.cellId.trim() === '') {
      throw new Error('cellId must be non-empty.');
    }
  }

  function aggregate(key: StatCellKey): {
    validPasses: number;
    retainedFailures: number;
  } {
    let validPasses = 0;
    let retainedFailures = 0;
    const id = statCellKeyString(key);
    // Count every still-valid credit across epochs. Freezing a new epoch after
    // a reviewed fix must not erase unaffected cells' earlier receipts.
    for (const credit of credits) {
      if (!credit.valid) continue;
      if (statCellKeyString(credit.cellKey) !== id) continue;
      if (credit.outcome === 'pass') {
        validPasses += 1;
      } else if (credit.retainedInSample) {
        retainedFailures += 1;
      }
    }
    return { validPasses, retainedFailures };
  }

  const api: EvidenceLedger = {
    epoch() {
      return epoch;
    },
    credit(input) {
      assertQualifyingCell(input.cellKey);
      const retainedInSample =
        input.outcome === 'fail' ? (input.retainedInSample ?? true) : false;
      const row: EvidenceCredit = {
        creditId: input.creditId ?? nextCreditId(),
        ...(input.receiptId != null ? { receiptId: input.receiptId } : {}),
        cellKey: input.cellKey,
        epoch,
        outcome: input.outcome,
        retainedInSample,
        dependencyDigests: { ...input.dependencyDigests },
        valid: true,
        recordedAt: input.recordedAt ?? now().toISOString(),
        ...(input.detail != null ? { detail: input.detail } : {}),
      };
      credits.push(row);
      return row;
    },
    creditPass(input) {
      return api.credit({
        ...input,
        outcome: 'pass',
        retainedInSample: false,
      });
    },
    creditRetainedFailure(input) {
      return api.credit({
        ...input,
        outcome: 'fail',
        retainedInSample: true,
      });
    },
    creditSuite(input) {
      if (!isQualifyingConfiguration(input.configuration)) {
        throw new Error(
          `Suite signal accepts only qualifying configurations; received "${input.configuration}".`,
        );
      }
      const counters = ensureSuite(input.configuration);
      if (input.outcome === 'pass') {
        counters.creditedSuitePasses += 1;
      } else {
        counters.suiteFailures += 1;
      }
      return api.suiteSignal(input.configuration);
    },
    invalidateScopeAndFreezeEpoch(scopeId, invalidateOptions = {}) {
      if (scopeId.trim() === '') {
        throw new Error('invalidate scopeId must be non-empty.');
      }
      const previousEpoch = epoch;
      const affected = new Map<string, StatCellKey>();
      let invalidatedCredits = 0;
      for (const credit of credits) {
        if (!credit.valid) continue;
        const digest = credit.dependencyDigests[scopeId];
        if (digest == null) continue;
        if (
          invalidateOptions.matchingDigest != null &&
          digest !== invalidateOptions.matchingDigest
        ) {
          continue;
        }
        credit.valid = false;
        if (invalidateOptions.reason != null) {
          credit.detail = [credit.detail, `invalidated:${invalidateOptions.reason}`]
            .filter(Boolean)
            .join('; ');
        }
        invalidatedCredits += 1;
        affected.set(statCellKeyString(credit.cellKey), credit.cellKey);
      }
      epoch += 1;
      return {
        previousEpoch,
        newEpoch: epoch,
        invalidatedCredits,
        affectedCells: [...affected.values()],
        scopeId,
      };
    },
    freezeEpoch(reason) {
      epoch += 1;
      lastEpochFreezeReason = reason;
      return epoch;
    },
    lastEpochFreezeReason() {
      return lastEpochFreezeReason;
    },
    cellStatus(key) {
      assertQualifyingCell(key);
      const { validPasses, retainedFailures } = aggregate(key);
      return evaluateCellQualification({
        cellKey: key,
        epoch,
        validPasses,
        retainedFailures,
      });
    },
    listCellStatuses(configuration) {
      const seen = new Map<string, StatCellKey>();
      for (const credit of credits) {
        if (configuration != null && credit.cellKey.configuration !== configuration) {
          continue;
        }
        seen.set(statCellKeyString(credit.cellKey), credit.cellKey);
      }
      return [...seen.values()]
        .map(key => api.cellStatus(key))
        .sort((a, b) =>
          statCellKeyString(a.cellKey).localeCompare(statCellKeyString(b.cellKey)),
        );
    },
    suiteSignal(configuration) {
      const counters = ensureSuite(configuration);
      return {
        configuration,
        epoch,
        creditedSuitePasses: counters.creditedSuitePasses,
        suiteFailures: counters.suiteFailures,
        independentOfPerCell: true,
      };
    },
    listSuiteSignals() {
      return (['android-nextgen', 'ios'] as const).map(configuration =>
        api.suiteSignal(configuration),
      );
    },
    schedule() {
      return scheduleQualificationWork(api.listCellStatuses());
    },
    projection() {
      const cells = api.listCellStatuses();
      return {
        kind: 'manual-untested-projection',
        authoritative: false,
        disclaimer: STATS_PROJECTION_DISCLAIMER,
        policy: QUALIFICATION_POLICY,
        epoch,
        cells,
        suites: api.listSuiteSignals(),
        schedule: scheduleQualificationWork(cells),
      };
    },
    listCredits(filter = {}) {
      return credits.filter(credit => {
        if (filter.validOnly && !credit.valid) return false;
        if (
          filter.cellKey != null &&
          statCellKeyString(credit.cellKey) !== statCellKeyString(filter.cellKey)
        ) {
          return false;
        }
        return true;
      });
    },
  };

  return api;
}

/** Helper for worker/campaign wiring of a receipt-backed cell key. */
export function qualifyingCellKey(input: {
  configuration: QualifyingConfiguration;
  cellKind: ReceiptCellKind;
  cellId: string;
}): StatCellKey {
  return {
    configuration: input.configuration,
    cellKind: input.cellKind,
    cellId: input.cellId,
  };
}
