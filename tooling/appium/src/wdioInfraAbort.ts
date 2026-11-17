/** Stable prefix for WDIO infra-abort classification (grep with session-create abort). */
export const RNGMA_INFRA_ABORT_PREFIX = 'RNGMA_INFRA_ABORT:';

let iosSessionCreateInfraAbort = false;

/** Set when iOS POST /session hang watchdog aborts before any spec runs. */
export function markIosSessionCreateInfraAbort(): void {
  iosSessionCreateInfraAbort = true;
}

/** Read-once flag for shared `onComplete` (worker process). */
export function consumeIosSessionCreateInfraAbort(): boolean {
  const marked = iosSessionCreateInfraAbort;
  iosSessionCreateInfraAbort = false;
  return marked;
}

/** Test-only reset. */
export function resetIosSessionCreateInfraAbortForTests(): void {
  iosSessionCreateInfraAbort = false;
}