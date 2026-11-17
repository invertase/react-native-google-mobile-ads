/** Bounded `simctl launch` for the launch-contract gate (pre-Appium). */
export const LAUNCH_GATE_LAUNCH_TIMEOUT_MS = 60_000;
/** Bounded `simctl terminate` after a successful gate launch. */
export const LAUNCH_GATE_TERMINATE_TIMEOUT_MS = 20_000;
/** Initial gate plus one reset-and-reinstall attempt. */
export const LAUNCH_GATE_MAX_ATTEMPTS = 2;

/** `simctl terminate` returns 3 when the app was not running — acceptable after launch. */
export function isAcceptableSimctlTerminateStatus(status: number | null | undefined): boolean {
  return status === 0 || status === 3;
}

export function shouldRetryLaunchGateAfterFailure(
  completedAttempts: number,
  maxAttempts: number = LAUNCH_GATE_MAX_ATTEMPTS,
): boolean {
  return completedAttempts < maxAttempts;
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