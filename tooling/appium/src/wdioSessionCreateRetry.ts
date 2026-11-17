import { formatIosBootDiagnosticLine } from './iosBootDiagnostics.ts';

/**
 * WDIO child exit code after hang-recover: replaces the hung POST /session with a
 * fresh WDIO invocation (serial preflight respawns once).
 */
export const IOS_SESSION_CREATE_RETRY_EXIT_CODE = 86;

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