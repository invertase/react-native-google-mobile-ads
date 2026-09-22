import { runtimeResources, slotIosAppPath } from './slots.ts';
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

export type ParallelPlanEntry = ParallelAssignment & {
  env: NodeJS.ProcessEnv;
  metroPort: number;
  appiumPort: number;
  automationPort: number;
  mjpegPort: number;
  device: string;
  logPath: string;
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
  const expected = new Map(
    PARALLEL_ASSIGNMENTS.map(entry => [
      entry.label,
      { slot: entry.slot, spec: entry.spec },
    ]),
  );
  for (const entry of assignments) {
    const locked = expected.get(entry.label);
    if (!locked || entry.slot !== locked.slot || entry.spec !== locked.spec) {
      throw new Error(
        `Parallel mapping for ${entry.label} must use slot ${locked?.slot ?? 'unknown'} and its exact spec.`,
      );
    }
  }
}

export function createParallelPlan(
  platform: ParallelPlatform,
  baseEnv: NodeJS.ProcessEnv = process.env,
): ParallelPlanEntry[] {
  validateParallelAssignments(PARALLEL_ASSIGNMENTS);
  return PARALLEL_ASSIGNMENTS.map(assignment => {
    const env = {
      ...baseEnv,
      RNGMA_E2E_SLOT: String(assignment.slot),
      RNGMA_E2E_PLATFORM: platform,
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
      ...(platform === 'ios'
        ? { iosAppPath: slotIosAppPath(assignment.slot) }
        : {}),
    };
  });
}
