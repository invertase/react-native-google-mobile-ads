/**
 * Ledger-derived reliability campaign dashboard: JSON/Markdown render, integrity
 * checks, resource panel, ETA math, and epoch snapshots under a report root.
 *
 * Statistical counts are authoritative only when the document is ledger-derived
 * and the input ledger is a real pilot/live source with at least one credit.
 * Fixture and empty ledgers keep a clear non-authoritative banner. Canvas
 * mirroring stays deferred until real pilot data exists.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  createEvidenceLedger,
  type EvidenceCredit,
  type EvidenceLedger,
} from './reliabilityEvidence.ts';
import type { OwnershipState } from './reliabilityOwnership.ts';
import type { ReliabilityReceipt } from './reliabilityReceipts.ts';
import type { RiskCellState, RiskColor } from './reliabilityRisk.ts';
import {
  QUALIFICATION_POLICY,
  STATS_PROJECTION_DISCLAIMER,
  evaluateCellQualification,
  isQualifyingConfiguration,
  scheduleQualificationWork,
  statCellKeyString,
  type CellQualificationStatus,
  type QualifyingConfiguration,
  type QualificationPolicy,
  type ScheduledQualificationWork,
  type SuiteSignal,
} from './reliabilityStats.ts';

export const DASHBOARD_SCHEMA_VERSION = 1 as const;

/** Banner retained when the dashboard cannot yet promote statistical counts. */
export const DASHBOARD_NON_AUTHORITATIVE_BANNER = STATS_PROJECTION_DISCLAIMER;

export const DASHBOARD_CANVAS_DEFERRED_REASON =
  'Canvas mirror deferred until a real pilot/live ledger has credits; do not invent qualification counts.' as const;

export type DashboardLedgerSource = 'fixture' | 'pilot' | 'live';

/** Discriminator for EvidenceLedgerSnapshot reload input (`--dashboard-ledger`). */
export const EVIDENCE_LEDGER_SNAPSHOT_KIND = 'evidence-ledger-snapshot' as const;

/**
 * Durable evidence ledger export for `--dashboard-ledger=` refresh.
 * Distinct from DashboardDocument epoch snapshots under `snapshots/epoch-<n>.json`
 * (rendered projection — not reloadable as a ledger).
 */
export type EvidenceLedgerSnapshot = {
  schemaVersion: 1;
  kind: typeof EVIDENCE_LEDGER_SNAPSHOT_KIND;
  epoch: number;
  lastEpochFreezeReason?: string;
  credits: EvidenceCredit[];
  suites: Array<{
    configuration: QualifyingConfiguration;
    creditedSuitePasses: number;
    suiteFailures: number;
  }>;
};

/**
 * Resolve `--dashboard-source` for `--refresh-dashboard`.
 * A ledger file with credits must not become authoritative unless the caller
 * explicitly passes `pilot` or `live`. Omitted source + ledger path => `fixture`.
 * Omitted source + no ledger => `live` (empty; still non-authoritative).
 */
export function resolveRefreshDashboardLedgerSource(input: {
  explicitSource?: string;
  ledgerSnapshotPresent: boolean;
}): DashboardLedgerSource {
  const value = input.explicitSource;
  if (value === 'fixture' || value === 'pilot' || value === 'live') {
    return value;
  }
  if (value != null && value !== '') {
    throw new Error(
      `dashboard-source must be fixture|pilot|live; received "${value}".`,
    );
  }
  return input.ledgerSnapshotPresent ? 'fixture' : 'live';
}

export type DashboardTimingSample = {
  /** Wall duration for the sample window. */
  durationMs: number;
  /** Observations completed in that window (credited cells). */
  observationsCompleted: number;
  recordedAt?: string;
};

export type DashboardResourceSlot = {
  slot: number;
  platform: 'android' | 'ios';
  state: OwnershipState;
  metroPort?: number;
  cacheRoot?: string;
  metroRssBytes?: number | null;
  bundleP95Ms?: number | null;
  deviceAgeDays?: number | null;
};

export type DashboardResourcePanel = {
  slots: DashboardResourceSlot[];
  diskBytes?: number | null;
  diskCeilingBytes?: number | null;
  watchdogs?: Array<{ name: string; status: string; detail?: string }>;
};

export type DashboardCampaignMeta = {
  phase?: string;
  branch?: string;
  baseCommit?: string;
  lastCommitSubject?: string;
  status?: string;
  frozenDigest?: string;
  stopReason?: string;
  hostReadiness?: Record<string, string>;
  coverageProgress?: Record<string, string>;
  acceptedExceptions?: string[];
  blockers?: string[];
};

export type DashboardCellRow = {
  configuration: QualifyingConfiguration;
  cellKind: CellQualificationStatus['cellKey']['cellKind'];
  cellId: string;
  epoch: number;
  rawRuns: number;
  credits: number;
  passes: number;
  fails: number;
  retainedFailures: number;
  validObservations: number;
  requiredObservations: number;
  remaining: number;
  qualified: boolean;
  upperBound: number | null;
  risk: RiskColor | null;
  dependencyDigest: string | null;
  lastFailure: string | null;
};

export type DashboardEta = {
  remainingObservations: number;
  activeLanes: number;
  sampleCount: number;
  throughputPerHour: {
    optimistic: number;
    base: number;
    pessimistic: number;
  } | null;
  durationMs: {
    p50: number;
    p95: number;
  } | null;
  etaMs: {
    optimistic: number | null;
    base: number | null;
    pessimistic: number | null;
  };
  reason: string | null;
};

export type DashboardIntegrityFinding = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
};

export type DashboardIntegrityReport = {
  ok: boolean;
  findings: DashboardIntegrityFinding[];
};

export type DashboardDocument = {
  schemaVersion: typeof DASHBOARD_SCHEMA_VERSION;
  projection: 'ledger-derived';
  ledgerSource: DashboardLedgerSource;
  statisticalCountsAllowed: boolean;
  authoritative: boolean;
  disclaimer: string | null;
  canvas: {
    status: 'deferred';
    reason: typeof DASHBOARD_CANVAS_DEFERRED_REASON;
  };
  generatedAt: string;
  policy: QualificationPolicy;
  epoch: number;
  lastEpochFreezeReason?: string;
  campaign: DashboardCampaignMeta;
  integrity: DashboardIntegrityReport;
  resources: DashboardResourcePanel;
  eta: DashboardEta;
  cells: DashboardCellRow[];
  suites: SuiteSignal[];
  schedule: ScheduledQualificationWork[];
  statisticalCounts: {
    totalValidCredits: number;
    totalRawCredits: number;
    qualifiedCells: number;
    openCells: number;
    remainingObservations: number;
  } | null;
};

export type BuildDashboardInput = {
  evidence: EvidenceLedger;
  /** Provenance of the ledger. Fixture never promotes authority. */
  ledgerSource: DashboardLedgerSource;
  receipts?: readonly ReliabilityReceipt[];
  resources?: DashboardResourcePanel;
  timingSamples?: readonly DashboardTimingSample[];
  riskStates?: readonly RiskCellState[];
  campaign?: DashboardCampaignMeta;
  activeLanes?: number;
  now?: () => Date;
};

/**
 * Authority rule: ledger-derived + real pilot/live source + at least one credit.
 * Empty or fixture ledgers stay non-authoritative (honesty over pretty numbers).
 */
export function resolveDashboardAuthority(input: {
  ledgerSource: DashboardLedgerSource;
  creditCount: number;
}): { authoritative: boolean; disclaimer: string | null; statisticalCountsAllowed: boolean } {
  const hasCredits = input.creditCount > 0;
  const realSource = input.ledgerSource === 'pilot' || input.ledgerSource === 'live';
  if (realSource && hasCredits) {
    return {
      authoritative: true,
      disclaimer: null,
      statisticalCountsAllowed: true,
    };
  }
  return {
    authoritative: false,
    disclaimer: DASHBOARD_NON_AUTHORITATIVE_BANNER,
    statisticalCountsAllowed: false,
  };
}

export function exportEvidenceLedgerSnapshot(
  evidence: EvidenceLedger,
): EvidenceLedgerSnapshot {
  const suites = evidence.listSuiteSignals().map(suite => ({
    configuration: suite.configuration,
    creditedSuitePasses: suite.creditedSuitePasses,
    suiteFailures: suite.suiteFailures,
  }));
  return {
    schemaVersion: 1,
    kind: EVIDENCE_LEDGER_SNAPSHOT_KIND,
    epoch: evidence.epoch(),
    ...(evidence.lastEpochFreezeReason() != null
      ? { lastEpochFreezeReason: evidence.lastEpochFreezeReason() }
      : {}),
    credits: evidence.listCredits().map(credit => ({
      ...credit,
      dependencyDigests: { ...credit.dependencyDigests },
      cellKey: { ...credit.cellKey },
    })),
    suites,
  };
}

/**
 * Rebuild an evidence ledger from a durable snapshot (dashboard refresh input).
 * Credits are replayed in order; suite counters are restored from the snapshot.
 */
export function createEvidenceLedgerFromSnapshot(
  snapshot: EvidenceLedgerSnapshot,
  options: { now?: () => Date } = {},
): EvidenceLedger {
  if (snapshot.schemaVersion !== 1) {
    throw new Error(
      `Unsupported evidence ledger snapshot schemaVersion ${String(snapshot.schemaVersion)}.`,
    );
  }
  if (snapshot.kind !== EVIDENCE_LEDGER_SNAPSHOT_KIND) {
    throw new Error(
      `Expected EvidenceLedgerSnapshot kind "${EVIDENCE_LEDGER_SNAPSHOT_KIND}"; received ${String(snapshot.kind)}.`,
    );
  }
  if (!Number.isInteger(snapshot.epoch) || snapshot.epoch < 1) {
    throw new Error(`Snapshot epoch must be a positive integer; received ${snapshot.epoch}.`);
  }
  const ledger = createEvidenceLedger({
    now: options.now,
    initialEpoch: 1,
  });

  for (const credit of snapshot.credits) {
    if (!isQualifyingConfiguration(credit.cellKey.configuration)) {
      throw new Error(
        `Snapshot credit has non-qualifying configuration "${credit.cellKey.configuration}".`,
      );
    }
    // Advance epoch identity to match the credit's recorded epoch before insert.
    while (ledger.epoch() < credit.epoch) {
      ledger.freezeEpoch('snapshot-replay');
    }
    const inserted = ledger.credit({
      cellKey: credit.cellKey,
      outcome: credit.outcome,
      retainedInSample: credit.retainedInSample,
      dependencyDigests: credit.dependencyDigests,
      receiptId: credit.receiptId,
      detail: credit.detail,
      recordedAt: credit.recordedAt,
      creditId: credit.creditId,
    });
    if (!credit.valid) {
      // Snapshot invalid credits: mark via a synthetic scope invalidation is lossy.
      // Instead mutate through invalidate only when digests match — for restore we
      // re-list and patch validity by replaying invalidate markers in detail.
      const live = ledger.listCredits().find(row => row.creditId === inserted.creditId);
      if (live) {
        live.valid = false;
        if (credit.detail != null) live.detail = credit.detail;
      }
    }
  }

  while (ledger.epoch() < snapshot.epoch) {
    ledger.freezeEpoch(snapshot.lastEpochFreezeReason ?? 'snapshot-replay');
  }

  // Suite counters are independent of cell credits; restore by crediting outcomes.
  for (const suite of snapshot.suites) {
    for (let i = 0; i < suite.creditedSuitePasses; i += 1) {
      ledger.creditSuite({ configuration: suite.configuration, outcome: 'pass' });
    }
    for (let i = 0; i < suite.suiteFailures; i += 1) {
      ledger.creditSuite({ configuration: suite.configuration, outcome: 'fail' });
    }
  }

  return ledger;
}

function percentileNearestRank(sortedAscending: readonly number[], p: number): number {
  if (sortedAscending.length === 0) {
    throw new Error('percentile requires at least one sample.');
  }
  if (!(p >= 0 && p <= 1)) {
    throw new Error(`percentile p must be in [0,1]; received ${p}.`);
  }
  const rank = Math.ceil(p * sortedAscending.length) - 1;
  const index = Math.min(sortedAscending.length - 1, Math.max(0, rank));
  return sortedAscending[index]!;
}

/**
 * Optimistic/base/pessimistic ETA from measured throughput samples.
 * Rate = observationsCompleted / durationMs; ETA = remaining / (rate * lanes).
 * Optimistic uses the p95 rate, base the median rate, pessimistic the p5 rate.
 */
export function computeDashboardEta(input: {
  remainingObservations: number;
  samples: readonly DashboardTimingSample[];
  activeLanes?: number;
}): DashboardEta {
  const activeLanes =
    input.activeLanes != null && Number.isFinite(input.activeLanes) && input.activeLanes > 0
      ? input.activeLanes
      : 1;
  const remaining = Math.max(0, input.remainingObservations);
  const usable = input.samples.filter(
    sample =>
      Number.isFinite(sample.durationMs) &&
      sample.durationMs > 0 &&
      Number.isFinite(sample.observationsCompleted) &&
      sample.observationsCompleted > 0,
  );

  if (usable.length === 0) {
    return {
      remainingObservations: remaining,
      activeLanes,
      sampleCount: 0,
      throughputPerHour: null,
      durationMs: null,
      etaMs: { optimistic: null, base: null, pessimistic: null },
      reason: 'unavailable until measured pilot data exists',
    };
  }

  const rates = usable
    .map(sample => sample.observationsCompleted / sample.durationMs)
    .sort((a, b) => a - b);
  const durations = usable.map(sample => sample.durationMs).sort((a, b) => a - b);
  const pessimisticRate = percentileNearestRank(rates, 0.05);
  const baseRate = percentileNearestRank(rates, 0.5);
  const optimisticRate = percentileNearestRank(rates, 0.95);

  const etaFromRate = (rate: number): number | null => {
    if (!(rate > 0)) return null;
    return remaining / (rate * activeLanes);
  };

  const msPerHour = 3_600_000;
  return {
    remainingObservations: remaining,
    activeLanes,
    sampleCount: usable.length,
    throughputPerHour: {
      optimistic: optimisticRate * msPerHour,
      base: baseRate * msPerHour,
      pessimistic: pessimisticRate * msPerHour,
    },
    durationMs: {
      p50: percentileNearestRank(durations, 0.5),
      p95: percentileNearestRank(durations, 0.95),
    },
    etaMs: {
      optimistic: etaFromRate(optimisticRate),
      base: etaFromRate(baseRate),
      pessimistic: etaFromRate(pessimisticRate),
    },
    reason: null,
  };
}

function riskForCell(
  cell: CellQualificationStatus,
  riskStates: readonly RiskCellState[] | undefined,
): RiskColor | null {
  if (riskStates == null || riskStates.length === 0) return null;
  const platform =
    cell.cellKey.configuration === 'ios' ? 'ios' : 'android';
  const match = riskStates.find(
    state => state.platform === platform && state.caseId === cell.cellKey.cellId,
  );
  return match?.color ?? null;
}

function primaryDependencyDigest(credit: EvidenceCredit | undefined): string | null {
  if (credit == null) return null;
  const cellScope = Object.entries(credit.dependencyDigests).find(([scopeId]) =>
    scopeId.startsWith('cell:'),
  );
  if (cellScope != null) return `${cellScope[0]}=${cellScope[1]!.slice(0, 12)}`;
  const layout = credit.dependencyDigests.layout;
  if (layout != null) return `layout=${layout.slice(0, 12)}`;
  const first = Object.entries(credit.dependencyDigests)[0];
  return first != null ? `${first[0]}=${first[1]!.slice(0, 12)}` : null;
}

function buildCellRows(
  evidence: EvidenceLedger,
  riskStates: readonly RiskCellState[] | undefined,
): DashboardCellRow[] {
  const allCredits = evidence.listCredits();
  return evidence.listCellStatuses().map(status => {
    const key = statCellKeyString(status.cellKey);
    const forCell = allCredits.filter(
      credit => statCellKeyString(credit.cellKey) === key,
    );
    const valid = forCell.filter(credit => credit.valid);
    const lastFailure = [...forCell]
      .reverse()
      .find(credit => credit.outcome === 'fail');
    const latest = forCell[forCell.length - 1];
    return {
      configuration: status.cellKey.configuration,
      cellKind: status.cellKey.cellKind,
      cellId: status.cellKey.cellId,
      epoch: status.epoch,
      rawRuns: forCell.length,
      credits: valid.length,
      passes: valid.filter(credit => credit.outcome === 'pass').length,
      fails: valid.filter(credit => credit.outcome === 'fail').length,
      retainedFailures: status.retainedFailures,
      validObservations: status.validObservations,
      requiredObservations: status.requiredObservations,
      remaining: status.remaining,
      qualified: status.qualified,
      upperBound: status.upperBound,
      risk: riskForCell(status, riskStates),
      dependencyDigest: primaryDependencyDigest(latest),
      lastFailure: lastFailure?.detail ?? lastFailure?.receiptId ?? null,
    };
  });
}

/**
 * Integrity checks over receipts, ledger credits, and the derived projection.
 */
export function checkDashboardIntegrity(input: {
  evidence: EvidenceLedger;
  receipts?: readonly ReliabilityReceipt[];
  document?: Pick<DashboardDocument, 'epoch' | 'cells' | 'suites' | 'statisticalCounts' | 'authoritative'>;
}): DashboardIntegrityReport {
  const findings: DashboardIntegrityFinding[] = [];
  const credits = input.evidence.listCredits();
  const receiptIds = new Set<string>();

  for (const credit of credits) {
    if (credit.receiptId != null) {
      if (receiptIds.has(credit.receiptId)) {
        findings.push({
          code: 'duplicate-ledger-receipt-id',
          severity: 'error',
          message: `Ledger credits reuse receiptId ${credit.receiptId}.`,
        });
      }
      receiptIds.add(credit.receiptId);
    }
    if (!isQualifyingConfiguration(credit.cellKey.configuration)) {
      findings.push({
        code: 'non-qualifying-credit',
        severity: 'error',
        message: `Credit ${credit.creditId} has non-qualifying configuration.`,
      });
    }
  }

  for (const status of input.evidence.listCellStatuses()) {
    const recomputed = evaluateCellQualification({
      cellKey: status.cellKey,
      epoch: input.evidence.epoch(),
      validPasses: status.validPasses,
      retainedFailures: status.retainedFailures,
    });
    if (
      recomputed.requiredObservations !== status.requiredObservations ||
      recomputed.remaining !== status.remaining ||
      recomputed.qualified !== status.qualified
    ) {
      findings.push({
        code: 'projection-drift',
        severity: 'error',
        message: `Cell ${statCellKeyString(status.cellKey)} projection disagrees with policy evaluation.`,
      });
    }
  }

  if (input.receipts != null) {
    const receiptById = new Map(input.receipts.map(receipt => [receipt.receiptId, receipt]));
    const seenReceiptRows = new Set<string>();
    for (const receipt of input.receipts) {
      if (seenReceiptRows.has(receipt.receiptId)) {
        findings.push({
          code: 'duplicate-receipt-row',
          severity: 'error',
          message: `Receipt JSONL reuses receiptId ${receipt.receiptId}.`,
        });
      }
      seenReceiptRows.add(receipt.receiptId);
    }
    for (const credit of credits) {
      if (credit.receiptId == null) continue;
      const receipt = receiptById.get(credit.receiptId);
      if (receipt == null) {
        findings.push({
          code: 'missing-receipt',
          severity: 'warning',
          message: `Ledger credit ${credit.creditId} references missing receipt ${credit.receiptId}.`,
        });
        continue;
      }
      if (receipt.cellKind !== credit.cellKey.cellKind || receipt.cellId !== credit.cellKey.cellId) {
        findings.push({
          code: 'receipt-cell-mismatch',
          severity: 'error',
          message: `Credit ${credit.creditId} cell does not match receipt ${credit.receiptId}.`,
        });
      }
    }
  }

  if (input.document != null) {
    if (input.document.epoch !== input.evidence.epoch()) {
      findings.push({
        code: 'epoch-mismatch',
        severity: 'error',
        message: `Document epoch ${input.document.epoch} != ledger epoch ${input.evidence.epoch()}.`,
      });
    }
    const expectedCells = input.evidence.listCellStatuses().length;
    if (input.document.cells.length !== expectedCells) {
      findings.push({
        code: 'cell-row-count-mismatch',
        severity: 'error',
        message: `Document has ${input.document.cells.length} cell rows; ledger has ${expectedCells}.`,
      });
    }
    if (
      input.document.authoritative &&
      input.document.statisticalCounts == null
    ) {
      findings.push({
        code: 'authoritative-without-counts',
        severity: 'error',
        message: 'Authoritative dashboard is missing statisticalCounts.',
      });
    }
  }

  return {
    ok: findings.every(finding => finding.severity !== 'error'),
    findings,
  };
}

export function buildDashboardDocument(input: BuildDashboardInput): DashboardDocument {
  const now = input.now ?? (() => new Date());
  const credits = input.evidence.listCredits();
  const authority = resolveDashboardAuthority({
    ledgerSource: input.ledgerSource,
    creditCount: credits.length,
  });
  const cells = buildCellRows(input.evidence, input.riskStates);
  const statuses = input.evidence.listCellStatuses();
  const schedule = scheduleQualificationWork(statuses);
  const remainingObservations = schedule.reduce((sum, row) => sum + row.remaining, 0);
  const eta = computeDashboardEta({
    remainingObservations,
    samples: input.timingSamples ?? [],
    activeLanes: input.activeLanes,
  });
  const suites = input.evidence.listSuiteSignals();
  const resources: DashboardResourcePanel = input.resources ?? { slots: [] };

  // Always render ledger-derived cell/suite rows when present (integrity +
  // fixture preview). Promote the aggregate statisticalCounts object only when
  // authority rules pass — empty/fixture ledgers must not invent campaign truth.
  const statisticalCounts = authority.statisticalCountsAllowed
    ? {
        totalValidCredits: credits.filter(credit => credit.valid).length,
        totalRawCredits: credits.length,
        qualifiedCells: cells.filter(cell => cell.qualified).length,
        openCells: cells.filter(cell => !cell.qualified).length,
        remainingObservations,
      }
    : null;

  const draft: DashboardDocument = {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    projection: 'ledger-derived',
    ledgerSource: input.ledgerSource,
    statisticalCountsAllowed: authority.statisticalCountsAllowed,
    authoritative: authority.authoritative,
    disclaimer: authority.disclaimer,
    canvas: {
      status: 'deferred',
      reason: DASHBOARD_CANVAS_DEFERRED_REASON,
    },
    generatedAt: now().toISOString(),
    policy: QUALIFICATION_POLICY,
    epoch: input.evidence.epoch(),
    ...(input.evidence.lastEpochFreezeReason() != null
      ? { lastEpochFreezeReason: input.evidence.lastEpochFreezeReason() }
      : {}),
    campaign: input.campaign ?? {},
    integrity: { ok: true, findings: [] },
    resources,
    eta,
    cells,
    suites,
    schedule,
    statisticalCounts,
  };

  const integrity = checkDashboardIntegrity({
    evidence: input.evidence,
    receipts: input.receipts,
    document: draft,
  });
  return { ...draft, integrity };
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return 'n/a';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

/**
 * Render Markdown for operators. Omits invented statistical tables when
 * non-authoritative.
 */
export function renderDashboardMarkdown(document: DashboardDocument): string {
  const lines: string[] = [];
  lines.push('# RNGMA E2E Deflake Dashboard');
  lines.push('');
  if (document.disclaimer != null) {
    lines.push(`> **${document.disclaimer}**`);
    lines.push('>');
    lines.push(
      `> Ledger-derived render (${document.ledgerSource}); statistical counts are not promoted.`,
    );
  } else {
    lines.push('> Ledger-derived — statistical counts authoritative for this snapshot.');
  }
  lines.push(`> Generated: ${document.generatedAt}`);
  lines.push(`> Epoch: ${document.epoch}`);
  lines.push(`> Integrity: ${document.integrity.ok ? 'ok' : 'FAILED'}`);
  lines.push(`> Canvas: deferred — ${document.canvas.reason}`);
  lines.push('');

  lines.push('## Campaign');
  lines.push('');
  const campaign = document.campaign;
  if (campaign.phase) lines.push(`- Phase: ${campaign.phase}`);
  if (campaign.branch) lines.push(`- Branch: \`${campaign.branch}\``);
  if (campaign.baseCommit) lines.push(`- Base: \`${campaign.baseCommit}\``);
  if (campaign.lastCommitSubject) {
    lines.push(`- Latest commit subject: \`${campaign.lastCommitSubject}\``);
  }
  if (campaign.status) lines.push(`- Status: ${campaign.status}`);
  if (campaign.frozenDigest) lines.push(`- Frozen digest: \`${campaign.frozenDigest}\``);
  if (campaign.stopReason) lines.push(`- Stop reason: ${campaign.stopReason}`);
  lines.push(
    `- Statistical policy: ${(document.policy.confidence * 100).toFixed(0)}% confidence, maximum flake rate ${document.policy.maxFlakeRate * 100}%`,
  );
  lines.push('- Qualifying configurations: Android Next-Gen and iOS');
  lines.push('- Compatibility canary: Android classic');
  lines.push('');

  if (campaign.hostReadiness && Object.keys(campaign.hostReadiness).length > 0) {
    lines.push('## Host readiness');
    lines.push('');
    for (const [key, value] of Object.entries(campaign.hostReadiness)) {
      lines.push(`- ${key}: ${value}`);
    }
    lines.push('');
  }

  if (campaign.coverageProgress && Object.keys(campaign.coverageProgress).length > 0) {
    lines.push('## Coverage progress');
    lines.push('');
    for (const [key, value] of Object.entries(campaign.coverageProgress)) {
      lines.push(`- ${key}: ${value}`);
    }
    if (campaign.acceptedExceptions?.length) {
      lines.push(
        `- Accepted exceptions: ${campaign.acceptedExceptions.join('; ')}`,
      );
    }
    lines.push('');
  }

  lines.push('## Reliability progress');
  lines.push('');
  if (document.cells.length === 0) {
    lines.push(
      'Statistical counts intentionally empty until a real pilot/live ledger has credits.',
    );
  } else {
    if (!document.authoritative || document.statisticalCounts == null) {
      lines.push(
        'Non-authoritative ledger preview (fixture or empty live source) — not campaign truth.',
      );
      lines.push('');
    } else {
      const counts = document.statisticalCounts;
      lines.push(`- Valid credits: ${counts.totalValidCredits} (raw ${counts.totalRawCredits})`);
      lines.push(
        `- Cells: ${counts.qualifiedCells} qualified / ${counts.openCells} open`,
      );
      lines.push(`- Remaining observations: ${counts.remainingObservations}`);
      lines.push('');
    }
    lines.push('| Config | Kind | Id | Raw | Credits | Pass | Fail | Bound | Remaining | Risk | Last failure |');
    lines.push('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |');
    for (const cell of document.cells) {
      const bound =
        cell.upperBound == null ? 'n/a' : cell.upperBound.toExponential(2);
      lines.push(
        `| ${cell.configuration} | ${cell.cellKind} | ${cell.cellId} | ${cell.rawRuns} | ${cell.credits} | ${cell.passes} | ${cell.fails} | ${bound} | ${cell.remaining} | ${cell.risk ?? 'n/a'} | ${cell.lastFailure ?? ''} |`,
      );
    }
    lines.push('');
    lines.push('### Suite signal (independent of per-cell confidence)');
    lines.push('');
    for (const suite of document.suites) {
      lines.push(
        `- ${suite.configuration}: passes=${suite.creditedSuitePasses} failures=${suite.suiteFailures}`,
      );
    }
  }
  lines.push('');

  lines.push('## Resources');
  lines.push('');
  if (document.resources.slots.length === 0) {
    lines.push('- Slot ownership: none reported');
  } else {
    for (const slot of document.resources.slots) {
      const metro =
        slot.metroPort != null ? ` metro=${slot.metroPort}` : '';
      const cache = slot.cacheRoot != null ? ` cache=${slot.cacheRoot}` : '';
      const rss =
        slot.metroRssBytes !== undefined
          ? ` metroRssBytes=${slot.metroRssBytes ?? 'n/a'}`
          : '';
      const bundle =
        slot.bundleP95Ms !== undefined
          ? ` bundleP95Ms=${slot.bundleP95Ms ?? 'n/a'}`
          : '';
      const age =
        slot.deviceAgeDays !== undefined
          ? ` deviceAgeDays=${slot.deviceAgeDays ?? 'n/a'}`
          : '';
      lines.push(
        `- ${slot.platform} slot ${slot.slot}: ${slot.state}${metro}${cache}${rss}${bundle}${age}`,
      );
    }
  }
  if (document.resources.diskBytes != null || document.resources.diskCeilingBytes != null) {
    lines.push(
      `- Disk: ${document.resources.diskBytes ?? 'n/a'} / ceiling ${document.resources.diskCeilingBytes ?? 'n/a'}`,
    );
  }
  if (document.resources.watchdogs?.length) {
    for (const watchdog of document.resources.watchdogs) {
      lines.push(
        `- Watchdog ${watchdog.name}: ${watchdog.status}${watchdog.detail ? ` (${watchdog.detail})` : ''}`,
      );
    }
  }
  lines.push('');

  lines.push('## Timing / ETA');
  lines.push('');
  if (document.eta.reason != null) {
    lines.push(`- ETA: ${document.eta.reason}`);
  } else {
    lines.push(`- Remaining observations: ${document.eta.remainingObservations}`);
    lines.push(`- Active lanes: ${document.eta.activeLanes}`);
    lines.push(
      `- Duration p50/p95: ${formatMs(document.eta.durationMs?.p50)} / ${formatMs(document.eta.durationMs?.p95)}`,
    );
    lines.push(
      `- ETA optimistic: ${formatMs(document.eta.etaMs.optimistic)}`,
    );
    lines.push(`- ETA base: ${formatMs(document.eta.etaMs.base)}`);
    lines.push(
      `- ETA pessimistic: ${formatMs(document.eta.etaMs.pessimistic)}`,
    );
  }
  if (campaign.blockers?.length) {
    lines.push(`- Blockers: ${campaign.blockers.join('; ')}`);
  } else {
    lines.push('- Blockers: none');
  }
  lines.push('');

  if (!document.integrity.ok) {
    lines.push('## Integrity findings');
    lines.push('');
    for (const finding of document.integrity.findings) {
      lines.push(`- (${finding.severity}) ${finding.code}: ${finding.message}`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export type WriteDashboardResult = {
  document: DashboardDocument;
  jsonPath: string;
  markdownPath: string;
  /** DashboardDocument epoch archive — not valid `--dashboard-ledger` input. */
  snapshotPath: string;
  /**
   * EvidenceLedgerSnapshot for `--dashboard-ledger=` reload when a ledger was
   * supplied at write time; otherwise null.
   */
  ledgerSnapshotPath: string | null;
};

export function defaultDashboardReportRoot(repositoryRoot: string): string {
  return path.join(repositoryRoot, '.agents', 'reports', 'e2e-deflake');
}

/**
 * Write dashboard artifacts under `reportRoot`:
 * - `dashboard.json` / `dashboard.md` — rendered DashboardDocument
 * - `snapshots/epoch-<n>.json` — DashboardDocument archive (not a ledger)
 * - `ledger-snapshot.json` + `snapshots/epoch-<n>.ledger.json` — EvidenceLedgerSnapshot
 *   reload input for `--dashboard-ledger=` (only when `ledgerSnapshot` is passed)
 */
export function writeDashboardArtifacts(
  reportRoot: string,
  document: DashboardDocument,
  options: { ledgerSnapshot?: EvidenceLedgerSnapshot } = {},
): WriteDashboardResult {
  mkdirSync(reportRoot, { recursive: true });
  const snapshotsDir = path.join(reportRoot, 'snapshots');
  mkdirSync(snapshotsDir, { recursive: true });

  const jsonPath = path.join(reportRoot, 'dashboard.json');
  const markdownPath = path.join(reportRoot, 'dashboard.md');
  const snapshotPath = path.join(snapshotsDir, `epoch-${document.epoch}.json`);

  writeFileSync(jsonPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  writeFileSync(markdownPath, renderDashboardMarkdown(document), 'utf8');
  writeFileSync(snapshotPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  let ledgerSnapshotPath: string | null = null;
  if (options.ledgerSnapshot != null) {
    if (options.ledgerSnapshot.kind !== EVIDENCE_LEDGER_SNAPSHOT_KIND) {
      throw new Error(
        `writeDashboardArtifacts expected EvidenceLedgerSnapshot kind "${EVIDENCE_LEDGER_SNAPSHOT_KIND}".`,
      );
    }
    ledgerSnapshotPath = path.join(reportRoot, 'ledger-snapshot.json');
    const epochLedgerPath = path.join(
      snapshotsDir,
      `epoch-${document.epoch}.ledger.json`,
    );
    const body = `${JSON.stringify(options.ledgerSnapshot, null, 2)}\n`;
    writeFileSync(ledgerSnapshotPath, body, 'utf8');
    writeFileSync(epochLedgerPath, body, 'utf8');
  }

  return { document, jsonPath, markdownPath, snapshotPath, ledgerSnapshotPath };
}

/**
 * Parse an EvidenceLedgerSnapshot for `--dashboard-ledger=`.
 * Rejects DashboardDocument epoch snapshots so refresh cannot silently treat
 * rendered projections as ledger credits.
 */
export function readEvidenceLedgerSnapshot(filePath: string): EvidenceLedgerSnapshot {
  const raw = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (parsed == null || typeof parsed !== 'object') {
    throw new Error(`Ledger snapshot at ${filePath} is not an object.`);
  }
  if (
    parsed.projection === 'ledger-derived' ||
    Array.isArray(parsed.cells) ||
    parsed.authoritative != null
  ) {
    throw new Error(
      `File ${filePath} is a DashboardDocument (dashboard/epoch snapshot), not an EvidenceLedgerSnapshot. Pass ledger-snapshot.json or snapshots/epoch-<n>.ledger.json to --dashboard-ledger.`,
    );
  }
  if (parsed.kind !== EVIDENCE_LEDGER_SNAPSHOT_KIND) {
    throw new Error(
      `Ledger snapshot at ${filePath} must have kind "${EVIDENCE_LEDGER_SNAPSHOT_KIND}".`,
    );
  }
  if (!Array.isArray(parsed.credits)) {
    throw new Error(`Ledger snapshot at ${filePath} missing credits array.`);
  }
  if (!Number.isInteger(parsed.schemaVersion) || parsed.schemaVersion !== 1) {
    throw new Error(
      `Ledger snapshot at ${filePath} has unsupported schemaVersion ${String(parsed.schemaVersion)}.`,
    );
  }
  return parsed as unknown as EvidenceLedgerSnapshot;
}

export function readDashboardCampaignMeta(filePath: string): DashboardCampaignMeta {
  if (!existsSync(filePath)) {
    throw new Error(`Dashboard meta file not found: ${filePath}`);
  }
  return JSON.parse(readFileSync(filePath, 'utf8')) as DashboardCampaignMeta;
}

export type RefreshDashboardOptions = {
  reportRoot: string;
  /**
   * Path to an EvidenceLedgerSnapshot (`kind: evidence-ledger-snapshot`).
   * DashboardDocument epoch files (`snapshots/epoch-<n>.json`) are rejected.
   * When omitted, refresh from an empty live ledger (non-authoritative banner).
   */
  ledgerSnapshotPath?: string;
  /**
   * Provenance of the ledger. When omitted with a ledger file, defaults to
   * `fixture` (non-authoritative). Pass `pilot` or `live` explicitly to
   * promote credits. When omitted without a ledger file, defaults to `live`.
   */
  ledgerSource?: DashboardLedgerSource;
  campaignMetaPath?: string;
  campaign?: DashboardCampaignMeta;
  resources?: DashboardResourcePanel;
  timingSamples?: readonly DashboardTimingSample[];
  riskStates?: readonly RiskCellState[];
  receipts?: readonly ReliabilityReceipt[];
  activeLanes?: number;
  now?: () => Date;
};

/**
 * Rebuild dashboard artifacts from an optional ledger snapshot + overlays.
 * Without a snapshot, writes a ledger-derived empty live document that keeps
 * the non-authoritative banner (no invented qualification counts).
 *
 * When `ledgerSnapshotPath` is set and `ledgerSource` is omitted, source
 * defaults to `fixture` so credits cannot silently promote to authoritative.
 */
export function refreshReliabilityDashboard(
  options: RefreshDashboardOptions,
): WriteDashboardResult {
  const ledgerSource = resolveRefreshDashboardLedgerSource({
    explicitSource: options.ledgerSource,
    ledgerSnapshotPresent: options.ledgerSnapshotPath != null,
  });
  const evidence =
    options.ledgerSnapshotPath != null
      ? createEvidenceLedgerFromSnapshot(
          readEvidenceLedgerSnapshot(options.ledgerSnapshotPath),
          { now: options.now },
        )
      : createEvidenceLedger({ now: options.now });

  const campaignFromFile =
    options.campaignMetaPath != null
      ? readDashboardCampaignMeta(options.campaignMetaPath)
      : undefined;

  const document = buildDashboardDocument({
    evidence,
    ledgerSource,
    receipts: options.receipts,
    resources: options.resources,
    timingSamples: options.timingSamples,
    riskStates: options.riskStates,
    campaign: { ...(campaignFromFile ?? {}), ...(options.campaign ?? {}) },
    activeLanes: options.activeLanes,
    now: options.now,
  });

  return writeDashboardArtifacts(options.reportRoot, document, {
    ledgerSnapshot: exportEvidenceLedgerSnapshot(evidence),
  });
}

export type DashboardPilotResult = {
  authoritativeEmpty: boolean;
  authoritativePilot: boolean;
  integrityOk: boolean;
  snapshotWritten: boolean;
  etaBaseMs: number | null;
  canvasDeferred: true;
  disclaimerEmpty: string | null;
  disclaimerPilot: string | null;
};

/**
 * Device-free dashboard pilot: empty non-authoritative render, fixture integrity,
 * ETA math with samples, pilot-source authoritative promotion, snapshot write.
 */
export async function runDashboardPilot(
  options: { reportRoot?: string } = {},
): Promise<DashboardPilotResult> {
  const reportRoot =
    options.reportRoot ??
    path.join('/tmp', 'rngma-e2e-reliability', 'dashboard-pilot');

  const emptyEvidence = createEvidenceLedger();
  const empty = buildDashboardDocument({
    evidence: emptyEvidence,
    ledgerSource: 'live',
    campaign: { status: 'dashboard-pilot-empty' },
  });
  writeDashboardArtifacts(path.join(reportRoot, 'empty'), empty, {
    ledgerSnapshot: exportEvidenceLedgerSnapshot(emptyEvidence),
  });

  const fixture = createEvidenceLedger();
  fixture.creditPass({
    cellKey: {
      configuration: 'android-nextgen',
      cellKind: 'test',
      cellId: 'banner',
    },
    dependencyDigests: { layout: 'digest-layout', policy: 'digest-policy' },
    receiptId: 'rcpt_dashboard_pilot_1',
    detail: 'fixture-pass',
  });
  fixture.creditRetainedFailure({
    cellKey: {
      configuration: 'android-nextgen',
      cellKind: 'test',
      cellId: 'native',
    },
    dependencyDigests: { layout: 'digest-layout', policy: 'digest-policy' },
    receiptId: 'rcpt_dashboard_pilot_2',
    detail: 'fixture-fail',
  });

  const fixtureDoc = buildDashboardDocument({
    evidence: fixture,
    ledgerSource: 'fixture',
    receipts: [
      {
        receiptId: 'rcpt_dashboard_pilot_1',
        jobId: 'job_dashboard_pilot',
        sequence: 1,
        recordedAt: '2026-10-13T00:00:00.000Z',
        iteration: 1,
        cellKind: 'test',
        cellId: 'banner',
        outcome: 'pass',
        counted: true,
      },
      {
        receiptId: 'rcpt_dashboard_pilot_2',
        jobId: 'job_dashboard_pilot',
        sequence: 2,
        recordedAt: '2026-10-13T00:00:01.000Z',
        iteration: 1,
        cellKind: 'test',
        cellId: 'native',
        outcome: 'fail',
        counted: true,
        detail: 'fixture-fail',
      },
    ],
    resources: {
      slots: [
        {
          slot: 1,
          platform: 'android',
          state: 'owned-idle',
          metroPort: 13007,
          cacheRoot: '/tmp/metro-android-1',
          metroRssBytes: 128_000_000,
          bundleP95Ms: 4200,
          deviceAgeDays: 3,
        },
      ],
      diskBytes: 1024,
      diskCeilingBytes: 512 * 1024 * 1024,
      watchdogs: [{ name: 'heartbeat', status: 'ok' }],
    },
    timingSamples: [
      { durationMs: 60_000, observationsCompleted: 10 },
      { durationMs: 90_000, observationsCompleted: 10 },
      { durationMs: 120_000, observationsCompleted: 10 },
    ],
    riskStates: [
      {
        caseId: 'native',
        platform: 'android',
        color: 'red',
        consecutiveIndividualGreens: 0,
        consecutiveCandidateShardGreens: 0,
        consecutiveFinalLayoutGreens: 0,
        unresolvedFailure: true,
        lastFailureSignature: 'sig-native',
      },
    ],
    activeLanes: 2,
    campaign: { status: 'dashboard-pilot-fixture' },
  });

  // Fixture never promotes; re-build as pilot source to prove authority path.
  const pilotDoc = buildDashboardDocument({
    evidence: fixture,
    ledgerSource: 'pilot',
    timingSamples: [
      { durationMs: 60_000, observationsCompleted: 10 },
      { durationMs: 90_000, observationsCompleted: 10 },
      { durationMs: 120_000, observationsCompleted: 10 },
    ],
    activeLanes: 2,
    resources: fixtureDoc.resources,
    riskStates: fixtureDoc.cells.length
      ? [
          {
            caseId: 'native',
            platform: 'android',
            color: 'red',
            consecutiveIndividualGreens: 0,
            consecutiveCandidateShardGreens: 0,
            consecutiveFinalLayoutGreens: 0,
            unresolvedFailure: true,
            lastFailureSignature: 'sig-native',
          },
        ]
      : [],
    campaign: { status: 'dashboard-pilot-authoritative-path' },
  });

  const written = writeDashboardArtifacts(path.join(reportRoot, 'pilot'), pilotDoc, {
    ledgerSnapshot: exportEvidenceLedgerSnapshot(fixture),
  });
  const snapshotExists =
    existsSync(written.snapshotPath) &&
    written.ledgerSnapshotPath != null &&
    existsSync(written.ledgerSnapshotPath);

  return {
    authoritativeEmpty: empty.authoritative,
    authoritativePilot: pilotDoc.authoritative,
    integrityOk: fixtureDoc.integrity.ok && pilotDoc.integrity.ok && empty.integrity.ok,
    snapshotWritten: snapshotExists,
    etaBaseMs: pilotDoc.eta.etaMs.base,
    canvasDeferred: true,
    disclaimerEmpty: empty.disclaimer,
    disclaimerPilot: pilotDoc.disclaimer,
  };
}
