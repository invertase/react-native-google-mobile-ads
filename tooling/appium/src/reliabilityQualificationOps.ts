/**
 * Operational qualification contracts that sit beside statistical observation
 * math: warm-epoch suite caps, hardware diversity, classic Android canary
 * cadence, and receipt-bearing coverage flush gates.
 *
 * These constants are intentionally NOT part of QUALIFICATION_POLICY so the
 * frozen policy digest stays bound to confidence / flake-rate / observation
 * targets alone.
 */

import { randomUUID } from 'node:crypto';
import type { CellQualificationStatus, SuiteSignal } from './reliabilityStats.ts';
import { STATS_PROJECTION_DISCLAIMER } from './reliabilityStats.ts';

/** Credited suite passes allowed in one warm epoch before a cold restart. */
export const WARM_EPOCH_CREDITED_SUITE_CAP = 50 as const;

/** Preferred distinct slots or time blocks per qualifying configuration. */
export const HARDWARE_DIVERSITY_PREFERRED_SLOTS = 3 as const;

/**
 * When fewer than {@link HARDWARE_DIVERSITY_PREFERRED_SLOTS} slots/time blocks
 * are available, require at least this many cold epochs and disclose reduced
 * hardware diversity.
 */
export const REDUCED_DIVERSITY_MIN_COLD_EPOCHS = 60 as const;

/**
 * Classic Android full-layout canary interval: every N credited Android
 * Next-Gen suite passes (classic stays canary-only; no 2,995 target).
 */
export const CLASSIC_CANARY_NEXTGEN_SUITE_INTERVAL = 100 as const;

export type WarmEpochState = {
  warmEpochId: number;
  coldEpochCount: number;
  creditedSuitesInWarmEpoch: number;
  cap: typeof WARM_EPOCH_CREDITED_SUITE_CAP;
  /** True when the warm-epoch suite cap has been reached and a cold restart is due. */
  mustColdRestart: boolean;
};

export type WarmEpochTracker = {
  state(): WarmEpochState;
  /** Record one credited qualifying suite pass toward the warm-epoch cap. */
  noteCreditedSuitePass(): WarmEpochState;
  /**
   * Cold task-owned state restart: resets the warm suite counter and advances
   * cold-epoch identity. Call when Metro/task-owned state is fully restarted.
   */
  coldRestart(): WarmEpochState;
};

export function createWarmEpochTracker(
  options: {
    initialWarmEpochId?: number;
    initialColdEpochCount?: number;
  } = {},
): WarmEpochTracker {
  let warmEpochId = options.initialWarmEpochId ?? 1;
  let coldEpochCount = options.initialColdEpochCount ?? 0;
  let creditedSuitesInWarmEpoch = 0;

  function snapshot(): WarmEpochState {
    return {
      warmEpochId,
      coldEpochCount,
      creditedSuitesInWarmEpoch,
      cap: WARM_EPOCH_CREDITED_SUITE_CAP,
      mustColdRestart: creditedSuitesInWarmEpoch >= WARM_EPOCH_CREDITED_SUITE_CAP,
    };
  }

  return {
    state: snapshot,
    noteCreditedSuitePass() {
      creditedSuitesInWarmEpoch += 1;
      return snapshot();
    },
    coldRestart() {
      creditedSuitesInWarmEpoch = 0;
      coldEpochCount += 1;
      warmEpochId += 1;
      return snapshot();
    },
  };
}

export type HardwareDiversityAssessment = {
  availableSlots: number;
  timeBlocks: number;
  diversityUnits: number;
  preferredUnits: typeof HARDWARE_DIVERSITY_PREFERRED_SLOTS;
  coldEpochCount: number;
  reducedDiversityMinColdEpochs: typeof REDUCED_DIVERSITY_MIN_COLD_EPOCHS;
  /** True when preferred slot/time-block diversity is met. */
  preferredDiversityMet: boolean;
  /** Required disclosure when running with fewer than preferred units. */
  reducedHardwareDiversity: boolean;
  /**
   * False when reduced diversity is in effect but cold epochs have not yet
   * reached the reduced-diversity minimum.
   */
  diversityRequirementMet: boolean;
  detail: string;
};

/**
 * Assess hardware diversity for a qualifying configuration. Prefer ≥3 distinct
 * slots or time blocks; with fewer, require ≥60 cold epochs and disclose
 * reduced hardware diversity.
 */
export function evaluateHardwareDiversity(input: {
  availableSlots: number;
  timeBlocks?: number;
  coldEpochCount: number;
}): HardwareDiversityAssessment {
  if (!Number.isInteger(input.availableSlots) || input.availableSlots < 0) {
    throw new Error(
      `availableSlots must be a non-negative integer; received ${input.availableSlots}.`,
    );
  }
  const timeBlocks = input.timeBlocks ?? 0;
  if (!Number.isInteger(timeBlocks) || timeBlocks < 0) {
    throw new Error(
      `timeBlocks must be a non-negative integer; received ${timeBlocks}.`,
    );
  }
  if (!Number.isInteger(input.coldEpochCount) || input.coldEpochCount < 0) {
    throw new Error(
      `coldEpochCount must be a non-negative integer; received ${input.coldEpochCount}.`,
    );
  }

  const diversityUnits = Math.max(input.availableSlots, timeBlocks);
  const preferredDiversityMet = diversityUnits >= HARDWARE_DIVERSITY_PREFERRED_SLOTS;
  const reducedHardwareDiversity = !preferredDiversityMet;
  const diversityRequirementMet =
    preferredDiversityMet ||
    input.coldEpochCount >= REDUCED_DIVERSITY_MIN_COLD_EPOCHS;

  let detail: string;
  if (preferredDiversityMet) {
    detail = `Preferred hardware diversity met (${diversityUnits} slot/time-block units ≥ ${HARDWARE_DIVERSITY_PREFERRED_SLOTS}).`;
  } else if (diversityRequirementMet) {
    detail = `Reduced hardware diversity disclosed: ${diversityUnits} slot/time-block unit(s) < ${HARDWARE_DIVERSITY_PREFERRED_SLOTS}; cold epochs ${input.coldEpochCount} ≥ ${REDUCED_DIVERSITY_MIN_COLD_EPOCHS}.`;
  } else {
    detail = `Reduced hardware diversity disclosed: ${diversityUnits} slot/time-block unit(s) < ${HARDWARE_DIVERSITY_PREFERRED_SLOTS}; cold epochs ${input.coldEpochCount} < ${REDUCED_DIVERSITY_MIN_COLD_EPOCHS} required.`;
  }

  return {
    availableSlots: input.availableSlots,
    timeBlocks,
    diversityUnits,
    preferredUnits: HARDWARE_DIVERSITY_PREFERRED_SLOTS,
    coldEpochCount: input.coldEpochCount,
    reducedDiversityMinColdEpochs: REDUCED_DIVERSITY_MIN_COLD_EPOCHS,
    preferredDiversityMet,
    reducedHardwareDiversity,
    diversityRequirementMet,
    detail,
  };
}

export type ClassicCanaryTrigger =
  | 'interval'
  | 'executable-change'
  | 'final-validation';

export type ClassicCanaryDecision = {
  due: boolean;
  triggers: ClassicCanaryTrigger[];
  creditedNextGenSuitePasses: number;
  lastCanaryAtNextGenSuitePasses: number | null;
  interval: typeof CLASSIC_CANARY_NEXTGEN_SUITE_INTERVAL;
  detail: string;
};

/**
 * Classic Android canaries run every
 * {@link CLASSIC_CANARY_NEXTGEN_SUITE_INTERVAL} credited Next-Gen suite passes
 * by default, after executable changes, and at final validation. Classic never
 * pursues the statistical observation target.
 */
export function evaluateClassicCanaryCadence(input: {
  creditedNextGenSuitePasses: number;
  lastCanaryAtNextGenSuitePasses?: number | null;
  executableChangedSinceLastCanary?: boolean;
  finalValidation?: boolean;
}): ClassicCanaryDecision {
  if (
    !Number.isInteger(input.creditedNextGenSuitePasses) ||
    input.creditedNextGenSuitePasses < 0
  ) {
    throw new Error(
      `creditedNextGenSuitePasses must be a non-negative integer; received ${input.creditedNextGenSuitePasses}.`,
    );
  }
  const last =
    input.lastCanaryAtNextGenSuitePasses === undefined
      ? null
      : input.lastCanaryAtNextGenSuitePasses;
  if (last != null && (!Number.isInteger(last) || last < 0)) {
    throw new Error(
      `lastCanaryAtNextGenSuitePasses must be a non-negative integer or null; received ${last}.`,
    );
  }

  const triggers: ClassicCanaryTrigger[] = [];
  const sinceLast =
    last == null ? input.creditedNextGenSuitePasses : input.creditedNextGenSuitePasses - last;
  if (sinceLast >= CLASSIC_CANARY_NEXTGEN_SUITE_INTERVAL) {
    triggers.push('interval');
  }
  if (input.executableChangedSinceLastCanary === true) {
    triggers.push('executable-change');
  }
  if (input.finalValidation === true) {
    triggers.push('final-validation');
  }

  const due = triggers.length > 0;
  return {
    due,
    triggers,
    creditedNextGenSuitePasses: input.creditedNextGenSuitePasses,
    lastCanaryAtNextGenSuitePasses: last,
    interval: CLASSIC_CANARY_NEXTGEN_SUITE_INTERVAL,
    detail: due
      ? `Classic canary due (${triggers.join(', ')}).`
      : `Classic canary not due (${sinceLast} Next-Gen suite passes since last canary; interval ${CLASSIC_CANARY_NEXTGEN_SUITE_INTERVAL}).`,
  };
}

export type ClassicCanaryReceipt = {
  receiptId: string;
  kind: 'classic-canary';
  recordedAt: string;
  trigger: ClassicCanaryTrigger;
  creditedNextGenSuitePasses: number;
  outcome: 'pass' | 'fail';
  layoutDigest: string;
  executableDigest: string;
  detail?: string;
};

export type ClassicCanaryScheduler = {
  decision(input?: {
    executableChangedSinceLastCanary?: boolean;
    finalValidation?: boolean;
  }): ClassicCanaryDecision;
  noteNextGenSuitePass(): ClassicCanaryDecision;
  recordCanary(input: {
    trigger: ClassicCanaryTrigger;
    outcome: 'pass' | 'fail';
    layoutDigest: string;
    executableDigest: string;
    detail?: string;
    recordedAt?: string;
    receiptId?: string;
  }): ClassicCanaryReceipt;
  receipts(): readonly ClassicCanaryReceipt[];
  creditedNextGenSuitePasses(): number;
};

export function createClassicCanaryScheduler(
  options: {
    now?: () => Date;
    createReceiptId?: () => string;
    initialCreditedNextGenSuitePasses?: number;
  } = {},
): ClassicCanaryScheduler {
  const now = options.now ?? (() => new Date());
  const nextId =
    options.createReceiptId ?? (() => `canary_${randomUUID().replace(/-/g, '')}`);
  let creditedNextGenSuitePasses = options.initialCreditedNextGenSuitePasses ?? 0;
  let lastCanaryAtNextGenSuitePasses: number | null = null;
  const receipts: ClassicCanaryReceipt[] = [];

  function decision(input: {
    executableChangedSinceLastCanary?: boolean;
    finalValidation?: boolean;
  } = {}): ClassicCanaryDecision {
    return evaluateClassicCanaryCadence({
      creditedNextGenSuitePasses,
      lastCanaryAtNextGenSuitePasses,
      executableChangedSinceLastCanary: input.executableChangedSinceLastCanary,
      finalValidation: input.finalValidation,
    });
  }

  return {
    decision,
    noteNextGenSuitePass() {
      creditedNextGenSuitePasses += 1;
      return decision();
    },
    recordCanary(input) {
      const receipt: ClassicCanaryReceipt = {
        receiptId: input.receiptId ?? nextId(),
        kind: 'classic-canary',
        recordedAt: input.recordedAt ?? now().toISOString(),
        trigger: input.trigger,
        creditedNextGenSuitePasses,
        outcome: input.outcome,
        layoutDigest: input.layoutDigest,
        executableDigest: input.executableDigest,
        ...(input.detail != null ? { detail: input.detail } : {}),
      };
      receipts.push(receipt);
      lastCanaryAtNextGenSuitePasses = creditedNextGenSuitePasses;
      return receipt;
    },
    receipts() {
      return [...receipts];
    },
    creditedNextGenSuitePasses() {
      return creditedNextGenSuitePasses;
    },
  };
}

export const COVERAGE_FLUSH_GATE_STAGES = ['flush', 'pull', 'report'] as const;
export type CoverageFlushGateStage = (typeof COVERAGE_FLUSH_GATE_STAGES)[number];

export type CoverageFlushGateReceipt = {
  receiptId: string;
  kind: 'coverage-flush-gate';
  recordedAt: string;
  stage: CoverageFlushGateStage;
  outcome: 'pass' | 'fail';
  detail?: string;
};

export type CoverageFlushGateResult = {
  ok: boolean;
  receipts: CoverageFlushGateReceipt[];
  missingStages: CoverageFlushGateStage[];
  failedStages: CoverageFlushGateStage[];
  detail: string;
};

/**
 * Final coverage flush/pull/report is a receipt-bearing gate. Soft-fail Appium
 * smoke teardown (`flushCoverageFromApp`) remains separate; qualification and
 * native coverage evidence runs must pass this gate.
 */
export function evaluateCoverageFlushGate(
  receipts: readonly CoverageFlushGateReceipt[],
): CoverageFlushGateResult {
  const byStage = new Map<CoverageFlushGateStage, CoverageFlushGateReceipt>();
  for (const receipt of receipts) {
    if (receipt.kind !== 'coverage-flush-gate') continue;
    // Last receipt per stage wins (retry-friendly).
    byStage.set(receipt.stage, receipt);
  }

  const missingStages: CoverageFlushGateStage[] = [];
  const failedStages: CoverageFlushGateStage[] = [];
  for (const stage of COVERAGE_FLUSH_GATE_STAGES) {
    const receipt = byStage.get(stage);
    if (receipt == null) {
      missingStages.push(stage);
      continue;
    }
    if (receipt.outcome !== 'pass') {
      failedStages.push(stage);
    }
  }

  const ok = missingStages.length === 0 && failedStages.length === 0;
  let detail: string;
  if (ok) {
    detail = 'Coverage flush/pull/report gate passed with receipts for all stages.';
  } else {
    const parts: string[] = [];
    if (missingStages.length > 0) {
      parts.push(`missing stages: ${missingStages.join(', ')}`);
    }
    if (failedStages.length > 0) {
      parts.push(`failed stages: ${failedStages.join(', ')}`);
    }
    detail = `Coverage flush gate failed (${parts.join('; ')}).`;
  }

  return {
    ok,
    receipts: COVERAGE_FLUSH_GATE_STAGES.map(stage => byStage.get(stage)).filter(
      (row): row is CoverageFlushGateReceipt => row != null,
    ),
    missingStages,
    failedStages,
    detail,
  };
}

export function createCoverageFlushGateReceipt(input: {
  stage: CoverageFlushGateStage;
  outcome: 'pass' | 'fail';
  detail?: string;
  recordedAt?: string;
  receiptId?: string;
}): CoverageFlushGateReceipt {
  if (!(COVERAGE_FLUSH_GATE_STAGES as readonly string[]).includes(input.stage)) {
    throw new Error(`Unknown coverage flush gate stage "${input.stage}".`);
  }
  return {
    receiptId: input.receiptId ?? `flush_${randomUUID().replace(/-/g, '')}`,
    kind: 'coverage-flush-gate',
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    stage: input.stage,
    outcome: input.outcome,
    ...(input.detail != null ? { detail: input.detail } : {}),
  };
}

/**
 * Assert the coverage flush gate. Throws when flush/pull/report receipts are
 * missing or failed — operators must treat this as a failed coverage run.
 */
export function assertCoverageFlushGate(
  receipts: readonly CoverageFlushGateReceipt[],
): CoverageFlushGateResult {
  const result = evaluateCoverageFlushGate(receipts);
  if (!result.ok) {
    throw new Error(result.detail);
  }
  return result;
}

export type QualificationEvidenceLedgerSource = 'fixture' | 'pilot' | 'live' | 'none';

export type QualificationEvidencePackage = {
  kind: 'qualification-evidence';
  freezeDigests: {
    layout: string;
    policy: string;
    executable: string;
  };
  ledgerSource: QualificationEvidenceLedgerSource;
  /**
   * Authoritative statistical counts only when ledgerSource is pilot|live and
   * the ledger already has credits. Otherwise keep the non-authoritative
   * projection disclaimer and do not invent observation counts.
   */
  statisticalAuthoritative: boolean;
  disclaimer: string | null;
  epoch: number;
  perCellStatus: CellQualificationStatus[];
  suiteSignals: SuiteSignal[];
  canaryReceipts: ClassicCanaryReceipt[];
  coverageFlushGate: CoverageFlushGateResult;
  warmEpoch: WarmEpochState;
  hardwareDiversity: HardwareDiversityAssessment[];
};

/**
 * Build the durable qualification evidence package shape operators record
 * against a frozen executable. Empty / fixture ledgers keep the projection
 * disclaimer and must not invent 2,995 observation counts.
 */
export function buildQualificationEvidencePackage(input: {
  freezeDigests: QualificationEvidencePackage['freezeDigests'];
  ledgerSource: QualificationEvidenceLedgerSource;
  epoch: number;
  perCellStatus: readonly CellQualificationStatus[];
  suiteSignals: readonly SuiteSignal[];
  canaryReceipts?: readonly ClassicCanaryReceipt[];
  coverageFlushReceipts: readonly CoverageFlushGateReceipt[];
  warmEpoch: WarmEpochState;
  hardwareDiversity: readonly HardwareDiversityAssessment[];
}): QualificationEvidencePackage {
  const hasCredits = input.perCellStatus.some(
    cell => cell.validPasses > 0 || cell.retainedFailures > 0,
  );
  const statisticalAuthoritative =
    (input.ledgerSource === 'pilot' || input.ledgerSource === 'live') && hasCredits;

  return {
    kind: 'qualification-evidence',
    freezeDigests: { ...input.freezeDigests },
    ledgerSource: input.ledgerSource,
    statisticalAuthoritative,
    disclaimer: statisticalAuthoritative ? null : STATS_PROJECTION_DISCLAIMER,
    epoch: input.epoch,
    perCellStatus: [...input.perCellStatus],
    suiteSignals: [...input.suiteSignals],
    canaryReceipts: [...(input.canaryReceipts ?? [])],
    coverageFlushGate: evaluateCoverageFlushGate(input.coverageFlushReceipts),
    warmEpoch: { ...input.warmEpoch },
    hardwareDiversity: [...input.hardwareDiversity],
  };
}
