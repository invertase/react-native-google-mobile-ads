/**
 * Per-test risk colors and risk-aware scheduling.
 * High-risk tests stay isolated; low-risk tests may share affinity groups.
 *
 * Progression (consecutive greens; any unresolved failure resets to red):
 * - red → amber at 10 individual greens
 * - amber → green at 30 candidate-shard greens
 * - green → qualification-ready at 100 full final-layout greens
 */

export const RISK_COLORS = ['red', 'amber', 'green', 'qualification-ready'] as const;
export type RiskColor = (typeof RISK_COLORS)[number];

export const RISK_THRESHOLDS = {
  amberIndividualGreens: 10,
  greenCandidateShardGreens: 30,
  qualificationReadyFinalLayoutGreens: 100,
} as const;

export type GreenScope = 'individual' | 'candidate-shard' | 'final-layout';

/**
 * Map a worker pass onto a risk green scope (ED-08 vocabulary).
 *
 * - isolated (single co-running case) → individual (amber@10)
 * - multi-case candidate shard → candidate-shard (green@30)
 * - full final layout in qualify only → final-layout (qualification-ready@100)
 *
 * diagnose / burn-in never mint final-layout qualification credits, even on
 * `--layout=final`.
 */
export function greenScopeForWorkerPass(options: {
  mode: 'diagnose' | 'burn-in' | 'qualify';
  layoutKind: 'temporary' | 'final';
  /** Cases that co-ran in the same shard/unit (layout digest membership). */
  coRunCaseCount: number;
}): GreenScope {
  if (options.coRunCaseCount <= 1) {
    return 'individual';
  }
  if (options.mode === 'qualify' && options.layoutKind === 'final') {
    return 'final-layout';
  }
  return 'candidate-shard';
}

export type RiskCellKey = {
  caseId: string;
  platform: 'android' | 'ios';
};

export type RiskCellState = {
  caseId: string;
  platform: 'android' | 'ios';
  color: RiskColor;
  consecutiveIndividualGreens: number;
  consecutiveCandidateShardGreens: number;
  consecutiveFinalLayoutGreens: number;
  unresolvedFailure: boolean;
  lastFailureSignature: string | null;
};

export type ScheduledUnit = {
  unitId: string;
  kind: 'isolated' | 'affinity';
  caseIds: readonly string[];
  platform: 'android' | 'ios';
  /** Highest (most severe) risk among cases in the unit. */
  risk: RiskColor;
  workItemId: string;
};

function cellKey(key: RiskCellKey): string {
  return `${key.platform}\0${key.caseId}`;
}

function emptyCell(key: RiskCellKey): RiskCellState {
  return {
    caseId: key.caseId,
    platform: key.platform,
    color: 'red',
    consecutiveIndividualGreens: 0,
    consecutiveCandidateShardGreens: 0,
    consecutiveFinalLayoutGreens: 0,
    unresolvedFailure: false,
    lastFailureSignature: null,
  };
}

/** Lower index is higher risk (scheduled sooner / more isolation). */
export function riskSeverity(color: RiskColor): number {
  return RISK_COLORS.indexOf(color);
}

export function maxRisk(a: RiskColor, b: RiskColor): RiskColor {
  return riskSeverity(a) <= riskSeverity(b) ? a : b;
}

/**
 * Derive color from consecutive counters and unresolved-failure flag.
 * Unresolved failure always forces red regardless of counters.
 */
export function deriveRiskColor(state: Omit<RiskCellState, 'color'>): RiskColor {
  if (state.unresolvedFailure) {
    return 'red';
  }
  if (
    state.consecutiveFinalLayoutGreens >= RISK_THRESHOLDS.qualificationReadyFinalLayoutGreens
  ) {
    return 'qualification-ready';
  }
  if (state.consecutiveCandidateShardGreens >= RISK_THRESHOLDS.greenCandidateShardGreens) {
    return 'green';
  }
  if (state.consecutiveIndividualGreens >= RISK_THRESHOLDS.amberIndividualGreens) {
    return 'amber';
  }
  return 'red';
}

export type RiskLedger = {
  get(key: RiskCellKey): RiskCellState;
  list(): RiskCellState[];
  /** Record a pass at the given green scope; clears unresolved failure. */
  recordPass(key: RiskCellKey, scope: GreenScope): RiskCellState;
  /**
   * Record a failure. Resets consecutive greens, marks unresolved failure,
   * and forces red. Optional signature retained for artifact correlation.
   */
  recordFailure(key: RiskCellKey, signature?: string): RiskCellState;
  /** Clear unresolved-failure only after a reviewed fix (does not invent greens). */
  clearUnresolvedFailure(key: RiskCellKey): RiskCellState;
};

export function createRiskLedger(
  seed: readonly RiskCellState[] = [],
): RiskLedger {
  const cells = new Map<string, RiskCellState>();
  for (const cell of seed) {
    cells.set(cellKey(cell), { ...cell, color: deriveRiskColor(cell) });
  }

  function ensure(key: RiskCellKey): RiskCellState {
    const id = cellKey(key);
    const existing = cells.get(id);
    if (existing) return existing;
    const created = emptyCell(key);
    cells.set(id, created);
    return created;
  }

  function commit(next: RiskCellState): RiskCellState {
    const withColor = { ...next, color: deriveRiskColor(next) };
    cells.set(cellKey(withColor), withColor);
    return withColor;
  }

  return {
    get(key) {
      return { ...ensure(key) };
    },
    list() {
      return [...cells.values()].map(cell => ({ ...cell }));
    },
    recordPass(key, scope) {
      const current = ensure(key);
      const next: RiskCellState = {
        ...current,
        unresolvedFailure: false,
        consecutiveIndividualGreens: current.consecutiveIndividualGreens + 1,
        consecutiveCandidateShardGreens:
          scope === 'candidate-shard' || scope === 'final-layout'
            ? current.consecutiveCandidateShardGreens + 1
            : current.consecutiveCandidateShardGreens,
        consecutiveFinalLayoutGreens:
          scope === 'final-layout'
            ? current.consecutiveFinalLayoutGreens + 1
            : current.consecutiveFinalLayoutGreens,
      };
      return commit(next);
    },
    recordFailure(key, signature) {
      const current = ensure(key);
      return commit({
        ...current,
        consecutiveIndividualGreens: 0,
        consecutiveCandidateShardGreens: 0,
        consecutiveFinalLayoutGreens: 0,
        unresolvedFailure: true,
        lastFailureSignature: signature ?? current.lastFailureSignature,
      });
    },
    clearUnresolvedFailure(key) {
      const current = ensure(key);
      return commit({ ...current, unresolvedFailure: false });
    },
  };
}

export type ScheduleByRiskOptions = {
  platform: 'android' | 'ios';
  caseIds: readonly string[];
  ledger: RiskLedger;
  /**
   * Maximum cases per low-risk affinity group. Red (and optionally amber) stay
   * isolated regardless of this cap.
   */
  affinityGroupSize?: number;
  /** When true, amber also runs isolated (default true — early hardening). */
  isolateAmber?: boolean;
};

/**
 * Build a priority schedule: highest-risk isolated units first, then affinity
 * groups of green / qualification-ready (and amber when not isolating amber).
 */
export function scheduleByRisk(options: ScheduleByRiskOptions): ScheduledUnit[] {
  const affinityGroupSize = options.affinityGroupSize ?? 4;
  if (affinityGroupSize < 1) {
    throw new Error(`affinityGroupSize must be >= 1; received ${affinityGroupSize}.`);
  }
  const isolateAmber = options.isolateAmber ?? true;
  const platform = options.platform;

  const ranked = options.caseIds.map(caseId => {
    const state = options.ledger.get({ caseId, platform });
    return { caseId, risk: state.color };
  });

  ranked.sort((left, right) => {
    const severity = riskSeverity(left.risk) - riskSeverity(right.risk);
    if (severity !== 0) return severity;
    return left.caseId.localeCompare(right.caseId);
  });

  const units: ScheduledUnit[] = [];
  let affinityBuffer: Array<{ caseId: string; risk: RiskColor }> = [];

  function flushAffinity(): void {
    while (affinityBuffer.length > 0) {
      const chunk = affinityBuffer.splice(0, affinityGroupSize);
      const risk = chunk.reduce(
        (acc, item) => maxRisk(acc, item.risk),
        'qualification-ready' as RiskColor,
      );
      const caseIds = chunk.map(item => item.caseId);
      const unitId = `affinity_${platform}_${caseIds.join('+')}`;
      units.push({
        unitId,
        kind: 'affinity',
        caseIds,
        platform,
        risk,
        workItemId: unitId,
      });
    }
  }

  for (const item of ranked) {
    const isolate =
      item.risk === 'red' || (isolateAmber && item.risk === 'amber');
    if (isolate) {
      flushAffinity();
      const unitId = `isolated_${platform}_${item.caseId}`;
      units.push({
        unitId,
        kind: 'isolated',
        caseIds: [item.caseId],
        platform,
        risk: item.risk,
        workItemId: unitId,
      });
      continue;
    }
    affinityBuffer.push(item);
    if (affinityBuffer.length >= affinityGroupSize) {
      flushAffinity();
    }
  }
  flushAffinity();
  return units;
}
