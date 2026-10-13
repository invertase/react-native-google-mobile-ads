/**
 * Multi-slot leases, heartbeats, work stealing, and graceful drain/release.
 * Generalizes single-slot ownership states across an elastic capacity set.
 */

import {
  createSlotOwnership,
  type OwnershipState,
  type SlotOwnership,
} from './reliabilityOwnership.ts';
import type { ElasticSlotSet } from './reliabilityCapacity.ts';
import {
  metroOwnershipForSlotPlatform,
  type SlotPlatformMetroOwnership,
} from './reliabilityMetro.ts';

export type ReliabilityPlatform = 'android' | 'ios';

export type LeaseKey = {
  slot: number;
  platform: ReliabilityPlatform;
};

export type WorkItem = {
  workItemId: string;
  /** Optional affinity; steal may ignore affinity when reclaiming expired leases. */
  preferred?: LeaseKey;
};

export type LeaseSnapshot = {
  leaseId: string;
  slot: number;
  platform: ReliabilityPlatform;
  state: OwnershipState;
  workerId: string | null;
  workItemId: string | null;
  lastHeartbeatAt: number;
  metro: SlotPlatformMetroOwnership;
};

export type LeaseControllerOptions = {
  slotSet: ElasticSlotSet;
  heartbeatTimeoutMs?: number;
  now?: () => number;
  createLeaseId?: (key: LeaseKey) => string;
};

const DEFAULT_HEARTBEAT_TIMEOUT_MS = 30_000;

function leaseIdFor(key: LeaseKey): string {
  return `lease_${key.platform}_${key.slot}`;
}

function keyId(key: LeaseKey): string {
  return `${key.platform}:${key.slot}`;
}

function expandSlotSet(slotSet: ElasticSlotSet): LeaseKey[] {
  return [
    ...slotSet.android.map(slot => ({ slot, platform: 'android' as const })),
    ...slotSet.ios.map(slot => ({ slot, platform: 'ios' as const })),
  ];
}

type InternalLease = {
  leaseId: string;
  key: LeaseKey;
  ownership: SlotOwnership;
  workerId: string | null;
  workItemId: string | null;
  lastHeartbeatAt: number;
  metro: SlotPlatformMetroOwnership;
};

export type LeaseController = {
  list(): LeaseSnapshot[];
  get(key: LeaseKey): LeaseSnapshot | undefined;
  /** Move all not-requested leases through acquire → owned-idle. */
  acquireAll(deps: {
    checkClear(slot: number, platform: ReliabilityPlatform): Promise<boolean>;
    forceAcquire?(slot: number, platform: ReliabilityPlatform): Promise<void>;
    allowForceAcquire?: boolean;
    dryRun?: boolean;
  }): Promise<LeaseSnapshot[]>;
  heartbeat(leaseId: string, workerId: string): void;
  /** Assign work to an owned-idle lease; also drains any steal queue onto remaining idle. */
  assignWork(item: WorkItem, workerId: string): LeaseSnapshot | null;
  finishWork(leaseId: string): LeaseSnapshot;
  /**
   * Steal: reclaim a lease whose heartbeat expired (owned-running or owned-idle)
   * and reassign optional work to a healthy owned-idle lease (or queue until idle).
   */
  stealExpired(options?: {
    reassignWorkTo?: string;
    workerId?: string;
  }): { stolen: LeaseSnapshot | null; reassignedTo: LeaseSnapshot | null };
  /**
   * Steal queued affinity work from a busy preferred lease onto an idle alternate.
   */
  stealWorkFromBusy(item: WorkItem, workerId: string): LeaseSnapshot | null;
  /**
   * Begin graceful drain. Refuses while any lease is owned-running (finish work first).
   * Idle leases transition owned-idle → draining via begin-release.
   */
  beginDrain(): Promise<void>;
  releaseAll(release: (slot: number, platform: ReliabilityPlatform) => Promise<void>): Promise<{
    released: number;
    failed: number;
  }>;
  /** Replace lease table after capacity restart (caller must have drained/released). */
  replaceCapacity(slotSet: ElasticSlotSet): void;
  enqueue(item: WorkItem): void;
  queueDepth(): number;
  setAcceptingWork(accepting: boolean): void;
};

export function createLeaseController(options: LeaseControllerOptions): LeaseController {
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
  const now = options.now ?? (() => Date.now());
  const createLeaseId = options.createLeaseId ?? leaseIdFor;

  let acceptingWork = true;
  const queue: WorkItem[] = [];
  const leases = new Map<string, InternalLease>();

  function materialize(slotSet: ElasticSlotSet): void {
    leases.clear();
    for (const key of expandSlotSet(slotSet)) {
      const id = keyId(key);
      if (leases.has(id)) {
        throw new Error(`Duplicate lease key ${id} in elastic capacity.`);
      }
      leases.set(id, {
        leaseId: createLeaseId(key),
        key,
        ownership: createSlotOwnership(key.slot, key.platform),
        workerId: null,
        workItemId: null,
        lastHeartbeatAt: 0,
        metro: metroOwnershipForSlotPlatform(key.slot, key.platform),
      });
    }
  }

  materialize(options.slotSet);

  function snapshot(lease: InternalLease): LeaseSnapshot {
    return {
      leaseId: lease.leaseId,
      slot: lease.key.slot,
      platform: lease.key.platform,
      state: lease.ownership.state,
      workerId: lease.workerId,
      workItemId: lease.workItemId,
      lastHeartbeatAt: lease.lastHeartbeatAt,
      metro: lease.metro,
    };
  }

  function findByLeaseId(leaseId: string): InternalLease {
    for (const lease of leases.values()) {
      if (lease.leaseId === leaseId) return lease;
    }
    throw new Error(`Unknown lease id ${leaseId}.`);
  }

  function idleLeases(): InternalLease[] {
    return [...leases.values()].filter(lease => lease.ownership.state === 'owned-idle');
  }

  function startOnLease(target: InternalLease, item: WorkItem, workerId: string): LeaseSnapshot {
    target.ownership.apply('start-work');
    target.workerId = workerId;
    target.workItemId = item.workItemId;
    target.lastHeartbeatAt = now();
    return snapshot(target);
  }

  function pickIdleFor(item: WorkItem, excludeLeaseId?: string): InternalLease | undefined {
    const preferred =
      item.preferred != null ? leases.get(keyId(item.preferred)) : undefined;
    if (
      preferred?.ownership.state === 'owned-idle' &&
      preferred.leaseId !== excludeLeaseId
    ) {
      return preferred;
    }
    return idleLeases().find(lease => lease.leaseId !== excludeLeaseId);
  }

  /** Dequeue steal/affinity work onto owned-idle leases. */
  function drainQueue(workerId: string): LeaseSnapshot | null {
    if (!acceptingWork) return null;
    let last: LeaseSnapshot | null = null;
    while (queue.length > 0) {
      const idle = idleLeases()[0];
      if (idle == null) break;
      const item = queue.shift()!;
      const target = pickIdleFor(item) ?? idle;
      last = startOnLease(target, item, workerId);
    }
    return last;
  }

  function assignWork(item: WorkItem, workerId: string): LeaseSnapshot | null {
    if (!acceptingWork) return null;
    // Dequeue stolen/queued work onto idle lanes before binding a new item so
    // one-lane / all-busy steals are not stranded on the queue.
    drainQueue(workerId);
    const target = pickIdleFor(item);
    if (target == null) return null;
    const assigned = startOnLease(target, item, workerId);
    drainQueue(workerId);
    return assigned;
  }

  return {
    list() {
      return [...leases.values()].map(snapshot);
    },
    get(key) {
      const lease = leases.get(keyId(key));
      return lease ? snapshot(lease) : undefined;
    },
    async acquireAll(deps) {
      for (const lease of leases.values()) {
        if (lease.ownership.state !== 'not-requested') {
          continue;
        }
        if (deps.dryRun) {
          lease.ownership.apply('request');
          lease.ownership.apply('acquired');
        } else {
          lease.ownership.apply('request');
          try {
            const clear = await deps.checkClear(lease.key.slot, lease.key.platform);
            if (!clear) {
              if (!deps.allowForceAcquire || deps.forceAcquire == null) {
                throw new Error(
                  `Slot ${lease.key.slot}/${lease.key.platform} is busy; authorize force-acquire or free it first.`,
                );
              }
              await deps.forceAcquire(lease.key.slot, lease.key.platform);
              const after = await deps.checkClear(lease.key.slot, lease.key.platform);
              if (!after) {
                throw new Error(
                  `Slot ${lease.key.slot}/${lease.key.platform} remained busy after force-acquire.`,
                );
              }
            }
            lease.ownership.apply('acquired');
          } catch (error) {
            if (lease.ownership.state === 'acquiring') {
              lease.ownership.apply('acquire-failed');
            }
            throw error;
          }
        }
        lease.lastHeartbeatAt = now();
      }
      return [...leases.values()].map(snapshot);
    },
    heartbeat(leaseId, workerId) {
      const lease = findByLeaseId(leaseId);
      if (lease.ownership.state !== 'owned-idle' && lease.ownership.state !== 'owned-running') {
        throw new Error(
          `Cannot heartbeat lease ${leaseId} in state ${lease.ownership.state}.`,
        );
      }
      lease.workerId = workerId;
      lease.lastHeartbeatAt = now();
    },
    assignWork,
    finishWork(leaseId) {
      const lease = findByLeaseId(leaseId);
      lease.ownership.apply('finish-work');
      lease.workItemId = null;
      lease.lastHeartbeatAt = now();
      const snap = snapshot(lease);
      const workerId = lease.workerId ?? 'dispatcher';
      drainQueue(workerId);
      return snap;
    },
    stealExpired(stealOptions = {}) {
      const expired = [...leases.values()].find(lease => {
        if (
          lease.ownership.state !== 'owned-running' &&
          lease.ownership.state !== 'owned-idle'
        ) {
          return false;
        }
        if (lease.lastHeartbeatAt === 0) return false;
        return now() - lease.lastHeartbeatAt > heartbeatTimeoutMs;
      });
      if (expired == null) {
        return { stolen: null, reassignedTo: null };
      }
      const stolenWork = expired.workItemId;
      if (expired.ownership.state === 'owned-running') {
        expired.ownership.apply('finish-work');
      }
      expired.workerId = null;
      expired.workItemId = null;
      expired.lastHeartbeatAt = now();
      const stolen = snapshot(expired);

      let reassignedTo: LeaseSnapshot | null = null;
      if (stolenWork != null) {
        const workItemId = stealOptions.reassignWorkTo ?? stolenWork;
        const workerId = stealOptions.workerId ?? 'stealer';
        // Prefer a different idle lane. When every other lane is busy (or the set
        // is one-lane), queue the stolen work and drain onto the reclaimed idle.
        const alternate = idleLeases().find(lease => lease.leaseId !== expired.leaseId);
        if (alternate != null) {
          reassignedTo = startOnLease(
            alternate,
            {
              workItemId,
              preferred: { slot: alternate.key.slot, platform: alternate.key.platform },
            },
            workerId,
          );
        } else {
          queue.unshift({ workItemId, preferred: expired.key });
          reassignedTo = drainQueue(workerId);
        }
      }
      return { stolen, reassignedTo };
    },
    stealWorkFromBusy(item, workerId) {
      if (!acceptingWork) return null;
      if (item.preferred == null) {
        return assignWork(item, workerId);
      }
      const preferred = leases.get(keyId(item.preferred));
      if (preferred == null || preferred.ownership.state !== 'owned-running') {
        return assignWork(item, workerId);
      }
      const alternate = idleLeases().find(
        lease =>
          !(
            lease.key.slot === item.preferred!.slot &&
            lease.key.platform === item.preferred!.platform
          ),
      );
      if (alternate == null) {
        queue.push(item);
        return null;
      }
      const assigned = startOnLease(alternate, item, workerId);
      drainQueue(workerId);
      return assigned;
    },
    async beginDrain() {
      const running = [...leases.values()].filter(
        lease => lease.ownership.state === 'owned-running',
      );
      if (running.length > 0) {
        throw new Error(
          `Cannot begin drain while leases are owned-running (${running
            .map(lease => lease.leaseId)
            .join(', ')}); finish work first.`,
        );
      }
      acceptingWork = false;
      queue.length = 0;
      for (const lease of leases.values()) {
        if (lease.ownership.state === 'owned-idle') {
          // Documented path: owned-idle → draining via begin-release.
          lease.ownership.apply('begin-release');
        }
      }
    },
    async releaseAll(release) {
      let released = 0;
      let failed = 0;
      for (const lease of leases.values()) {
        if (lease.ownership.state === 'draining') {
          try {
            await release(lease.key.slot, lease.key.platform);
            lease.ownership.apply('release-ok');
            released += 1;
          } catch {
            lease.ownership.apply('release-fail');
            failed += 1;
          }
          lease.workerId = null;
          lease.workItemId = null;
        } else if (lease.ownership.state === 'release-failed') {
          try {
            lease.ownership.apply('begin-release');
            await release(lease.key.slot, lease.key.platform);
            lease.ownership.apply('release-ok');
            released += 1;
          } catch {
            lease.ownership.apply('release-fail');
            failed += 1;
          }
        }
      }
      return { released, failed };
    },
    replaceCapacity(slotSet) {
      for (const lease of leases.values()) {
        if (lease.ownership.state === 'release-failed') {
          throw new Error(
            `Cannot replace capacity while lease ${lease.leaseId} is release-failed; retry release until released.`,
          );
        }
        if (
          lease.ownership.state !== 'released' &&
          lease.ownership.state !== 'not-requested'
        ) {
          throw new Error(
            `Cannot replace capacity while lease ${lease.leaseId} is ${lease.ownership.state}.`,
          );
        }
      }
      materialize(slotSet);
      acceptingWork = true;
      queue.length = 0;
    },
    enqueue(item) {
      queue.push(item);
    },
    queueDepth() {
      return queue.length;
    },
    setAcceptingWork(next) {
      acceptingWork = next;
    },
  };
}
