/**
 * Elastic capacity parsing and pause/resume for the reliability campaign controller.
 * Slot lists are operator-facing; lane pilots stay device-free in harness tests.
 */

import { assertRngmaSlotAllowed, MAX_SLOT, MIN_SLOT } from './slots.ts';

export const CAPACITY_PILOT_LANES = [2, 4, 6, 8, 10] as const;

export type CapacityPilotLanes = (typeof CAPACITY_PILOT_LANES)[number];

export type ElasticSlotSet = {
  android: readonly number[];
  ios: readonly number[];
};

export type CapacityControllerState = 'running' | 'paused' | 'draining' | 'stopped';

/**
 * Parse a comma-separated operational slot list (1-7, unique, non-empty).
 */
export function parseElasticSlotList(value: string | undefined, flagName: string): number[] {
  if (value == null || value.trim() === '') {
    throw new Error(`${flagName} requires a non-empty comma-separated slot list.`);
  }
  const parts = value.split(',');
  const slots: number[] = [];
  for (const part of parts) {
    if (part === '') {
      throw new Error(`${flagName} contains an empty slot entry.`);
    }
    if (!/^\d+$/.test(part)) {
      throw new Error(
        `${flagName} must be an integer from ${MIN_SLOT} to ${MAX_SLOT}; received "${part}".`,
      );
    }
    const slot = Number(part);
    if (slot < MIN_SLOT || slot > MAX_SLOT) {
      throw new Error(
        `${flagName} must be an integer from ${MIN_SLOT} to ${MAX_SLOT}; received "${part}".`,
      );
    }
    try {
      assertRngmaSlotAllowed(slot);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message.replaceAll('RNGMA_E2E_SLOT', flagName));
    }
    slots.push(slot);
  }
  if (new Set(slots).size !== slots.length) {
    throw new Error(`${flagName} contains a duplicate slot.`);
  }
  return slots;
}

/**
 * Resolve Android/iOS slot sets from elastic capacity flags.
 *
 * - `--slots` applies to both platforms when platform-specific flags are omitted.
 * - `--android-slots` / `--ios-slots` override per platform.
 * - At least one platform must receive a non-empty list.
 */
export function resolveElasticSlotSet(options: {
  slots?: string;
  androidSlots?: string;
  iosSlots?: string;
}): ElasticSlotSet {
  const shared = options.slots != null ? parseElasticSlotList(options.slots, '--slots') : undefined;
  const android =
    options.androidSlots != null
      ? parseElasticSlotList(options.androidSlots, '--android-slots')
      : shared;
  const ios =
    options.iosSlots != null ? parseElasticSlotList(options.iosSlots, '--ios-slots') : shared;

  if ((android == null || android.length === 0) && (ios == null || ios.length === 0)) {
    throw new Error(
      'Elastic capacity requires --slots and/or --android-slots / --ios-slots with at least one platform list.',
    );
  }

  return {
    android: android ?? [],
    ios: ios ?? [],
  };
}

export function laneCount(slotSet: ElasticSlotSet): number {
  return slotSet.android.length + slotSet.ios.length;
}

export function parseCapacityPilotLanes(value: string | undefined): CapacityPilotLanes {
  if (value == null || value === '') {
    throw new Error(
      `Capacity pilot lanes must be one of ${CAPACITY_PILOT_LANES.join(', ')}; received empty.`,
    );
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Capacity pilot lanes must be one of ${CAPACITY_PILOT_LANES.join(', ')}; received "${value}".`,
    );
  }
  const parsed = Number(value) as CapacityPilotLanes;
  if (!(CAPACITY_PILOT_LANES as readonly number[]).includes(parsed)) {
    throw new Error(
      `Capacity pilot lanes must be one of ${CAPACITY_PILOT_LANES.join(', ')}; received ${parsed}.`,
    );
  }
  return parsed;
}

/**
 * Build a deterministic device-free slot set for a measured lane pilot.
 * Each lane is one `(slot, platform)` pair. Candidates walk the common
 * nonserial pool `[1,2,4,5,6,7]` with Android then iOS per slot.
 */
export function slotSetForLanePilot(lanes: CapacityPilotLanes): ElasticSlotSet {
  const pool = [1, 2, 4, 5, 6, 7] as const;
  const candidates: Array<{ platform: 'android' | 'ios'; slot: number }> = [];
  for (const slot of pool) {
    candidates.push({ platform: 'android', slot }, { platform: 'ios', slot });
  }
  if (lanes > candidates.length) {
    throw new Error(
      `Capacity pilot lanes ${lanes} exceeds available nonserial platform lanes (${candidates.length}).`,
    );
  }
  const android: number[] = [];
  const ios: number[] = [];
  for (const candidate of candidates.slice(0, lanes)) {
    if (candidate.platform === 'android') {
      android.push(candidate.slot);
    } else {
      ios.push(candidate.slot);
    }
  }
  return { android, ios };
}

export type CapacityController = {
  state: CapacityControllerState;
  slotSet: ElasticSlotSet;
  pause(): void;
  resume(): void;
  beginDrain(): void;
  markStopped(): void;
  /** Replace capacity while stopped or after drain; refuses while running work. */
  restartWithCapacity(next: ElasticSlotSet): ElasticSlotSet;
};

export function createCapacityController(initial: ElasticSlotSet): CapacityController {
  let state: CapacityControllerState = 'running';
  let slotSet: ElasticSlotSet = {
    android: [...initial.android],
    ios: [...initial.ios],
  };
  if (laneCount(slotSet) < 1) {
    throw new Error('Capacity controller requires at least one platform lane.');
  }

  return {
    get state() {
      return state;
    },
    get slotSet() {
      return slotSet;
    },
    pause() {
      if (state !== 'running') {
        throw new Error(`Cannot pause capacity from state ${state}.`);
      }
      state = 'paused';
    },
    resume() {
      if (state !== 'paused') {
        throw new Error(`Cannot resume capacity from state ${state}.`);
      }
      state = 'running';
    },
    beginDrain() {
      if (state === 'stopped') {
        throw new Error('Cannot drain capacity that is already stopped.');
      }
      state = 'draining';
    },
    markStopped() {
      state = 'stopped';
    },
    restartWithCapacity(next) {
      if (state === 'running' || state === 'paused') {
        throw new Error(
          `Cannot restart capacity from state ${state}; drain or stop first.`,
        );
      }
      if (laneCount(next) < 1) {
        throw new Error('Restart capacity requires at least one platform lane.');
      }
      slotSet = {
        android: [...next.android],
        ios: [...next.ios],
      };
      state = 'running';
      return slotSet;
    },
  };
}
