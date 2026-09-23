import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const STARTUP_READY_MARKER = '[e2e-startup-ready]';
const METRO_READY_MARKER = 'Dev server ready';
export const METRO_STARTUP_TIMEOUT_MS = 120_000;
export const WORKER_STARTUP_TIMEOUT_MS = 60_000;
export const APP_STARTUP_TIMEOUT_MS = 120_000;
export const PROCESS_DRAIN_TIMEOUT_MS = 30_000;

type StartupPhase = 'metro' | 'worker' | 'app' | 'complete';

export type StartupClock = {
  setTimeout(callback: () => void, milliseconds: number): unknown;
  clearTimeout(timer: unknown): void;
};

export type MetroTcpWaiter = (signal: AbortSignal) => Promise<void>;

const realClock: StartupClock = {
  setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clearTimeout: timer => clearTimeout(timer as NodeJS.Timeout),
};

export type HardFailureMarker = {
  name: string;
  pattern: RegExp;
};

export const HARD_FAILURE_MARKERS: readonly HardFailureMarker[] = [
  {
    name: 'metro-transform',
    pattern:
      /(?:TransformError|error: bundling failed|^\s*BUNDLE\b[^\n]*(?:\bfailed\b|\berror\b))/i,
  },
  { name: 'react-context-null', pattern: /ReactContext is null/i },
  { name: 'unable-load-script', pattern: /Unable to load script/i },
  { name: 'missing-bundle-url', pattern: /No bundle URL present/i },
  { name: 'telnet', pattern: /\bTELNET_ERROR\b/i },
  {
    name: 'development-server',
    pattern: /(?:Could not|Cannot) connect to (?:the )?development server/i,
  },
  {
    name: 'wrong-target',
    pattern:
      /(?:wrong|conflicts with|not exact|does not match|expected exact).*(?:slot|serial|Metro)|(?:slot|serial|Metro).*(?:wrong|conflicts with|not exact|does not match)/i,
  },
  { name: 'address-in-use', pattern: /\bEADDRINUSE\b/i },
  { name: 'connection-refused', pattern: /\bECONNREFUSED\b/i },
  {
    name: 'appium-prepare',
    pattern: /(?:onPrepare hook failed|Error in "onPrepare"|Appium.*listener.*failed)/i,
  },
  {
    name: 'session-create',
    pattern: /(?:Failed to create session|Could not create a new session|session not created)/i,
  },
  {
    name: 'preflight-rejection',
    pattern: /(?:preflight (?:failed|rejected)|refusing to select|no mutation was started)/i,
  },
  { name: 'jest-open-handles', pattern: /Jest did not exit/i },
] as const;

export function hardFailureForLine(line: string): HardFailureMarker | undefined {
  return HARD_FAILURE_MARKERS.find(marker => marker.pattern.test(line));
}

function createInvocationId(now = new Date(), random = randomUUID()): string {
  return `${now.toISOString().replace(/[-:.]/g, '')}-${random.slice(0, 8)}`;
}

export type InvocationPaths = {
  id: string;
  root: string;
  metro: string;
  child(platform: 'android' | 'ios', label: string): string;
  selection(slot: number): string;
  device(platform: 'android' | 'ios', label: string): string;
};

export function invocationPaths(id = createInvocationId()): InvocationPaths {
  const root = path.join('/tmp/rngma-e2e', id);
  return {
    id,
    root,
    metro: path.join(root, 'metro.log'),
    child: (platform, label) => path.join(root, `${platform}-${label}.log`),
    selection: slot => path.join(root, `ios-slot-${slot}-selection.env`),
    device: (platform, label) => path.join(root, `${platform}-${label}-device.log`),
  };
}

type Waiter = {
  phase: Exclude<StartupPhase, 'complete'>;
  resolve(): void;
  reject(error: Error): void;
  timer: unknown;
};

export class StartupSupervisor {
  readonly failure: Promise<never>;
  private rejectFailure!: (error: Error) => void;
  private readonly expected: Set<string>;
  private readonly workers = new Set<string>();
  private readonly sessions = new Set<string>();
  private readonly apps = new Set<string>();
  private readonly listeners = new Set<(error: Error) => void>();
  private waiter?: Waiter;
  private failed?: Error;
  private metroTcpReady = false;
  private metroMarkerReady = false;
  private aborts = 0;
  phase: StartupPhase = 'metro';

  constructor(
    expectedChildren: Iterable<string>,
    private readonly clock: StartupClock = realClock,
  ) {
    this.expected = new Set(expectedChildren);
    this.failure = new Promise<never>((_resolve, reject) => {
      this.rejectFailure = reject;
    });
    // A caller may use only phase promises; keep the diagnostic failure promise
    // from becoming an unhandled rejection in that valid usage.
    void this.failure.catch(() => undefined);
  }

  get abortCount(): number {
    return this.aborts;
  }

  onFailure(listener: (error: Error) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  recordMetroTcpReady(): void {
    this.metroTcpReady = true;
    this.maybeResolve();
  }

  recordLine(
    source: string,
    line: string,
    allowedHardFailures: ReadonlySet<string> | undefined = undefined,
  ): void {
    if (this.phase === 'complete' || this.failed) return;
    const hard = hardFailureForLine(line);
    if (hard && (!allowedHardFailures || allowedHardFailures.has(hard.name))) {
      this.abort(
        new Error(
          `Determinative startup failure (${hard.name}) from ${source}: ${line.trim()}`,
        ),
      );
      return;
    }
    if (source === 'metro' && line.includes(METRO_READY_MARKER)) {
      this.metroMarkerReady = true;
    }
    if (/Execution of \d+ workers? started/i.test(line)) {
      if (this.expected.has(source)) this.workers.add(source);
    }
    if (
      /(?:WebDriver|Appium) session (?:created|started)|\bsession created successfully\b|https?:\/\/\S+\/session\/[^/\s]+(?:\/|\s|$)/i.test(
        line,
      )
    ) {
      if (this.expected.has(source)) this.sessions.add(source);
    }
    if (line.includes(STARTUP_READY_MARKER) && this.expected.has(source)) {
      this.apps.add(source);
    }
    this.maybeResolve();
  }

  recordProcessExit(source: string, code: number): void {
    if (source.startsWith('device:')) {
      return;
    }
    if (code === 0 && this.apps.has(source)) {
      return;
    }
    if (this.phase !== 'complete') {
      this.abort(new Error(`${source} exited during ${this.phase} startup with code ${code}.`));
    }
  }

  recordExternalMetroHealthLoss(port: number): void {
    this.abort(
      new Error(`External Metro 127.0.0.1:${port} stopped responding during startup.`),
    );
  }

  recordFailure(source: string, error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.abort(new Error(`${source}: ${normalized.message}`));
  }

  waitForMetro(): Promise<void> {
    return this.waitFor('metro', METRO_STARTUP_TIMEOUT_MS);
  }

  waitForWorkers(): Promise<void> {
    if (this.phase !== 'worker') {
      return Promise.reject(new Error(`Cannot wait for workers during ${this.phase} phase.`));
    }
    return this.waitFor('worker', WORKER_STARTUP_TIMEOUT_MS);
  }

  waitForApps(): Promise<void> {
    if (this.phase !== 'app') {
      return Promise.reject(new Error(`Cannot wait for apps during ${this.phase} phase.`));
    }
    return this.waitFor('app', APP_STARTUP_TIMEOUT_MS);
  }

  private waitFor(
    phase: Exclude<StartupPhase, 'complete'>,
    timeout: number,
  ): Promise<void> {
    if (this.failed) return Promise.reject(this.failed);
    if (this.waiter) return Promise.reject(new Error(`Already waiting for ${this.waiter.phase}.`));
    return new Promise((resolve, reject) => {
      const timer = this.clock.setTimeout(() => {
        this.abort(
          new Error(
            `Timed out after ${timeout}ms waiting for ${phase} startup readiness (${this.progress(phase)}).`,
          ),
        );
      }, timeout);
      this.waiter = { phase, resolve, reject, timer };
      this.maybeResolve();
    });
  }

  private progress(phase: Exclude<StartupPhase, 'complete'>): string {
    if (phase === 'metro') {
      return `tcp=${this.metroTcpReady} marker=${this.metroMarkerReady}`;
    }
    if (phase === 'worker') {
      return `workers=${this.workers.size}/${this.expected.size} sessions=${this.sessions.size}/${this.expected.size}`;
    }
    return `${this.apps.size}/${this.expected.size} children`;
  }

  private maybeResolve(): void {
    const waiter = this.waiter;
    if (!waiter || waiter.phase !== this.phase) return;
    const ready =
      waiter.phase === 'metro'
        ? this.metroTcpReady && this.metroMarkerReady
        : waiter.phase === 'worker'
          ? this.workers.size === this.expected.size &&
            this.sessions.size === this.expected.size
          : this.apps.size === this.expected.size;
    if (!ready) return;
    this.clock.clearTimeout(waiter.timer);
    this.waiter = undefined;
    this.phase = waiter.phase === 'metro' ? 'worker' : waiter.phase === 'worker' ? 'app' : 'complete';
    waiter.resolve();
  }

  private abort(error: Error): void {
    if (this.failed || this.phase === 'complete') return;
    this.failed = error;
    this.aborts += 1;
    if (this.waiter) {
      this.clock.clearTimeout(this.waiter.timer);
      this.waiter.reject(error);
      this.waiter = undefined;
    }
    this.rejectFailure(error);
    for (const listener of this.listeners) listener(error);
  }
}

/**
 * Owns the single Metro startup envelope. TCP probing and the authoritative
 * Metro marker run concurrently; both must arrive before the supervisor's
 * one 120-second deadline.
 */
export async function waitForMetroReadiness(
  startup: StartupSupervisor,
  waitForTcp: MetroTcpWaiter,
): Promise<void> {
  const controller = new AbortController();
  void waitForTcp(controller.signal).then(
    () => startup.recordMetroTcpReady(),
    error => {
      if (!controller.signal.aborted) startup.recordFailure('Metro TCP readiness failed', error);
    },
  );
  try {
    await startup.waitForMetro();
  } finally {
    controller.abort();
  }
}

export const ANDROID_DEVICE_HARD_FAILURES = new Set([
  'react-context-null',
  'unable-load-script',
  'missing-bundle-url',
  'development-server',
]);

export function androidDeviceLogCommand(serial: string): {
  bin: string;
  args: string[];
} {
  // Exact-device, no-history stream restricted to React Native/application
  // crash tags. Device lines are additionally marker-scoped by the caller.
  return {
    bin: 'adb',
    args: [
      '-s',
      serial,
      'logcat',
      '-T',
      '0',
      'ReactNative:V',
      'ReactNativeJS:V',
      'AndroidRuntime:E',
      '*:S',
    ],
  };
}

export function iosDeviceLogCommand(udid: string): {
  bin: string;
  args: string[];
} {
  return {
    bin: 'xcrun',
    args: [
      'simctl',
      'spawn',
      udid,
      'log',
      'stream',
      '--style',
      'compact',
      '--predicate',
      'process == "ReactTestApp"',
    ],
  };
}
