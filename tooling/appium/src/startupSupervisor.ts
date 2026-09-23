import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import path from 'node:path';

export const STARTUP_READY_MARKER = '[e2e-startup-ready]';
const METRO_READY_MARKER = 'Dev server ready';
/** Authoritative Metro `/status` body when the RN packager is serving bundles. */
export const METRO_PACKAGER_RUNNING_MARKER = 'packager-status:running';

export type MetroBundlePlatform = 'android' | 'ios';

/** Matches `.github/workflows/tests_e2e_{android,ios}.yml` Metro bundle probes. */
export function metroBundleRequestUrl(port: number, platform: MetroBundlePlatform): string {
  const params = new URLSearchParams({
    platform,
    dev: 'true',
    minify: 'false',
    inlineSourceMap: 'true',
  });
  return `http://127.0.0.1:${port}/index.bundle?${params.toString()}`;
}
export const METRO_STARTUP_TIMEOUT_MS = 120_000;
export const WORKER_STARTUP_TIMEOUT_MS = 60_000;
/**
 * Concurrent XCUITest session create (even with prebuilt+preinstalled WDA) can
 * exceed the serial 60s worker/session ceiling under three-sim contention.
 * iOS parallel children only (single-platform iOS parallel, or `ios:` sources in
 * combined parallel). Serial iOS and every Android child stay on
 * WORKER_STARTUP_TIMEOUT_MS — never raise Android via this constant.
 */
export const IOS_PARALLEL_WORKER_STARTUP_TIMEOUT_MS = 180_000;
export const APP_STARTUP_TIMEOUT_MS = 120_000;
export const PROCESS_DRAIN_TIMEOUT_MS = 30_000;

/**
 * Per-source worker/session ceilings. A plain number applies to every expected
 * child. Object form keeps Android (and unmatched labels) on `defaultMs` while
 * prefix overrides cover iOS parallel children (`ios:` → 180s).
 */
export type WorkerStartupTimeoutOptions = {
  defaultMs?: number;
  byPrefix?: Readonly<Record<string, number>>;
};

type StartupPhase = 'metro' | 'worker' | 'app' | 'complete';

export type StartupClock = {
  setTimeout(callback: () => void, milliseconds: number): unknown;
  clearTimeout(timer: unknown): void;
};

export type MetroTcpWaiter = (signal: AbortSignal) => Promise<void>;

export type MetroPackagerProbe = (
  port: number,
  platform: MetroBundlePlatform,
  signal: AbortSignal,
) => Promise<boolean>;

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
  timers: unknown[];
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

  private readonly defaultWorkerTimeoutMs: number;
  private readonly workerTimeoutByPrefix: ReadonlyArray<readonly [string, number]>;

  constructor(
    expectedChildren: Iterable<string>,
    private readonly clock: StartupClock = realClock,
    workerTimeout: number | WorkerStartupTimeoutOptions = WORKER_STARTUP_TIMEOUT_MS,
  ) {
    this.expected = new Set(expectedChildren);
    if (typeof workerTimeout === 'number') {
      this.defaultWorkerTimeoutMs = workerTimeout;
      this.workerTimeoutByPrefix = [];
    } else {
      this.defaultWorkerTimeoutMs = workerTimeout.defaultMs ?? WORKER_STARTUP_TIMEOUT_MS;
      this.workerTimeoutByPrefix = Object.entries(workerTimeout.byPrefix ?? {}).sort(
        (left, right) => right[0].length - left[0].length,
      );
    }
    this.failure = new Promise<never>((_resolve, reject) => {
      this.rejectFailure = reject;
    });
    // A caller may use only phase promises; keep the diagnostic failure promise
    // from becoming an unhandled rejection in that valid usage.
    void this.failure.catch(() => undefined);
  }

  /** Resolved ceiling for one expected child label (e.g. `android:…` / `ios:…`). */
  workerTimeoutFor(source: string): number {
    for (const [prefix, milliseconds] of this.workerTimeoutByPrefix) {
      if (source.startsWith(prefix)) {
        return milliseconds;
      }
    }
    return this.defaultWorkerTimeoutMs;
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
    if (this.failed) return Promise.reject(this.failed);
    if (this.waiter) return Promise.reject(new Error(`Already waiting for ${this.waiter.phase}.`));
    // Per-source deadlines: Android stays at 60s even when iOS peers use 180s.
    return new Promise((resolve, reject) => {
      const timers: unknown[] = [];
      for (const source of this.expected) {
        const timeout = this.workerTimeoutFor(source);
        timers.push(
          this.clock.setTimeout(() => {
            if (this.workers.has(source) && this.sessions.has(source)) {
              return;
            }
            this.abort(
              new Error(
                `Timed out after ${timeout}ms waiting for worker startup readiness (${source}; ${this.progress('worker')}).`,
              ),
            );
          }, timeout),
        );
      }
      this.waiter = { phase: 'worker', resolve, reject, timers };
      this.maybeResolve();
    });
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
      this.waiter = { phase, resolve, reject, timers: [timer] };
      this.maybeResolve();
    });
  }

  private clearWaiterTimers(): void {
    if (!this.waiter) {
      return;
    }
    for (const timer of this.waiter.timers) {
      this.clock.clearTimeout(timer);
    }
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
    this.clearWaiterTimers();
    this.waiter = undefined;
    this.phase = waiter.phase === 'metro' ? 'worker' : waiter.phase === 'worker' ? 'app' : 'complete';
    waiter.resolve();
  }

  private abort(error: Error): void {
    if (this.failed || this.phase === 'complete') return;
    this.failed = error;
    this.aborts += 1;
    if (this.waiter) {
      this.clearWaiterTimers();
      this.waiter.reject(error);
      this.waiter = undefined;
    }
    this.rejectFailure(error);
    for (const listener of this.listeners) listener(error);
  }
}

export async function probeMetroPackagerHttp(
  port: number,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) {
    return false;
  }
  const timeout = AbortSignal.timeout(2_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`, {
      signal: requestSignal,
    });
    if (!response.ok) {
      return false;
    }
    const body = (await response.text()).trim();
    return body.includes(METRO_PACKAGER_RUNNING_MARKER);
  } catch {
    return false;
  }
}

const METRO_BUNDLE_MIN_BYTES = 1024;
const METRO_BUNDLE_FETCH_TIMEOUT_MS = 30_000;

/**
 * `/status` can be `running` while the first platform bundle is still compiling.
 * Prefetch the bundle Metro will serve to the device (RNFB e2e pattern).
 */
export async function probeMetroPlatformBundle(
  port: number,
  platform: MetroBundlePlatform,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) {
    return false;
  }
  if (!(await probeMetroPackagerHttp(port, signal))) {
    return false;
  }
  const timeout = AbortSignal.timeout(METRO_BUNDLE_FETCH_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(metroBundleRequestUrl(port, platform), {
      signal: requestSignal,
    });
    if (!response.ok) {
      return false;
    }
    const body = await response.arrayBuffer();
    return body.byteLength >= METRO_BUNDLE_MIN_BYTES;
  } catch {
    return false;
  }
}

export type ExternalMetroReadinessOptions = {
  platform: MetroBundlePlatform;
  listen?: (port: number) => Promise<boolean>;
  probe?: MetroPackagerProbe;
  pollMs?: number;
};

/**
 * External Metro consumers must not treat a bare TCP accept (or `/status` alone)
 * as readiness. Poll until Metro serves the expected platform bundle, then
 * satisfy the same AND barrier as an owned packager.
 */
export async function waitForExternalMetroReadiness(
  startup: StartupSupervisor,
  port: number,
  options: ExternalMetroReadinessOptions,
): Promise<void> {
  const listen = options.listen ?? probeTcpListening;
  const probe = options.probe ?? probeMetroPlatformBundle;
  const pollMs = options.pollMs ?? 250;
  const { platform } = options;
  await waitForMetroReadiness(startup, async signal => {
    while (!signal.aborted) {
      if (!(await listen(port))) {
        await delay(pollMs);
        continue;
      }
      if (await probe(port, platform, signal)) {
        startup.recordLine('metro', METRO_READY_MARKER);
        return;
      }
      await delay(pollMs);
    }
    throw new Error(`External Metro readiness polling on 127.0.0.1:${port} was aborted.`);
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function probeTcpListening(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
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
