/**
 * Correlated ad-service circuit breaker. When inventory/service failures cluster
 * across tests or slots, trip open so the campaign pauses instead of burning lanes.
 */

import type { FailureArtifact, FailureClassification } from './reliabilityFailureArtifacts.ts';

export const CIRCUIT_STATES = ['closed', 'open', 'half-open'] as const;
export type CircuitState = (typeof CIRCUIT_STATES)[number];

export type CircuitBreakerOptions = {
  /** Distinct failing caseIds sharing one ad-service signature that trip open. */
  distinctCaseThreshold?: number;
  /** Total ad-service failures (any signature) in the observation window that trip open. */
  volumeThreshold?: number;
  /** Wall-clock window for clustering, in ms. */
  windowMs?: number;
  /** After open, allow a half-open probe after this cooldown (ms). */
  cooldownMs?: number;
  now?: () => number;
  /** Classifications that feed the breaker (default: ad-service only). */
  tripClassifications?: readonly FailureClassification[];
};

export type CircuitTripReason = {
  kind: 'distinct-cases' | 'volume';
  clusterKey?: string;
  count: number;
  threshold: number;
};

export type CircuitSnapshot = {
  state: CircuitState;
  openedAt: number | null;
  lastTrip: CircuitTripReason | null;
  recentAdServiceFailures: number;
  acceptingWork: boolean;
};

export type CircuitBreaker = {
  state(): CircuitSnapshot;
  /** Observe a failure artifact; may trip open. Returns whether work may continue. */
  observe(artifact: FailureArtifact): CircuitSnapshot;
  /** Operator/campaign resume after cooldown or explicit clear. */
  reset(): CircuitSnapshot;
  /**
   * Enter half-open when cooldown elapsed; a subsequent ad-service failure re-opens,
   * a successful probe (recordSuccess) closes.
   */
  maybeHalfOpen(): CircuitSnapshot;
  recordSuccess(): CircuitSnapshot;
  /** True when dispatch should refuse new work. */
  shouldPauseCampaign(): boolean;
};

type TimedFailure = {
  at: number;
  caseId: string;
  /** Correlated service key (not per-cell signature). */
  clusterKey: string;
  classification: FailureClassification;
};

export function createCircuitBreaker(
  options: CircuitBreakerOptions = {},
): CircuitBreaker {
  const distinctCaseThreshold = options.distinctCaseThreshold ?? 3;
  const volumeThreshold = options.volumeThreshold ?? 5;
  const windowMs = options.windowMs ?? 120_000;
  const cooldownMs = options.cooldownMs ?? 60_000;
  const now = options.now ?? (() => Date.now());
  const tripClassifications = new Set<FailureClassification>(
    options.tripClassifications ?? ['ad-service'],
  );

  if (distinctCaseThreshold < 1 || volumeThreshold < 1) {
    throw new Error('Circuit breaker thresholds must be >= 1.');
  }

  let state: CircuitState = 'closed';
  let openedAt: number | null = null;
  let lastTrip: CircuitTripReason | null = null;
  const recent: TimedFailure[] = [];

  function prune(at: number): void {
    const cutoff = at - windowMs;
    while (recent.length > 0 && recent[0]!.at < cutoff) {
      recent.shift();
    }
  }

  function snapshot(): CircuitSnapshot {
    prune(now());
    return {
      state,
      openedAt,
      lastTrip,
      recentAdServiceFailures: recent.length,
      acceptingWork: state === 'closed' || state === 'half-open',
    };
  }

  function trip(reason: CircuitTripReason): CircuitSnapshot {
    state = 'open';
    openedAt = now();
    lastTrip = reason;
    return snapshot();
  }

  function evaluateCluster(): CircuitTripReason | null {
    const byCluster = new Map<string, Set<string>>();
    for (const entry of recent) {
      const set = byCluster.get(entry.clusterKey) ?? new Set<string>();
      set.add(entry.caseId);
      byCluster.set(entry.clusterKey, set);
    }
    for (const [clusterKey, cases] of byCluster) {
      if (cases.size >= distinctCaseThreshold) {
        return {
          kind: 'distinct-cases',
          clusterKey,
          count: cases.size,
          threshold: distinctCaseThreshold,
        };
      }
    }
    if (recent.length >= volumeThreshold) {
      return {
        kind: 'volume',
        count: recent.length,
        threshold: volumeThreshold,
      };
    }
    return null;
  }

  function maybeHalfOpenInternal(): void {
    if (state !== 'open' || openedAt == null) return;
    if (now() - openedAt >= cooldownMs) {
      state = 'half-open';
    }
  }

  return {
    state: snapshot,
    observe(artifact) {
      const at = now();
      prune(at);

      if (!tripClassifications.has(artifact.classification)) {
        return snapshot();
      }

      if (state === 'open') {
        return snapshot();
      }

      recent.push({
        at,
        caseId: artifact.caseId,
        clusterKey: artifact.clusterKey,
        classification: artifact.classification,
      });

      if (state === 'half-open') {
        return trip({
          kind: 'volume',
          clusterKey: artifact.clusterKey,
          count: 1,
          threshold: 1,
        });
      }

      const reason = evaluateCluster();
      if (reason != null) {
        return trip(reason);
      }
      return snapshot();
    },
    reset() {
      state = 'closed';
      openedAt = null;
      lastTrip = null;
      recent.length = 0;
      return snapshot();
    },
    maybeHalfOpen() {
      maybeHalfOpenInternal();
      return snapshot();
    },
    recordSuccess() {
      if (state === 'half-open') {
        state = 'closed';
        openedAt = null;
        lastTrip = null;
        recent.length = 0;
      }
      return snapshot();
    },
    shouldPauseCampaign() {
      maybeHalfOpenInternal();
      return state === 'open';
    },
  };
}
