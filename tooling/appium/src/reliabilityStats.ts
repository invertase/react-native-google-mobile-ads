/**
 * Statistical qualification policy, Clopper–Pearson bounds, pre-registered
 * failure checkpoints, and a device-free scheduler for per-cell remaining work.
 *
 * Suite-level reliability is a separate signal from per-cell confidence.
 * In-memory projection payloads stay non-authoritative for pilots/workers.
 * Campaign truth is the ledger-derived dashboard in `reliabilityDashboard`
 * (authoritative only for real pilot/live ledgers with credits).
 */

import type { ReceiptCellKind } from './reliabilityReceipts.ts';

/** Initial acceptance confidence (one-sided). */
export const QUALIFICATION_CONFIDENCE = 0.95 as const;
/** α = 1 − confidence for one-sided Clopper–Pearson upper bounds. */
export const QUALIFICATION_ALPHA = 1 - QUALIFICATION_CONFIDENCE;
/** Maximum non-actionable failure rate under the active policy. */
export const QUALIFICATION_MAX_FLAKE_RATE = 0.001 as const;

/**
 * Zero-failure observation target:
 * `ceil(log(α) / log(1 − p_max)) = ceil(log(0.05) / log(0.999)) = 2,995`.
 */
export const ZERO_FAILURE_OBSERVATION_TARGET = Math.ceil(
  Math.log(QUALIFICATION_ALPHA) / Math.log(1 - QUALIFICATION_MAX_FLAKE_RATE),
);

export type QualificationPolicy = {
  confidence: typeof QUALIFICATION_CONFIDENCE;
  alpha: typeof QUALIFICATION_ALPHA;
  maxFlakeRate: typeof QUALIFICATION_MAX_FLAKE_RATE;
  zeroFailureObservationTarget: typeof ZERO_FAILURE_OBSERVATION_TARGET;
};

export const QUALIFICATION_POLICY: QualificationPolicy = {
  confidence: QUALIFICATION_CONFIDENCE,
  alpha: QUALIFICATION_ALPHA,
  maxFlakeRate: QUALIFICATION_MAX_FLAKE_RATE,
  zeroFailureObservationTarget: ZERO_FAILURE_OBSERVATION_TARGET,
};

/**
 * Configurations that pursue the statistical observation target.
 * Classic Android is canary-only and never enters this set.
 */
export const QUALIFYING_CONFIGURATIONS = ['android-nextgen', 'ios'] as const;
export type QualifyingConfiguration = (typeof QUALIFYING_CONFIGURATIONS)[number];

export const CANARY_CONFIGURATIONS = ['android-classic'] as const;
export type CanaryConfiguration = (typeof CANARY_CONFIGURATIONS)[number];

export type ReliabilityConfiguration = QualifyingConfiguration | CanaryConfiguration;

export function isQualifyingConfiguration(
  value: string,
): value is QualifyingConfiguration {
  return (QUALIFYING_CONFIGURATIONS as readonly string[]).includes(value);
}

export function configurationForPlatformBackend(
  platform: 'android' | 'ios',
  backend?: 'classic' | 'legacy' | 'nextgen',
): ReliabilityConfiguration {
  if (platform === 'ios') return 'ios';
  if (backend === 'classic' || backend === 'legacy') return 'android-classic';
  return 'android-nextgen';
}

/**
 * Pre-registered (retainedFailures → requiredObservations) checkpoints under
 * one-sided Clopper–Pearson at α=0.05 and p_max=0.001. The locked table is
 * pre-registration: one terminal look per retained-failure count `k` when
 * `n ≥ n(k)`, not sequential alpha spending across looks. Values are the
 * minimal n with U(k,n) ≤ p_max.
 */
export type FailureCheckpoint = {
  retainedFailures: number;
  requiredObservations: number;
};

export const PRE_REGISTERED_FAILURE_CHECKPOINTS: readonly FailureCheckpoint[] = [
  { retainedFailures: 0, requiredObservations: 2995 },
  { retainedFailures: 1, requiredObservations: 4742 },
  { retainedFailures: 2, requiredObservations: 6294 },
  { retainedFailures: 3, requiredObservations: 7752 },
  { retainedFailures: 4, requiredObservations: 9151 },
  { retainedFailures: 5, requiredObservations: 10511 },
  { retainedFailures: 6, requiredObservations: 11840 },
  { retainedFailures: 7, requiredObservations: 13146 },
  { retainedFailures: 8, requiredObservations: 14432 },
] as const;

const CHECKPOINT_BY_FAILURES = new Map(
  PRE_REGISTERED_FAILURE_CHECKPOINTS.map(row => [row.retainedFailures, row]),
);

export function checkpointForRetainedFailures(retainedFailures: number): FailureCheckpoint {
  if (!Number.isInteger(retainedFailures) || retainedFailures < 0) {
    throw new Error(
      `retainedFailures must be a non-negative integer; received ${retainedFailures}.`,
    );
  }
  const locked = CHECKPOINT_BY_FAILURES.get(retainedFailures);
  if (locked != null) return locked;
  // Beyond the locked table: compute on demand but label as extension (still
  // uses the same CP rule; operators should extend the pre-registered table
  // before relying on higher k in a live campaign).
  const required = minObservationsForRetainedFailures(retainedFailures);
  return { retainedFailures, requiredObservations: required };
}

/** Binomial CDF P(X ≤ k | n, p) for small k via multiplicative terms. */
export function binomialCdfLeq(k: number, n: number, p: number): number {
  if (k < 0) return 0;
  if (k >= n) return 1;
  if (p <= 0) return 1;
  if (p >= 1) return k >= n ? 1 : 0;
  const q = 1 - p;
  let term = q ** n;
  let sum = term;
  for (let i = 1; i <= k; i += 1) {
    term *= ((n - i + 1) / i) * (p / q);
    sum += term;
  }
  return sum;
}

/**
 * One-sided Clopper–Pearson upper bound at confidence 1−α:
 * smallest p_U such that P(X ≤ k | n, p_U) ≤ α (solved by bisection).
 */
export function clopperPearsonUpperBound(
  failures: number,
  observations: number,
  alpha: number = QUALIFICATION_ALPHA,
): number {
  if (!Number.isInteger(failures) || failures < 0) {
    throw new Error(`failures must be a non-negative integer; received ${failures}.`);
  }
  if (!Number.isInteger(observations) || observations < 1) {
    throw new Error(
      `observations must be a positive integer; received ${observations}.`,
    );
  }
  if (!(alpha > 0 && alpha < 1)) {
    throw new Error(`alpha must be in (0,1); received ${alpha}.`);
  }
  if (failures >= observations) return 1;
  if (failures === 0) {
    return 1 - alpha ** (1 / observations);
  }
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    const cdf = binomialCdfLeq(failures, observations, mid);
    if (cdf > alpha) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/** Minimal n such that the CP upper bound for k failures is ≤ p_max. */
export function minObservationsForRetainedFailures(
  retainedFailures: number,
  options: {
    maxFlakeRate?: number;
    alpha?: number;
  } = {},
): number {
  const maxFlakeRate = options.maxFlakeRate ?? QUALIFICATION_MAX_FLAKE_RATE;
  const alpha = options.alpha ?? QUALIFICATION_ALPHA;
  if (!Number.isInteger(retainedFailures) || retainedFailures < 0) {
    throw new Error(
      `retainedFailures must be a non-negative integer; received ${retainedFailures}.`,
    );
  }
  if (retainedFailures === 0) {
    return Math.ceil(Math.log(alpha) / Math.log(1 - maxFlakeRate));
  }
  let n = retainedFailures + 1;
  while (clopperPearsonUpperBound(retainedFailures, n, alpha) > maxFlakeRate) {
    n = Math.max(n + 1, Math.floor(n * 1.2));
    if (n > 5_000_000) {
      throw new Error(
        `Unable to find observation target for ${retainedFailures} retained failures.`,
      );
    }
  }
  let lo = retainedFailures + 1;
  let hi = n;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (clopperPearsonUpperBound(retainedFailures, mid, alpha) <= maxFlakeRate) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

export function assertPreRegisteredCheckpointsConsistent(): void {
  for (const row of PRE_REGISTERED_FAILURE_CHECKPOINTS) {
    const computed = minObservationsForRetainedFailures(row.retainedFailures);
    if (computed !== row.requiredObservations) {
      throw new Error(
        `Checkpoint drift for k=${row.retainedFailures}: locked=${row.requiredObservations} computed=${computed}.`,
      );
    }
    const bound = clopperPearsonUpperBound(
      row.retainedFailures,
      row.requiredObservations,
    );
    if (bound > QUALIFICATION_MAX_FLAKE_RATE) {
      throw new Error(
        `Checkpoint k=${row.retainedFailures} n=${row.requiredObservations} has upper bound ${bound} > p_max.`,
      );
    }
    if (row.requiredObservations > row.retainedFailures) {
      const prior = clopperPearsonUpperBound(
        row.retainedFailures,
        row.requiredObservations - 1,
      );
      if (prior <= QUALIFICATION_MAX_FLAKE_RATE) {
        throw new Error(
          `Checkpoint k=${row.retainedFailures} n=${row.requiredObservations} is not minimal (n-1 also qualifies).`,
        );
      }
    }
  }
  if (ZERO_FAILURE_OBSERVATION_TARGET !== 2995) {
    throw new Error(
      `Zero-failure target drifted: expected 2995, got ${ZERO_FAILURE_OBSERVATION_TARGET}.`,
    );
  }
}

export type StatCellKey = {
  configuration: QualifyingConfiguration;
  cellKind: ReceiptCellKind;
  cellId: string;
};

export function statCellKeyString(key: StatCellKey): string {
  return `${key.configuration}\0${key.cellKind}\0${key.cellId}`;
}

export type CellQualificationStatus = {
  cellKey: StatCellKey;
  epoch: number;
  validPasses: number;
  retainedFailures: number;
  /** Passes + retained failures counted toward the active checkpoint. */
  validObservations: number;
  requiredObservations: number;
  remaining: number;
  qualified: boolean;
  upperBound: number | null;
  checkpoint: FailureCheckpoint;
};

export function evaluateCellQualification(input: {
  cellKey: StatCellKey;
  epoch: number;
  validPasses: number;
  retainedFailures: number;
}): CellQualificationStatus {
  const checkpoint = checkpointForRetainedFailures(input.retainedFailures);
  const validObservations = input.validPasses + input.retainedFailures;
  const upperBound =
    validObservations > 0
      ? clopperPearsonUpperBound(input.retainedFailures, validObservations)
      : null;
  const qualified =
    validObservations >= checkpoint.requiredObservations &&
    (upperBound == null || upperBound <= QUALIFICATION_MAX_FLAKE_RATE);
  return {
    cellKey: input.cellKey,
    epoch: input.epoch,
    validPasses: input.validPasses,
    retainedFailures: input.retainedFailures,
    validObservations,
    requiredObservations: checkpoint.requiredObservations,
    remaining: Math.max(0, checkpoint.requiredObservations - validObservations),
    qualified,
    upperBound,
    checkpoint,
  };
}

/**
 * Suite-level final-layout reliability. Intentionally not derived from
 * per-cell qualification — per-test confidence never implies whole-job confidence.
 */
export type SuiteSignal = {
  configuration: QualifyingConfiguration;
  epoch: number;
  creditedSuitePasses: number;
  suiteFailures: number;
  independentOfPerCell: true;
};

export type ScheduledQualificationWork = {
  cellKey: StatCellKey;
  remaining: number;
  retainedFailures: number;
  requiredObservations: number;
  priority: number;
};

/**
 * Schedule unfinished qualifying cells by remaining observations (descending),
 * with startup/preamble slightly preferred over tests at equal remaining so
 * session cells do not starve behind a large semantic matrix.
 */
export function scheduleQualificationWork(
  statuses: readonly CellQualificationStatus[],
): ScheduledQualificationWork[] {
  const kindWeight = (kind: ReceiptCellKind): number => {
    if (kind === 'startup') return 0;
    if (kind === 'preamble') return 1;
    return 2;
  };
  return statuses
    .filter(status => !status.qualified && isQualifyingConfiguration(status.cellKey.configuration))
    .map(status => ({
      cellKey: status.cellKey,
      remaining: status.remaining,
      retainedFailures: status.retainedFailures,
      requiredObservations: status.requiredObservations,
      priority: status.remaining * 10 - kindWeight(status.cellKey.cellKind),
    }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return statCellKeyString(a.cellKey).localeCompare(statCellKeyString(b.cellKey));
    });
}

export const STATS_PROJECTION_DISCLAIMER =
  'manual/untested projection — no statistical counts' as const;

export type StatsProjection = {
  kind: 'manual-untested-projection';
  /**
   * Always false for the in-memory worker/campaign projection. Authoritative
   * statistical counts live only on ledger-derived dashboard documents from
   * `reliabilityDashboard` when the ledger source is pilot/live with credits.
   */
  authoritative: false;
  disclaimer: typeof STATS_PROJECTION_DISCLAIMER;
  policy: QualificationPolicy;
  epoch: number;
  cells: CellQualificationStatus[];
  suites: SuiteSignal[];
  schedule: ScheduledQualificationWork[];
};
