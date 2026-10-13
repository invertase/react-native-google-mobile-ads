/**
 * Elastic reliability campaign controller: capacity flags, leases, heartbeats,
 * steal/drain, pause/resume, and device-free lane pilots.
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
  createLeaseController,
  type LeaseController,
  type LeaseSnapshot,
  type WorkItem,
} from './reliabilityLeases.ts';
import { parseReliabilityMode, type ReliabilityMode } from './reliabilityModes.ts';
import { parseLayoutKind, type LayoutKind } from './reliabilityLayouts.ts';

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
};

export type CampaignController = {
  options: CampaignControllerOptions;
  capacity: CapacityController;
  leases: LeaseController;
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

  return {
    mode,
    layoutKind,
    slotSet,
    dryRun: hasFlag(argv, '--dry-run'),
    allowForceAcquire:
      hasFlag(argv, '--authorize-force-acquire') || env.RNGMA_E2E_FORCE_ACQUIRE === '1',
    receiptRoot:
      flagValue(argv, '--receipt-root') ??
      path.join('/tmp/rngma-e2e-reliability', 'campaign-receipts'),
    logRoot:
      flagValue(argv, '--log-root') ?? path.join('/tmp/rngma-e2e-reliability', 'campaign-logs'),
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

  return {
    options,
    capacity,
    leases,
    pause() {
      capacity.pause();
      leases.setAcceptingWork(false);
    },
    resume() {
      capacity.resume();
      leases.setAcceptingWork(true);
    },
    heartbeat(leaseId, workerId) {
      leases.heartbeat(leaseId, workerId);
    },
    dispatch(item, workerId) {
      if (capacity.state === 'paused' || capacity.state === 'draining') {
        return null;
      }
      return leases.assignWork(item, workerId);
    },
    stealExpired(workerId) {
      return leases.stealExpired({ workerId });
    },
    stealBusy(item, workerId) {
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
