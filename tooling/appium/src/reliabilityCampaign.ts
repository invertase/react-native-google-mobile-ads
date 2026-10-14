/**
 * Elastic reliability campaign controller: capacity flags, leases, heartbeats,
 * steal/drain, pause/resume, device-free lane pilots, and adaptive flake reduction.
 */

import path from 'node:path';
import {
  CAPACITY_PILOT_LANES,
  createCapacityController,
  laneCount,
  parseCapacityPilotLanes,
  resolveElasticSlotSet,
  slotSetForLanePilot,
  type CapacityController,
  type CapacityPilotLanes,
  type ElasticSlotSet,
} from './reliabilityCapacity.ts';
import {
  createCircuitBreaker,
  type CircuitBreaker,
  type CircuitSnapshot,
} from './reliabilityCircuitBreaker.ts';
import {
  createEvidenceLedger,
  defaultCellDependencyDigests,
  type EvidenceLedger,
  type InvalidateScopeResult,
} from './reliabilityEvidence.ts';
import {
  createLeaseController,
  type LeaseController,
  type LeaseSnapshot,
  type WorkItem,
} from './reliabilityLeases.ts';
import { parseReliabilityMode, type ReliabilityMode } from './reliabilityModes.ts';
import { parseLayoutKind, type LayoutKind } from './reliabilityLayouts.ts';
import {
  caseIdsForReducedContext,
  createFlakeReducer,
  type FlakeReducer,
  type ReduceFailureInput,
  type ReduceFailureResult,
} from './reliabilityReducer.ts';
import {
  evaluateBurnInSuiteGate,
  greenScopeForWorkerPass,
  isRejectedRootCauseClaim,
  RISK_THRESHOLDS,
  type BurnInSuiteGateDecision,
  type ScheduledUnit,
} from './reliabilityRisk.ts';
import {
  createClassicCanaryScheduler,
  createCoverageFlushGateReceipt,
  createWarmEpochTracker,
  evaluateCoverageFlushGate,
  evaluateHardwareDiversity,
  type ClassicCanaryDecision,
  type ClassicCanaryReceipt,
  type ClassicCanaryScheduler,
  type HardwareDiversityAssessment,
  type WarmEpochState,
  type WarmEpochTracker,
} from './reliabilityQualificationOps.ts';
import {
  configurationForPlatformBackend,
  isQualifyingConfiguration,
  PRE_REGISTERED_FAILURE_CHECKPOINTS,
  ZERO_FAILURE_OBSERVATION_TARGET,
  type QualifyingConfiguration,
  type ScheduledQualificationWork,
  type StatsProjection,
  type StatCellKey,
} from './reliabilityStats.ts';
import type { ReceiptCellKind } from './reliabilityReceipts.ts';

export type CampaignControllerOptions = {
  mode: ReliabilityMode;
  layoutKind: LayoutKind;
  slotSet: ElasticSlotSet;
  dryRun: boolean;
  allowForceAcquire: boolean;
  receiptRoot: string;
  logRoot: string;
  /** When set, run the measured lane pilot instead of an operator slot set. */
  pilotLanes?: CapacityPilotLanes;
  heartbeatTimeoutMs?: number;
  /** Root for exact failure artifacts (defaults under receiptRoot). */
  artifactRoot?: string;
};

export type CampaignController = {
  options: CampaignControllerOptions;
  capacity: CapacityController;
  leases: LeaseController;
  reducer: FlakeReducer;
  breaker: CircuitBreaker;
  evidence: EvidenceLedger;
  /** Warm-epoch suite-credit tracker (cap before cold task-owned restart). */
  warmEpoch: WarmEpochTracker;
  /** Classic Android canary cadence against credited Next-Gen suite passes. */
  classicCanary: ClassicCanaryScheduler;
  pause(): void;
  resume(): void;
  heartbeat(leaseId: string, workerId: string): void;
  dispatch(item: WorkItem, workerId: string): LeaseSnapshot | null;
  stealExpired(workerId?: string): {
    stolen: LeaseSnapshot | null;
    reassignedTo: LeaseSnapshot | null;
  };
  stealBusy(item: WorkItem, workerId: string): LeaseSnapshot | null;
  finish(leaseId: string): LeaseSnapshot;
  drainAndRelease(
    release?: (slot: number, platform: 'android' | 'ios') => Promise<void>,
  ): Promise<{ released: number; failed: number; states: LeaseSnapshot[] }>;
  restartWithCapacity(next: ElasticSlotSet): Promise<LeaseSnapshot[]>;
  /** Risk-aware schedule: isolated high-risk first, then low-risk affinity groups. */
  scheduleCases(platform: 'android' | 'ios', caseIds: readonly string[]): ScheduledUnit[];
  /** Burn-in gate snapshot over the campaign risk ledger. */
  burnInGate(): BurnInSuiteGateDecision;
  /**
   * Record a failure into the flake reducer and circuit breaker. Trips pause the
   * campaign capacity when ad-service failures cluster.
   */
  noteFailure(input: ReduceFailureInput): {
    reduction: ReduceFailureResult;
    circuit: CircuitSnapshot;
    paused: boolean;
  };
  circuitState(): CircuitSnapshot;
  /** Statistical remaining-work schedule (qualifying configurations only). */
  scheduleQualification(): ScheduledQualificationWork[];
  /** Credit a qualifying cell observation into the evidence ledger. */
  creditObservation(input: {
    platform: 'android' | 'ios';
    backend?: 'classic' | 'legacy' | 'nextgen';
    cellKind: ReceiptCellKind;
    cellId: string;
    outcome: 'pass' | 'fail';
    retainedInSample?: boolean;
    layoutDigest: string;
    receiptId?: string;
    extraDigests?: Readonly<Record<string, string>>;
  }): ReturnType<EvidenceLedger['credit']> | null;
  /** Suite-level signal (independent of per-cell confidence). */
  creditSuiteOutcome(input: {
    platform: 'android' | 'ios';
    backend?: 'classic' | 'legacy' | 'nextgen';
    outcome: 'pass' | 'fail';
  }): ReturnType<EvidenceLedger['creditSuite']> | null;
  /** Current warm-epoch cap state after suite credits / cold restarts. */
  warmEpochState(): WarmEpochState;
  /** Cold task-owned state restart after the warm-epoch suite cap. */
  coldRestartWarmEpoch(): WarmEpochState;
  /** Classic canary due decision (interval / executable change / final). */
  classicCanaryDue(input?: {
    executableChangedSinceLastCanary?: boolean;
    finalValidation?: boolean;
  }): ClassicCanaryDecision;
  /** Record a completed classic Android canary receipt. */
  recordClassicCanary(input: {
    trigger: ClassicCanaryReceipt['trigger'];
    outcome: 'pass' | 'fail';
    layoutDigest: string;
    executableDigest: string;
    detail?: string;
  }): ClassicCanaryReceipt;
  /** Hardware diversity assessment for a configuration's slot/time-block set. */
  assessHardwareDiversity(input: {
    availableSlots: number;
    timeBlocks?: number;
    coldEpochCount?: number;
  }): HardwareDiversityAssessment;
  /** Scoped invalidation + epoch freeze after a reviewed dependency fix. */
  invalidateDependencyScope(
    scopeId: string,
    options?: { reason?: string; matchingDigest?: string },
  ): InvalidateScopeResult;
  /**
   * Non-authoritative in-memory stats projection for pilots/tests.
   * Ledger-derived campaign dashboards use `reliabilityDashboard`.
   */
  statsProjection(): StatsProjection;
};

function flagValue(argv: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  for (const argument of argv) {
    if (argument.startsWith(prefix)) {
      return argument.slice(prefix.length);
    }
  }
  const index = argv.indexOf(name);
  if (index >= 0) {
    return argv[index + 1];
  }
  return undefined;
}

function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(name);
}

const CAMPAIGN_FLAGS_WITH_VALUE = new Set([
  '--mode',
  '--layout',
  '--slots',
  '--android-slots',
  '--ios-slots',
  '--pilot-lanes',
  '--receipt-root',
  '--log-root',
  '--artifact-root',
  '--heartbeat-timeout-ms',
]);

function findPositionalMode(argv: readonly string[]): string | undefined {
  let index = 0;
  while (index < argv.length) {
    const argument = argv[index]!;
    if (argument.startsWith('-')) {
      const equals = argument.indexOf('=');
      const flagName = equals >= 0 ? argument.slice(0, equals) : argument;
      if (equals < 0 && CAMPAIGN_FLAGS_WITH_VALUE.has(flagName)) {
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    return argument;
  }
  return undefined;
}

/**
 * Parse elastic campaign controller CLI argv.
 * Modes may be positional or `--mode=`. Capacity via `--slots` /
 * `--android-slots` / `--ios-slots`, or `--pilot-lanes=2|4|6|8|10`.
 */
export function parseReliabilityCampaignArgv(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): CampaignControllerOptions {
  const positionalMode = findPositionalMode(argv);
  const mode = parseReliabilityMode(flagValue(argv, '--mode') ?? positionalMode);
  const layoutKind = parseLayoutKind(flagValue(argv, '--layout'));
  const pilotRaw = flagValue(argv, '--pilot-lanes');
  const pilotLanes = pilotRaw != null ? parseCapacityPilotLanes(pilotRaw) : undefined;

  let slotSet: ElasticSlotSet;
  if (pilotLanes != null) {
    slotSet = slotSetForLanePilot(pilotLanes);
  } else {
    slotSet = resolveElasticSlotSet({
      slots: flagValue(argv, '--slots'),
      androidSlots: flagValue(argv, '--android-slots'),
      iosSlots: flagValue(argv, '--ios-slots'),
    });
  }

  const heartbeatRaw = flagValue(argv, '--heartbeat-timeout-ms');
  let heartbeatTimeoutMs: number | undefined;
  if (heartbeatRaw != null && heartbeatRaw !== '') {
    if (!/^\d+$/.test(heartbeatRaw)) {
      throw new Error(
        `heartbeat-timeout-ms must be a positive integer; received "${heartbeatRaw}".`,
      );
    }
    heartbeatTimeoutMs = Number(heartbeatRaw);
    if (heartbeatTimeoutMs < 1) {
      throw new Error(`heartbeat-timeout-ms must be >= 1; received ${heartbeatTimeoutMs}.`);
    }
  }

  const receiptRoot =
    flagValue(argv, '--receipt-root') ??
    path.join('/tmp/rngma-e2e-reliability', 'campaign-receipts');
  const artifactRoot = flagValue(argv, '--artifact-root');

  return {
    mode,
    layoutKind,
    slotSet,
    dryRun: hasFlag(argv, '--dry-run'),
    allowForceAcquire:
      hasFlag(argv, '--authorize-force-acquire') || env.RNGMA_E2E_FORCE_ACQUIRE === '1',
    receiptRoot,
    logRoot:
      flagValue(argv, '--log-root') ?? path.join('/tmp/rngma-e2e-reliability', 'campaign-logs'),
    ...(artifactRoot != null ? { artifactRoot } : {}),
    ...(pilotLanes != null ? { pilotLanes } : {}),
    ...(heartbeatTimeoutMs != null ? { heartbeatTimeoutMs } : {}),
  };
}

export function createCampaignController(
  options: CampaignControllerOptions,
  clock: { now?: () => number } = {},
): CampaignController {
  const capacity = createCapacityController(options.slotSet);
  const leases = createLeaseController({
    slotSet: options.slotSet,
    heartbeatTimeoutMs: options.heartbeatTimeoutMs,
    now: clock.now,
  });
  const artifactRoot =
    options.artifactRoot ?? path.join(options.receiptRoot, 'failure-artifacts');
  const reducer = createFlakeReducer({ artifactRoot });
  const breaker = createCircuitBreaker({ now: clock.now });
  const evidence = createEvidenceLedger({
    now: clock.now != null ? () => new Date(clock.now!()) : undefined,
  });
  const warmEpoch = createWarmEpochTracker();
  const classicCanary = createClassicCanaryScheduler({
    now: clock.now != null ? () => new Date(clock.now!()) : undefined,
  });

  function resolveQualifyingConfiguration(
    platform: 'android' | 'ios',
    backend?: 'classic' | 'legacy' | 'nextgen',
  ): QualifyingConfiguration | null {
    const configuration = configurationForPlatformBackend(platform, backend);
    return isQualifyingConfiguration(configuration) ? configuration : null;
  }

  function pauseInternal(): void {
    // Idempotent: repeated circuit observations must not throw once already paused.
    if (capacity.state === 'running') {
      capacity.pause();
    }
    leases.setAcceptingWork(false);
  }

  function resumeInternal(): void {
    breaker.reset();
    if (capacity.state === 'paused') {
      capacity.resume();
    }
    leases.setAcceptingWork(true);
  }

  return {
    options,
    capacity,
    leases,
    reducer,
    breaker,
    evidence,
    warmEpoch,
    classicCanary,
    pause: pauseInternal,
    resume: resumeInternal,
    heartbeat(leaseId, workerId) {
      leases.heartbeat(leaseId, workerId);
    },
    dispatch(item, workerId) {
      if (breaker.shouldPauseCampaign()) {
        pauseInternal();
        return null;
      }
      if (capacity.state === 'paused' || capacity.state === 'draining') {
        return null;
      }
      return leases.assignWork(item, workerId);
    },
    stealExpired(workerId) {
      // Same pause/breaker gate as dispatch: trip pauses acceptingWork so reclaim
      // cannot startOnLease idle lanes. stealBusy shares this path via accept gate.
      if (breaker.shouldPauseCampaign()) {
        pauseInternal();
      }
      if (capacity.state === 'paused' || capacity.state === 'draining') {
        leases.setAcceptingWork(false);
      }
      return leases.stealExpired({ workerId });
    },
    stealBusy(item, workerId) {
      if (breaker.shouldPauseCampaign()) {
        pauseInternal();
        return null;
      }
      if (capacity.state === 'paused' || capacity.state === 'draining') {
        return null;
      }
      return leases.stealWorkFromBusy(item, workerId);
    },
    finish(leaseId) {
      return leases.finishWork(leaseId);
    },
    async drainAndRelease(release) {
      // Lease drain refuses while owned-running; only then mark capacity draining.
      await leases.beginDrain();
      capacity.beginDrain();
      const result = await leases.releaseAll(
        release ?? (async () => undefined),
      );
      capacity.markStopped();
      return { ...result, states: leases.list() };
    },
    async restartWithCapacity(next) {
      const states = leases.list();
      const releaseFailed = states.filter(lease => lease.state === 'release-failed');
      if (releaseFailed.length > 0) {
        throw new Error(
          `Cannot restart capacity while leases are release-failed (${releaseFailed
            .map(lease => lease.leaseId)
            .join(', ')}); retry release until released.`,
        );
      }
      const blocking = states.filter(
        lease => lease.state !== 'released' && lease.state !== 'not-requested',
      );
      if (blocking.length > 0) {
        throw new Error(
          `Cannot restart capacity while leases remain active (${blocking
            .map(lease => `${lease.leaseId}:${lease.state}`)
            .join(', ')}).`,
        );
      }
      capacity.restartWithCapacity(next);
      leases.replaceCapacity(next);
      await leases.acquireAll({
        dryRun: options.dryRun,
        allowForceAcquire: options.allowForceAcquire,
        async checkClear() {
          return true;
        },
      });
      return leases.list();
    },
    scheduleCases(platform, caseIds) {
      return reducer.schedule(platform, caseIds);
    },
    burnInGate() {
      return evaluateBurnInSuiteGate(reducer.ledger.list());
    },
    noteFailure(input) {
      const reduction = reducer.reduceFailure(input);
      const circuit = breaker.observe(reduction.artifact);
      let paused = false;
      if (breaker.shouldPauseCampaign()) {
        pauseInternal();
        paused = true;
      }
      return { reduction, circuit, paused };
    },
    circuitState() {
      return breaker.state();
    },
    scheduleQualification() {
      return evidence.schedule();
    },
    creditObservation(input) {
      const configuration = resolveQualifyingConfiguration(input.platform, input.backend);
      if (configuration == null) {
        return null;
      }
      const cellKey: StatCellKey = {
        configuration,
        cellKind: input.cellKind,
        cellId: input.cellId,
      };
      const dependencyDigests = defaultCellDependencyDigests({
        cellKey,
        layoutDigest: input.layoutDigest,
        extra: input.extraDigests,
      });
      return evidence.credit({
        cellKey,
        outcome: input.outcome,
        retainedInSample: input.retainedInSample,
        dependencyDigests,
        ...(input.receiptId != null ? { receiptId: input.receiptId } : {}),
      });
    },
    creditSuiteOutcome(input) {
      const configuration = resolveQualifyingConfiguration(input.platform, input.backend);
      if (configuration == null) {
        return null;
      }
      const signal = evidence.creditSuite({
        configuration,
        outcome: input.outcome,
      });
      if (input.outcome === 'pass') {
        warmEpoch.noteCreditedSuitePass();
        if (configuration === 'android-nextgen') {
          classicCanary.noteNextGenSuitePass();
        }
      }
      return signal;
    },
    warmEpochState() {
      return warmEpoch.state();
    },
    coldRestartWarmEpoch() {
      return warmEpoch.coldRestart();
    },
    classicCanaryDue(input = {}) {
      return classicCanary.decision(input);
    },
    recordClassicCanary(input) {
      return classicCanary.recordCanary(input);
    },
    assessHardwareDiversity(input) {
      return evaluateHardwareDiversity({
        availableSlots: input.availableSlots,
        timeBlocks: input.timeBlocks,
        coldEpochCount: input.coldEpochCount ?? warmEpoch.state().coldEpochCount,
      });
    },
    invalidateDependencyScope(scopeId, invalidateOptions) {
      return evidence.invalidateScopeAndFreezeEpoch(scopeId, invalidateOptions);
    },
    statsProjection() {
      return evidence.projection();
    },
  };
}

/**
 * Campaign CLI executes device-free controller actions only. Refuse live multi-slot
 * starts unless the caller is on the `--run-capacity-pilots` entry path.
 */
export function assertCampaignDryRun(options: CampaignControllerOptions): void {
  if (!options.dryRun) {
    throw new Error(
      'Elastic campaign controller executes device-free with --dry-run (leases, heartbeats, steal, drain, capacity restart). Live multi-slot device campaigns are not started from this command; attach single-slot live runners via yarn tests:appium:reliability without --dry-run when devices are ready on a dedicated checkout.',
    );
  }
}

export type CapacityPilotResult = {
  lanes: CapacityPilotLanes;
  slotSet: ElasticSlotSet;
  acquired: number;
  heartbeats: number;
  steals: number;
  drained: number;
  released: number;
  failed: number;
  restartedLanes: number;
  pauseResumeOk: boolean;
  metroDistinct: boolean;
  finalStates: LeaseSnapshot[];
};

/**
 * Device-free measured capacity pilot for 2/4/6/8/10 lanes: acquire, heartbeat,
 * steal, pause/resume, drain/release, and restart with a different lane count.
 */
export async function runCapacityPilot(
  lanes: CapacityPilotLanes,
  options: {
    now?: () => number;
    heartbeatTimeoutMs?: number;
    restartLanes?: CapacityPilotLanes;
  } = {},
): Promise<CapacityPilotResult> {
  const slotSet = slotSetForLanePilot(lanes);
  let clock = 1_000;
  const now = options.now ?? (() => clock);
  const controller = createCampaignController(
    {
      mode: 'diagnose',
      layoutKind: 'temporary',
      slotSet,
      dryRun: true,
      allowForceAcquire: false,
      receiptRoot: '/tmp/rngma-e2e-reliability/pilot-receipts',
      logRoot: '/tmp/rngma-e2e-reliability/pilot-logs',
      pilotLanes: lanes,
      heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? 100,
    },
    { now },
  );

  await controller.leases.acquireAll({ dryRun: true, async checkClear() { return true; } });
  const acquired = controller.leases.list().length;

  let heartbeats = 0;
  for (const lease of controller.leases.list()) {
    controller.heartbeat(lease.leaseId, `worker-${lease.leaseId}`);
    heartbeats += 1;
  }

  const first = controller.leases.list()[0]!;
  const assigned = controller.dispatch({ workItemId: 'work-1', preferred: {
    slot: first.slot,
    platform: first.platform,
  } }, 'worker-a');
  if (assigned == null) {
    throw new Error('Capacity pilot failed to assign initial work.');
  }

  // Expire the running lease heartbeat, then steal onto another idle lane when present.
  clock += (options.heartbeatTimeoutMs ?? 100) + 1;
  const steal = controller.stealExpired('worker-b');
  const steals = steal.stolen != null ? 1 : 0;

  controller.pause();
  const blocked = controller.dispatch({ workItemId: 'work-paused' }, 'worker-c');
  controller.resume();
  const pauseResumeOk = blocked == null;

  // Ensure metro ports/caches differ for any slot present on both platforms.
  let metroDistinct = true;
  const bySlot = new Map<number, LeaseSnapshot[]>();
  for (const lease of controller.leases.list()) {
    const list = bySlot.get(lease.slot) ?? [];
    list.push(lease);
    bySlot.set(lease.slot, list);
  }
  for (const group of bySlot.values()) {
    if (group.length < 2) continue;
    const ports = new Set(group.map(lease => lease.metro.metroPort));
    const caches = new Set(group.map(lease => lease.metro.roots.cache));
    if (ports.size !== group.length || caches.size !== group.length) {
      metroDistinct = false;
    }
  }

  if (assigned.workItemId != null && controller.leases.get({
    slot: assigned.slot,
    platform: assigned.platform,
  })?.state === 'owned-running') {
    controller.finish(assigned.leaseId);
  }
  for (const lease of controller.leases.list()) {
    if (lease.state === 'owned-running') {
      controller.finish(lease.leaseId);
    }
  }

  const drained = await controller.drainAndRelease(async () => undefined);
  const restartLanes = options.restartLanes ?? (
    lanes === 10 ? 2 : (CAPACITY_PILOT_LANES.find(value => value > lanes) ?? 2)
  );
  const nextSet = slotSetForLanePilot(restartLanes);
  await controller.restartWithCapacity(nextSet);

  return {
    lanes,
    slotSet,
    acquired,
    heartbeats,
    steals,
    drained: drained.released + drained.failed,
    released: drained.released,
    failed: drained.failed,
    restartedLanes: laneCount(nextSet),
    pauseResumeOk,
    metroDistinct,
    finalStates: controller.leases.list(),
  };
}

export async function runAllCapacityPilots(): Promise<CapacityPilotResult[]> {
  const results: CapacityPilotResult[] = [];
  for (const lanes of CAPACITY_PILOT_LANES) {
    results.push(await runCapacityPilot(lanes));
  }
  return results;
}

export type RiskPilotResult = {
  scheduledIsolated: number;
  scheduledAffinity: number;
  artifactsWritten: number;
  circuitTripped: boolean;
  circuitState: CircuitSnapshot['state'];
  probabilisticNeighbors: number;
  dispatchBlockedWhileOpen: boolean;
  resumedAcceptingWork: boolean;
  /** Burn-in gate progression exercise (separate ledger; no live Metro). */
  burnInGateClosed: boolean;
  burnInGateCellCount: number;
  burnInGateQualificationReady: number;
  hostLoadClaimRejected: boolean;
};

/**
 * Device-free adaptive flake-reducer pilot: risk scheduling, isolation,
 * probabilistic context reduction, exact artifacts, ad-service circuit trip,
 * and burn-in gate progression thresholds.
 */
export async function runRiskPilot(
  options: {
    artifactRoot?: string;
    now?: () => number;
    random?: () => number;
  } = {},
): Promise<RiskPilotResult> {
  let clock = 5_000;
  const now = options.now ?? (() => clock);
  const artifactRoot =
    options.artifactRoot ??
    path.join('/tmp/rngma-e2e-reliability', 'risk-pilot-artifacts');
  const controller = createCampaignController(
    {
      mode: 'diagnose',
      layoutKind: 'temporary',
      slotSet: { android: [1, 2], ios: [] },
      dryRun: true,
      allowForceAcquire: false,
      receiptRoot: '/tmp/rngma-e2e-reliability/risk-pilot-receipts',
      logRoot: '/tmp/rngma-e2e-reliability/risk-pilot-logs',
      artifactRoot,
    },
    { now },
  );

  // Seed low-risk passes so affinity grouping can form.
  for (let i = 0; i < 30; i += 1) {
    controller.reducer.recordPass('banner', 'android', 'candidate-shard');
    controller.reducer.recordPass('native', 'android', 'candidate-shard');
  }
  for (let i = 0; i < 10; i += 1) {
    controller.reducer.recordPass('interstitial', 'android', 'individual');
  }

  const schedule = controller.scheduleCases('android', [
    'rewarded',
    'banner',
    'native',
    'interstitial',
  ]);
  const scheduledIsolated = schedule.filter(unit => unit.kind === 'isolated').length;
  const scheduledAffinity = schedule.filter(unit => unit.kind === 'affinity').length;

  // Correlated ad-service failures across distinct cases trip the breaker.
  let circuitTripped = false;
  for (const caseId of ['rewarded', 'app-open', 'gam-interstitial'] as const) {
    const noted = controller.noteFailure({
      caseId,
      platform: 'android',
      detail: 'ERROR_CODE_NO_FILL inventory exhausted',
      neighbors: ['banner', 'native', 'interstitial'],
      retentionProbability: 0.5,
    });
    if (noted.paused) {
      circuitTripped = true;
    }
  }

  const reduction = controller.noteFailure({
    caseId: 'rewarded',
    platform: 'android',
    detail: 'ERROR_CODE_NO_FILL inventory exhausted',
    neighbors: ['banner', 'native'],
    retentionProbability: 0,
  });

  await controller.leases.acquireAll({ dryRun: true, async checkClear() { return true; } });
  const blocked = controller.dispatch(
    { workItemId: reduction.reduction.isolated.focusCaseId },
    'risk-pilot',
  );
  const dispatchBlockedWhileOpen = blocked == null && controller.circuitState().state === 'open';

  clock += 60_001;
  controller.breaker.maybeHalfOpen();
  if (controller.capacity.state === 'paused') {
    controller.resume();
  } else {
    controller.breaker.reset();
    controller.leases.setAcceptingWork(true);
  }
  const resumed = controller.dispatch({ workItemId: 'after-resume' }, 'risk-pilot');
  const resumedAcceptingWork = resumed != null;
  if (resumed != null) {
    controller.finish(resumed.leaseId);
  }

  // Deterministic probabilistic reduction sample for the pilot receipt.
  const random = options.random ?? (() => 0.25);
  const reducer = createFlakeReducer({
    artifactRoot: path.join(artifactRoot, 'probabilistic'),
    random,
    defaultRetentionProbability: 0.5,
  });
  const probabilistic = reducer.reduceFailure({
    caseId: 'collapsible-banner',
    platform: 'android',
    detail: 'timeout waiting for assertion',
    neighbors: ['banner', 'native', 'fluid'],
  });

  // Separate burn-in gate ledger: prove red→amber→green→qualification-ready
  // via worker-reachable green scopes (burn-in + final + multi-case may mint
  // final-layout *risk* credits). Still no statistical receipts / live Metro.
  const gateController = createCampaignController(
    {
      mode: 'burn-in',
      layoutKind: 'final',
      slotSet: { android: [1], ios: [] },
      dryRun: true,
      allowForceAcquire: false,
      receiptRoot: path.join(artifactRoot, 'burn-in-gate-receipts'),
      logRoot: path.join(artifactRoot, 'burn-in-gate-logs'),
      artifactRoot: path.join(artifactRoot, 'burn-in-gate-artifacts'),
    },
    { now },
  );
  const gateCase = 'banner';
  const gateMode = 'burn-in' as const;
  const gateLayout = 'final' as const;
  const individualScope = greenScopeForWorkerPass({
    mode: gateMode,
    layoutKind: gateLayout,
    coRunCaseCount: 1,
  });
  const candidateScope = greenScopeForWorkerPass({
    mode: gateMode,
    layoutKind: 'temporary',
    coRunCaseCount: 2,
  });
  const finalScope = greenScopeForWorkerPass({
    mode: gateMode,
    layoutKind: gateLayout,
    coRunCaseCount: 2,
  });
  for (let i = 0; i < RISK_THRESHOLDS.amberIndividualGreens; i += 1) {
    gateController.reducer.recordPass(gateCase, 'android', individualScope);
  }
  for (let i = 0; i < RISK_THRESHOLDS.greenCandidateShardGreens; i += 1) {
    gateController.reducer.recordPass(gateCase, 'android', candidateScope);
  }
  for (
    let i = 0;
    i < RISK_THRESHOLDS.qualificationReadyFinalLayoutGreens;
    i += 1
  ) {
    gateController.reducer.recordPass(gateCase, 'android', finalScope);
  }
  const burnInGate = gateController.burnInGate();
  const hostLoadClaimRejected = isRejectedRootCauseClaim(
    'failed because of host load / CPU pressure on the Mac',
  );

  return {
    scheduledIsolated,
    scheduledAffinity,
    artifactsWritten: controller.reducer.artifacts.list().length,
    circuitTripped,
    circuitState: controller.circuitState().state,
    probabilisticNeighbors: probabilistic.probabilistic.retainedNeighbors.length,
    dispatchBlockedWhileOpen,
    resumedAcceptingWork,
    burnInGateClosed: burnInGate.closed,
    burnInGateCellCount: burnInGate.cellCount,
    burnInGateQualificationReady: burnInGate.qualificationReadyCount,
    hostLoadClaimRejected,
  };
}

export type StatsPilotResult = {
  zeroFailureTarget: number;
  checkpointsLocked: number;
  creditedPasses: number;
  retainedFailures: number;
  unaffectedCellStillValid: boolean;
  invalidatedCredits: number;
  epochAfterInvalidation: number;
  suiteIndependent: boolean;
  scheduleRemaining: number;
  projectionAuthoritative: false;
  projectionDisclaimer: string;
  warmEpochCapReached: boolean;
  warmEpochColdRestartClearsCap: boolean;
  hardwareDiversityReducedDisclosed: boolean;
  hardwareDiversityRequirementMetAfterColdEpochs: boolean;
  classicCanaryDueAtInterval: boolean;
  classicCanaryDueOnExecutableChange: boolean;
  /** True when complete pass receipts for flush/pull/report evaluate ok. */
  coverageFlushGateOk: boolean;
  /** True when missing or failed flush-gate receipts evaluate not-ok. */
  coverageFlushGateFailsWhenIncomplete: boolean;
};

/**
 * Device-free statistical qualification pilot: CP checkpoints, independent cell
 * credits, scoped invalidation + epoch freeze, suite signal separation, and a
 * non-authoritative in-memory projection (dashboard authority is separate).
 */
export async function runStatsPilot(
  options: {
    layoutDigest?: string;
  } = {},
): Promise<StatsPilotResult> {
  const layoutDigest = options.layoutDigest ?? 'layout-digest-pilot';
  const controller = createCampaignController({
    mode: 'qualify',
    layoutKind: 'final',
    slotSet: { android: [1], ios: [1] },
    dryRun: true,
    allowForceAcquire: false,
    receiptRoot: '/tmp/rngma-e2e-reliability/stats-pilot-receipts',
    logRoot: '/tmp/rngma-e2e-reliability/stats-pilot-logs',
  });

  const bannerDigests = {
    'case:android-nextgen:banner': 'digest-banner-v1',
  };
  const nativeDigests = {
    'case:android-nextgen:native': 'digest-native-v1',
  };

  // Credit cells independently; a later native failure must not erase banner.
  for (let i = 0; i < 3; i += 1) {
    controller.creditObservation({
      platform: 'android',
      backend: 'nextgen',
      cellKind: 'test',
      cellId: 'banner',
      outcome: 'pass',
      layoutDigest,
      extraDigests: bannerDigests,
    });
  }
  controller.creditObservation({
    platform: 'android',
    backend: 'nextgen',
    cellKind: 'test',
    cellId: 'native',
    outcome: 'pass',
    layoutDigest,
    extraDigests: nativeDigests,
  });
  controller.creditObservation({
    platform: 'android',
    backend: 'nextgen',
    cellKind: 'test',
    cellId: 'native',
    outcome: 'fail',
    retainedInSample: true,
    layoutDigest,
    extraDigests: nativeDigests,
  });
  // Classic never enters the statistical ledger.
  const classicIgnored = controller.creditObservation({
    platform: 'android',
    backend: 'classic',
    cellKind: 'test',
    cellId: 'banner',
    outcome: 'pass',
    layoutDigest,
  });

  controller.creditSuiteOutcome({
    platform: 'android',
    backend: 'nextgen',
    outcome: 'pass',
  });
  controller.creditSuiteOutcome({
    platform: 'android',
    backend: 'nextgen',
    outcome: 'fail',
  });

  const beforeBanner = controller.evidence.cellStatus({
    configuration: 'android-nextgen',
    cellKind: 'test',
    cellId: 'banner',
  });
  const invalidation = controller.invalidateDependencyScope(
    'case:android-nextgen:native',
    {
      reason: 'reviewed-native-fix',
      matchingDigest: 'digest-native-v1',
    },
  );
  const afterBanner = controller.evidence.cellStatus({
    configuration: 'android-nextgen',
    cellKind: 'test',
    cellId: 'banner',
  });
  const afterNative = controller.evidence.cellStatus({
    configuration: 'android-nextgen',
    cellKind: 'test',
    cellId: 'native',
  });
  const suite = controller.evidence.suiteSignal('android-nextgen');
  const projection = controller.statsProjection();
  const schedule = controller.scheduleQualification();

  // Warm-epoch cap: credit suites to the cap, then cold-restart clears it.
  while (!controller.warmEpochState().mustColdRestart) {
    controller.creditSuiteOutcome({
      platform: 'android',
      backend: 'nextgen',
      outcome: 'pass',
    });
  }
  const warmEpochCapReached = controller.warmEpochState().mustColdRestart;
  const afterCold = controller.coldRestartWarmEpoch();
  const warmEpochColdRestartClearsCap =
    afterCold.mustColdRestart === false &&
    afterCold.creditedSuitesInWarmEpoch === 0 &&
    afterCold.coldEpochCount >= 1;

  // Hardware diversity: fewer than preferred slots requires cold epochs + disclosure.
  const reducedDiversity = controller.assessHardwareDiversity({
    availableSlots: 1,
    coldEpochCount: 0,
  });
  const reducedDiversityMet = controller.assessHardwareDiversity({
    availableSlots: 1,
    coldEpochCount: 60,
  });

  // Classic canary cadence: continue Next-Gen suite credits to the interval, plus executable change.
  while (!controller.classicCanaryDue().triggers.includes('interval')) {
    controller.creditSuiteOutcome({
      platform: 'android',
      backend: 'nextgen',
      outcome: 'pass',
    });
  }
  const classicIntervalDue = controller.classicCanaryDue();
  const classicExecutableDue = controller.classicCanaryDue({
    executableChangedSinceLastCanary: true,
  });

  // Coverage flush gate: missing/failed receipts fail; complete pass receipts succeed.
  const incompleteFlushGate = evaluateCoverageFlushGate([
    createCoverageFlushGateReceipt({
      stage: 'flush',
      outcome: 'pass',
      receiptId: 'stats-pilot-flush-incomplete',
    }),
  ]);
  const failedFlushGate = evaluateCoverageFlushGate([
    createCoverageFlushGateReceipt({
      stage: 'flush',
      outcome: 'fail',
      receiptId: 'stats-pilot-flush-fail',
      detail: 'control missing',
    }),
    createCoverageFlushGateReceipt({
      stage: 'pull',
      outcome: 'pass',
      receiptId: 'stats-pilot-pull-fail-case',
    }),
    createCoverageFlushGateReceipt({
      stage: 'report',
      outcome: 'pass',
      receiptId: 'stats-pilot-report-fail-case',
    }),
  ]);
  const completeFlushGate = evaluateCoverageFlushGate([
    createCoverageFlushGateReceipt({
      stage: 'flush',
      outcome: 'pass',
      receiptId: 'stats-pilot-flush-ok',
    }),
    createCoverageFlushGateReceipt({
      stage: 'pull',
      outcome: 'pass',
      receiptId: 'stats-pilot-pull-ok',
    }),
    createCoverageFlushGateReceipt({
      stage: 'report',
      outcome: 'pass',
      receiptId: 'stats-pilot-report-ok',
    }),
  ]);

  return {
    zeroFailureTarget: ZERO_FAILURE_OBSERVATION_TARGET,
    checkpointsLocked: PRE_REGISTERED_FAILURE_CHECKPOINTS.length,
    creditedPasses: beforeBanner.validPasses,
    retainedFailures: 1,
    unaffectedCellStillValid:
      classicIgnored == null &&
      afterBanner.validPasses === beforeBanner.validPasses &&
      afterBanner.validPasses === 3 &&
      afterNative.validPasses === 0 &&
      afterNative.retainedFailures === 0,
    invalidatedCredits: invalidation.invalidatedCredits,
    epochAfterInvalidation: invalidation.newEpoch,
    suiteIndependent:
      suite.independentOfPerCell === true &&
      suite.creditedSuitePasses >= 1 &&
      suite.suiteFailures === 1 &&
      afterBanner.qualified === false,
    scheduleRemaining: schedule.reduce((sum, row) => sum + row.remaining, 0),
    projectionAuthoritative: projection.authoritative,
    projectionDisclaimer: projection.disclaimer,
    warmEpochCapReached,
    warmEpochColdRestartClearsCap,
    hardwareDiversityReducedDisclosed:
      reducedDiversity.reducedHardwareDiversity === true &&
      reducedDiversity.diversityRequirementMet === false,
    hardwareDiversityRequirementMetAfterColdEpochs:
      reducedDiversityMet.reducedHardwareDiversity === true &&
      reducedDiversityMet.diversityRequirementMet === true,
    classicCanaryDueAtInterval: classicIntervalDue.due === true,
    classicCanaryDueOnExecutableChange:
      classicExecutableDue.due === true &&
      classicExecutableDue.triggers.includes('executable-change'),
    coverageFlushGateOk: completeFlushGate.ok === true,
    coverageFlushGateFailsWhenIncomplete:
      incompleteFlushGate.ok === false && failedFlushGate.ok === false,
  };
}

/** Re-export for callers that build diagnose case lists from reduced context. */
export { caseIdsForReducedContext };
