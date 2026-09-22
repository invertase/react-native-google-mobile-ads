import {
  assertRngmaSlotAllowed,
  parseSlot,
  runtimeResources,
  slotAndroidApkPath,
  slotIosAppPath,
} from './slots.ts';
import {
  WDIO_SMOKE_SPECS,
  type WdioSmokeSpec,
} from './wdioSpecs.ts';

export type ParallelPlatform = 'android' | 'ios';

export type ParallelAssignment = {
  label: 'a-primary' | 'b-secondary' | 'c-tertiary';
  slot: number;
  spec: WdioSmokeSpec;
  testCount: number;
};

export const PARALLEL_ASSIGNMENTS: readonly ParallelAssignment[] = [
  {
    label: 'a-primary',
    slot: 1,
    spec: WDIO_SMOKE_SPECS[0],
    testCount: 15,
  },
  {
    label: 'b-secondary',
    slot: 2,
    spec: WDIO_SMOKE_SPECS[1],
    testCount: 6,
  },
  {
    label: 'c-tertiary',
    slot: 4,
    spec: WDIO_SMOKE_SPECS[2],
    testCount: 4,
  },
] as const;

export const PARALLEL_SLOTS_ENV = 'RNGMA_E2E_PARALLEL_SLOTS';

export function parseParallelSlots(value: string | undefined): number[] {
  const raw = value == null ? ['1', '2', '4'] : value.split(',');
  if (raw.length !== 3) {
    throw new Error(`${PARALLEL_SLOTS_ENV} must contain exactly three comma-separated slots.`);
  }
  const slots = raw.map(item => {
    if (item === '') {
      throw new Error(`${PARALLEL_SLOTS_ENV} contains an empty slot.`);
    }
    const slot = parseSlot(item);
    if (slot == null) throw new Error(`${PARALLEL_SLOTS_ENV} contains an empty slot.`);
    assertRngmaSlotAllowed(slot);
    return slot;
  });
  if (new Set(slots).size !== slots.length) {
    throw new Error(`${PARALLEL_SLOTS_ENV} contains a duplicate slot.`);
  }
  return slots;
}

export type ParallelPlanEntry = ParallelAssignment & {
  env: NodeJS.ProcessEnv;
  metroPort: number;
  appiumPort: number;
  automationPort: number;
  mjpegPort: number;
  device: string;
  logPath: string;
  androidApkPath?: string;
  iosAppPath?: string;
};

export function validateParallelAssignments(
  assignments: readonly ParallelAssignment[],
): void {
  if (assignments.length !== WDIO_SMOKE_SPECS.length) {
    throw new Error('Parallel mapping must contain exactly three assignments.');
  }
  const slots = assignments.map(entry => entry.slot);
  if (slots.some(slot => slot === 0 || slot === 3)) {
    throw new Error('Parallel mapping must never include slot 0 or reserved slot 3.');
  }
  if (new Set(slots).size !== slots.length) {
    throw new Error('Parallel mapping contains a duplicate slot.');
  }
  const specs = assignments.map(entry => entry.spec);
  if (
    new Set(specs).size !== WDIO_SMOKE_SPECS.length ||
    WDIO_SMOKE_SPECS.some(spec => !specs.includes(spec))
  ) {
    throw new Error('Parallel mapping must contain every smoke spec exactly once.');
  }
  for (const [index, entry] of assignments.entries()) {
    const locked = PARALLEL_ASSIGNMENTS[index];
    if (!locked || entry.label !== locked.label || entry.spec !== locked.spec) {
      throw new Error(
        `Parallel mapping position ${index + 1} must use ${locked?.label ?? 'unknown'} and its exact spec.`,
      );
    }
  }
}

export function createParallelPlan(
  platform: ParallelPlatform,
  baseEnv: NodeJS.ProcessEnv = process.env,
): ParallelPlanEntry[] {
  for (const name of [
    'RNGMA_E2E_SLOT',
    'RNGMA_E2E_PLATFORM',
    'RNGMA_WDIO_SPEC',
    'RNGMA_E2E_METRO_SLOT',
    'RNGMA_METRO_PORT',
    'RNGMA_APPIUM_PORT',
  ]) {
    if (baseEnv[name] != null && baseEnv[name] !== '') {
      throw new Error(`${name} conflicts with the parallel parent contract.`);
    }
  }
  const slots = parseParallelSlots(baseEnv[PARALLEL_SLOTS_ENV]);
  const assignments = PARALLEL_ASSIGNMENTS.map((assignment, index) => ({
    ...assignment,
    slot: slots[index]!,
  }));
  validateParallelAssignments(assignments);
  const metroOwnerSlot = slots[0]!;
  return assignments.map(assignment => {
    const env = {
      ...baseEnv,
      RNGMA_E2E_SLOT: String(assignment.slot),
      RNGMA_E2E_PLATFORM: platform,
      RNGMA_E2E_METRO_SLOT: String(metroOwnerSlot),
      RNGMA_WDIO_SPEC: assignment.spec,
    };
    const runtime = runtimeResources(platform, env);
    const device =
      platform === 'android'
        ? runtime.slotResources!.androidSerial
        : runtime.slotResources!.iosSimulatorName;
    return {
      ...assignment,
      env,
      metroPort: runtime.metroPort,
      appiumPort: runtime.appiumPort,
      automationPort: runtime.slotResources!.automationPort,
      mjpegPort: runtime.slotResources!.mjpegPort,
      device,
      logPath: `/tmp/rngma-e2e-${platform}-slot-${assignment.slot}-${assignment.label}.log`,
      ...(platform === 'android'
        ? { androidApkPath: slotAndroidApkPath(assignment.slot) }
        : { iosAppPath: slotIosAppPath(assignment.slot) }),
    };
  });
}
