/**
 * Single-slot ownership transitions for the reliability worker.
 * Elastic multi-slot leases generalize these states later.
 */

export const OWNERSHIP_STATES = [
  'not-requested',
  'acquiring',
  'owned-idle',
  'owned-running',
  'draining',
  'released',
  'release-failed',
] as const;

export type OwnershipState = (typeof OWNERSHIP_STATES)[number];

export type OwnershipTransition =
  | 'request'
  | 'acquired'
  | 'acquire-failed'
  | 'start-work'
  | 'finish-work'
  | 'begin-release'
  | 'release-ok'
  | 'release-fail';

const TRANSITIONS: Record<OwnershipState, Partial<Record<OwnershipTransition, OwnershipState>>> = {
  'not-requested': {
    request: 'acquiring',
  },
  acquiring: {
    acquired: 'owned-idle',
    'acquire-failed': 'not-requested',
  },
  'owned-idle': {
    'start-work': 'owned-running',
    'begin-release': 'draining',
  },
  'owned-running': {
    'finish-work': 'owned-idle',
    'begin-release': 'draining',
  },
  draining: {
    'release-ok': 'released',
    'release-fail': 'release-failed',
  },
  released: {},
  'release-failed': {
    'begin-release': 'draining',
  },
};

export type SlotOwnership = {
  slot: number;
  platform: 'android' | 'ios';
  state: OwnershipState;
  apply(transition: OwnershipTransition): OwnershipState;
};

export function createSlotOwnership(
  slot: number,
  platform: 'android' | 'ios',
): SlotOwnership {
  if (!Number.isInteger(slot) || slot < 1 || slot > 7) {
    throw new Error(`Ownership slot must be an operational RNGMA slot 1-7; received ${slot}.`);
  }
  let state: OwnershipState = 'not-requested';
  return {
    slot,
    platform,
    get state() {
      return state;
    },
    apply(transition) {
      const next = TRANSITIONS[state][transition];
      if (next == null) {
        throw new Error(
          `Invalid ownership transition ${transition} from ${state} for slot ${slot}/${platform}.`,
        );
      }
      state = next;
      return state;
    },
  };
}

export type SlotAcquireDeps = {
  checkClear(slot: number, platform: 'android' | 'ios'): Promise<boolean>;
  /**
   * Optional authorized displacement. When omitted, acquire fails if not clear.
   * Never targets serial resources; callers must pass exact nonserial slots only.
   */
  forceAcquire?(slot: number, platform: 'android' | 'ios'): Promise<void>;
};

/**
 * Acquire one slot into owned-idle. Uses check-first; optional force-acquire
 * only when the caller already authorized displacement.
 */
export async function acquireSingleSlot(
  ownership: SlotOwnership,
  deps: SlotAcquireDeps,
  options: { allowForceAcquire?: boolean } = {},
): Promise<OwnershipState> {
  ownership.apply('request');
  try {
    const clear = await deps.checkClear(ownership.slot, ownership.platform);
    if (!clear) {
      if (!options.allowForceAcquire || deps.forceAcquire == null) {
        throw new Error(
          `Slot ${ownership.slot}/${ownership.platform} is busy; authorize force-acquire or free it first.`,
        );
      }
      await deps.forceAcquire(ownership.slot, ownership.platform);
      const after = await deps.checkClear(ownership.slot, ownership.platform);
      if (!after) {
        throw new Error(
          `Slot ${ownership.slot}/${ownership.platform} remained busy after force-acquire.`,
        );
      }
    }
    return ownership.apply('acquired');
  } catch (error) {
    if (ownership.state === 'acquiring') {
      ownership.apply('acquire-failed');
    }
    throw error;
  }
}

export async function releaseSingleSlot(
  ownership: SlotOwnership,
  release: (slot: number, platform: 'android' | 'ios') => Promise<void>,
): Promise<OwnershipState> {
  ownership.apply('begin-release');
  try {
    await release(ownership.slot, ownership.platform);
    return ownership.apply('release-ok');
  } catch (error) {
    ownership.apply('release-fail');
    throw error;
  }
}
