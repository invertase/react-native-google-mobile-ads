/**
 * Named reliability campaign modes (single-slot worker and elastic controller).
 */

export const RELIABILITY_MODES = ['diagnose', 'burn-in', 'qualify'] as const;

export type ReliabilityMode = (typeof RELIABILITY_MODES)[number];

export type ReliabilityModePolicy = {
  mode: ReliabilityMode;
  /** Default full-layout iterations when the operator omits --iterations. */
  defaultIterations: number;
  /**
   * Runner-level bail is always off for reliability jobs: a failed shard must
   * not cancel later shards in the same layout iteration. Mocha bail stays on
   * inside each shard process.
   */
  runnerBail: false;
  mochaBailWithinShard: true;
  /** Whether append-only receipts may mark cells as statistically countable. */
  creditsReceipts: boolean;
  summary: string;
};

const MODE_POLICIES: Record<ReliabilityMode, ReliabilityModePolicy> = {
  diagnose: {
    mode: 'diagnose',
    defaultIterations: 1,
    runnerBail: false,
    mochaBailWithinShard: true,
    creditsReceipts: false,
    summary:
      'Single-iteration investigation; full failure logs; receipts are not statistical credits.',
  },
  'burn-in': {
    mode: 'burn-in',
    defaultIterations: 10,
    runnerBail: false,
    mochaBailWithinShard: true,
    creditsReceipts: false,
    summary:
      'Repeated layout iterations for the burn-in gate (consecutive-green hardening toward qualification-ready); receipts are not statistical qualification credits.',
  },
  qualify: {
    mode: 'qualify',
    defaultIterations: 1,
    runnerBail: false,
    mochaBailWithinShard: true,
    creditsReceipts: true,
    summary:
      'Qualification iteration; append-only receipts may credit startup/preamble/test cells exactly once.',
  },
};

export function isReliabilityMode(value: string): value is ReliabilityMode {
  return (RELIABILITY_MODES as readonly string[]).includes(value);
}

export function reliabilityModePolicy(mode: ReliabilityMode): ReliabilityModePolicy {
  return MODE_POLICIES[mode];
}

export function parseReliabilityMode(value: string | undefined): ReliabilityMode {
  if (value == null || value === '') {
    throw new Error(
      `Reliability mode is required; expected one of ${RELIABILITY_MODES.join(', ')}.`,
    );
  }
  if (!isReliabilityMode(value)) {
    throw new Error(
      `Unknown reliability mode "${value}"; expected one of ${RELIABILITY_MODES.join(', ')}.`,
    );
  }
  return value;
}
