import { formatIosBootDiagnosticLine } from './iosBootDiagnostics.ts';

/**
 * WDIO child exit code after hang-recover: replaces the hung POST /session with a
 * fresh WDIO invocation (serial preflight respawns once).
 */
export const IOS_SESSION_CREATE_RETRY_EXIT_CODE = 86;

/**
 * Serial supervisor `wdio.stop()` after hang-recover (SIGINT mapping on this runner).
 * Matches {@link parallelOrchestrator.CANCELLED_EXIT_CODE} without importing it
 * (startup supervisor ↔ orchestrator import cycle).
 */
export const IOS_SESSION_CREATE_RESTART_STOP_EXIT_CODE = 130;

/** Same supervised stop path when the child receives SIGTERM (`128 + 15`). */
export const IOS_SESSION_CREATE_RESTART_STOP_SIGTERM_EXIT_CODE = 143;

export function isIosSessionCreateRetryProcessExitCode(code: number): boolean {
  return code === IOS_SESSION_CREATE_RETRY_EXIT_CODE;
}

export function isIosSessionCreateSupervisedRestartStopExitCode(code: number): boolean {
  return (
    code === IOS_SESSION_CREATE_RESTART_STOP_EXIT_CODE ||
    code === IOS_SESSION_CREATE_RESTART_STOP_SIGTERM_EXIT_CODE
  );
}

/**
 * Exit the WDIO tree so the supervisor can spawn a clean session-create attempt.
 * Call from the hang watchdog immediately after successful hang-recover.
 */
export function requestIosSessionCreateProcessRestart(
  phase: string,
  write: (line: string) => void = line => console.log(line),
): never {
  write(
    formatIosBootDiagnosticLine({
      phase: `${phase}:hang-retry-exec`,
      hint: 'restarting hung POST /session after hang-recover',
    }),
  );
  process.exit(IOS_SESSION_CREATE_RETRY_EXIT_CODE);
}