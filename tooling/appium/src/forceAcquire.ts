import { releaseRelevantFindings } from './resourceHost.ts';
import {
  classifyResources,
  parseResourceOptions,
  ResourceArgumentError,
  type ResourceFinding,
  type ResourceInventory,
  type ResourceOptions,
} from './resourcePrimitives.ts';

export const FORCE_ACQUIRE_ENV = 'RNGMA_E2E_FORCE_ACQUIRE';
export const FORCE_ACQUIRE_AUTHORIZE_FLAG = '--authorize-force-acquire';

export type ForceAcquireDeps = {
  collectInventory(options: ResourceOptions): ResourceInventory;
  releaseResources(
    options: ResourceOptions,
    inventory: ResourceInventory,
    signal: 'SIGTERM' | 'SIGKILL',
  ): void;
  delay(milliseconds: number): Promise<void>;
  log(line: string): void;
};

export function isForceAcquireAuthorized(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return argv.includes(FORCE_ACQUIRE_AUTHORIZE_FLAG) || env[FORCE_ACQUIRE_ENV] === '1';
}

/**
 * Parse force-acquire argv into exact requested nonserial slot targets.
 * Requires user authorization; never accepts serial or `--all-slots`.
 */
export function parseForceAcquireOptions(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): ResourceOptions {
  if (!isForceAcquireAuthorized(argv, env)) {
    throw new ResourceArgumentError(
      `Force-acquire requires ${FORCE_ACQUIRE_AUTHORIZE_FLAG} or ${FORCE_ACQUIRE_ENV}=1.`,
    );
  }
  if (argv.includes('--all-slots')) {
    throw new ResourceArgumentError(
      'Force-acquire rejects --all-slots; pass exact --slot / RNGMA_E2E_SLOT only.',
    );
  }
  const filtered = argv.filter(argument => argument !== FORCE_ACQUIRE_AUTHORIZE_FLAG);
  const options = parseResourceOptions(filtered, env, 'release');
  if (options.targets.length === 0 || options.targets.some(target => target.slot == null)) {
    throw new ResourceArgumentError(
      'Force-acquire requires an exact nonserial slot (--slot / RNGMA_E2E_SLOT); serial resources are never force-cleared.',
    );
  }
  return {
    ...options,
    // Displacing a slot for campaign use includes the exact booted device.
    devices: true,
  };
}

export function busyFindings(findings: readonly ResourceFinding[]): ResourceFinding[] {
  return findings.filter(finding => finding.state === 'BUSY');
}

/** Same relevance filter as canonical release — ignore console; Metro only when owned. */
function relevantBusyFindings(
  options: ResourceOptions,
  findings: readonly ResourceFinding[],
): ResourceFinding[] {
  return busyFindings(releaseRelevantFindings(options, findings));
}

/**
 * Canonical force-acquire: check → (log displaced + release) → check.
 * Touches only the exact requested nonserial targets in `options`.
 */
export async function forceAcquireResources(
  options: ResourceOptions,
  deps: ForceAcquireDeps,
): Promise<{ displaced: ResourceFinding[] }> {
  const checkOptions = { ...options, services: true };
  const before = classifyResources(checkOptions, deps.collectInventory(options));
  const displaced = relevantBusyFindings(options, before);
  for (const finding of displaced) {
    deps.log(`[force-acquire] DISPLACED ${finding.detail}`);
  }
  if (displaced.length === 0) {
    deps.log('[force-acquire] CLEAR (nothing to displace)');
    return { displaced };
  }

  deps.log(`[force-acquire] releasing ${displaced.length} busy resource(s)`);
  deps.releaseResources(options, deps.collectInventory(options), 'SIGTERM');
  await deps.delay(2_000);

  for (let round = 0; round <= 2; round++) {
    const inventory = deps.collectInventory(options);
    const findings = classifyResources(checkOptions, inventory);
    const remaining = relevantBusyFindings(options, findings);
    if (remaining.length === 0) {
      deps.log(`[force-acquire] CLEAR after force round ${round}`);
      return { displaced };
    }
    if (round === 2) {
      for (const finding of remaining) {
        deps.log(`[force-acquire] BUSY  ${finding.detail}`);
      }
      throw new Error('resources remain busy after force-acquire release rounds.');
    }
    deps.log(`[force-acquire] force round ${round + 1}`);
    deps.releaseResources(options, inventory, 'SIGKILL');
    await deps.delay(2_000);
  }
  return { displaced };
}
