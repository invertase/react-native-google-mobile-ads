/**
 * Per-slot, per-platform Metro ownership for reliability workers.
 * Android and iOS listeners on the same slot number are distinct (ports + cache roots).
 */

import {
  platformMetroPort,
  slotMetroPackagerEnv,
  slotMetroRoots,
  type OperationalPlatform,
  type SlotMetroRoots,
} from './slots.ts';

export type SlotPlatformMetroOwnership = {
  slot: number;
  platform: OperationalPlatform;
  metroPort: number;
  roots: SlotMetroRoots;
  /** Owner identity string for logs and lease snapshots. */
  ownerId: string;
};

export function metroOwnershipForSlotPlatform(
  slot: number,
  platform: OperationalPlatform,
): SlotPlatformMetroOwnership {
  const roots = slotMetroRoots(slot, platform);
  return {
    slot,
    platform,
    metroPort: platformMetroPort(slot, platform),
    roots,
    ownerId: `metro:${platform}:slot-${slot}:${platformMetroPort(slot, platform)}`,
  };
}

/**
 * Env for a reliability shard child: slot/platform Metro owner, dedicated port,
 * and isolated cache/temp roots (never collapse Android and iOS on one listener).
 */
export function reliabilityMetroEnv(
  slot: number,
  platform: OperationalPlatform,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const metro = metroOwnershipForSlotPlatform(slot, platform);
  const packagerEnv = slotMetroPackagerEnv(slot, platform, baseEnv);
  return {
    ...packagerEnv,
    RNGMA_E2E_SLOT: String(slot),
    RNGMA_E2E_PLATFORM: platform,
    RNGMA_E2E_METRO_SLOT: String(slot),
    RNGMA_METRO_PORT: String(metro.metroPort),
  };
}

/** Assert two same-slot platforms never share port or cache root. */
export function assertDistinctPlatformMetro(slot: number): {
  android: SlotPlatformMetroOwnership;
  ios: SlotPlatformMetroOwnership;
} {
  const android = metroOwnershipForSlotPlatform(slot, 'android');
  const ios = metroOwnershipForSlotPlatform(slot, 'ios');
  if (android.metroPort === ios.metroPort) {
    throw new Error(
      `Android and iOS Metro ports must differ for slot ${slot}; both resolved ${android.metroPort}.`,
    );
  }
  if (android.roots.cache === ios.roots.cache || android.roots.root === ios.roots.root) {
    throw new Error(
      `Android and iOS Metro cache roots must differ for slot ${slot}.`,
    );
  }
  return { android, ios };
}
