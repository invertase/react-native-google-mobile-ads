/** Bounded `simctl launch` for the launch-contract gate (pre-Appium). */
export const LAUNCH_GATE_LAUNCH_TIMEOUT_MS = 90_000;
/** Bounded `simctl terminate` after a successful gate launch. */
export const LAUNCH_GATE_TERMINATE_TIMEOUT_MS = 20_000;
/** Initial gate plus one reset-and-reinstall attempt. */
export const LAUNCH_GATE_MAX_ATTEMPTS = 2;
/** Poll interval while waiting for LaunchServices to register a fresh install. */
export const LAUNCH_SERVICES_SETTLE_POLL_MS = 1_000;
/** Bounded wait after install before the first gate launch (T29 escape S2). */
export const LAUNCH_SERVICES_SETTLE_TIMEOUT_MS = 30_000;
/** Wall clock for the gate reset `simctl shutdown` before erase. */
export const LAUNCH_GATE_SHUTDOWN_TIMEOUT_MS = 60_000;
/** Wall clock for the single gate reset `simctl erase`. */
export const LAUNCH_GATE_ERASE_TIMEOUT_MS = 120_000;

/** S2 reset order after the initial gate failure (shutdown must precede erase). */
export const LAUNCH_GATE_RESET_SEQUENCE = ['shutdown', 'erase', 'boot'] as const;

/** T29 escape S2: one gate retry erases instead of shutdown-only reset. */
export const LAUNCH_GATE_RESET_MODE = 'erase' as const;

export type LaunchGateResetMode = typeof LAUNCH_GATE_RESET_MODE | 'shutdown';

/** `simctl terminate` returns 3 when the app was not running — acceptable after launch. */
export function isAcceptableSimctlTerminateStatus(status: number | null | undefined): boolean {
  return status === 0 || status === 3;
}

/** `simctl shutdown` may exit non-zero when the device is already Shutdown. */
export function isAcceptableSimctlShutdownOutcome(
  status: number | null | undefined,
  stderr?: string | null,
): boolean {
  if (status === 0) {
    return true;
  }
  const text = String(stderr ?? '');
  return /current state:\s*Shutdown|Unable to shutdown device in current state: Shutdown/i.test(
    text,
  );
}

export function shouldRetryLaunchGateAfterFailure(
  completedAttempts: number,
  maxAttempts: number = LAUNCH_GATE_MAX_ATTEMPTS,
): boolean {
  return completedAttempts < maxAttempts;
}

/**
 * When the gate will retry, S2 runs `simctl shutdown`, then `erase`, then boot +
 * reinstall (`LAUNCH_GATE_RESET_MODE` is `erase`, not shutdown-only reset).
 * Fails closed when no retry remains.
 */
export function shouldEraseSimulatorOnLaunchGateReset(
  completedAttempts: number,
  maxAttempts: number = LAUNCH_GATE_MAX_ATTEMPTS,
): boolean {
  if (!shouldRetryLaunchGateAfterFailure(completedAttempts, maxAttempts)) {
    return false;
  }
  return LAUNCH_GATE_RESET_MODE === 'erase';
}

export function resolveLaunchGateResetMode(
  completedAttempts: number,
  maxAttempts: number = LAUNCH_GATE_MAX_ATTEMPTS,
): LaunchGateResetMode {
  return shouldEraseSimulatorOnLaunchGateReset(completedAttempts, maxAttempts)
    ? 'erase'
    : 'shutdown';
}

export function resolveRunnerImageVersion(env: NodeJS.ProcessEnv = process.env): string {
  const raw =
    env.ImageVersion ?? env.RUNNER_IMAGE_VERSION ?? env.GITHUB_RUNNER_IMAGE ?? '';
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : '(unknown)';
}

/** Classified infra abort when the simulator cannot service launch/terminate. */
export function formatSimLaunchWedgedAbort(imageVersion?: string): string {
  const image = imageVersion?.trim() || resolveRunnerImageVersion();
  return `RNGMA_INFRA_ABORT: sim-launch-wedged image=${image}`;
}