import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runWdioOwned } from '../scripts/preflight.ts';
import { runPackager } from '../scripts/run-named.ts';
import {
  stopAndDrain,
  stopChildProcessTree,
  type ProcessStopClock,
} from '../src/ownedProcess.ts';
import {
  ANDROID_DEVICE_HARD_FAILURES,
  APP_STARTUP_TIMEOUT_MS,
  HARD_FAILURE_MARKERS,
  IOS_WORKER_STARTUP_TIMEOUT_MS,
  METRO_STARTUP_TIMEOUT_MS,
  STARTUP_READY_MARKER,
  StartupSupervisor,
  WORKER_STARTUP_TIMEOUT_MS,
  androidDeviceLogCommand,
  hardFailureForLine,
  invocationPaths,
  iosDeviceLogCommand,
  metroBundleRequestUrl,
  type StartupClock,
  waitForMetroReadiness,
  waitForExternalMetroReadiness,
} from '../src/startupSupervisor.ts';
import type { RunningCommand } from '../src/parallelOrchestrator.ts';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

class FakeClock implements StartupClock {
  now = 0;
  private nextId = 1;
  private timers = new Map<number, { at: number; callback(): void }>();

  setTimeout(callback: () => void, milliseconds: number): number {
    const id = this.nextId++;
    this.timers.set(id, { at: this.now + milliseconds, callback });
    return id;
  }

  clearTimeout(timer: unknown): void {
    this.timers.delete(timer as number);
  }

  advance(milliseconds: number): void {
    this.now += milliseconds;
    for (const [id, timer] of [...this.timers]) {
      if (timer.at <= this.now) {
        this.timers.delete(id);
        timer.callback();
      }
    }
  }
}

async function metroReady(supervisor: StartupSupervisor): Promise<void> {
  const ready = supervisor.waitForMetro();
  supervisor.recordMetroTcpReady();
  supervisor.recordLine('metro', 'INFO Dev server ready. Press Ctrl+C to exit.');
  await ready;
}

async function promptly<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('operation did not settle promptly')), 2_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function fakeOwnedProcess(): {
  command: RunningCommand;
  stops(): number;
} {
  let resolve!: (code: number) => void;
  let stopCount = 0;
  const completion = new Promise<number>(done => {
    resolve = done;
  });
  return {
    command: {
      completion,
      onLine: () => () => undefined,
      stop: async () => {
        stopCount += 1;
        resolve(130);
      },
    },
    stops: () => stopCount,
  };
}

test('hard marker registry recognizes every deterministic startup failure', () => {
  const examples = [
    'TransformError: syntax exploded',
    'error: bundling failed: Error',
    'ReactContext is null',
    'Unable to load script from assets',
    'No bundle URL present',
    'TELNET_ERROR tunnel failed',
    'Could not connect to development server',
    'RNGMA slot serial conflicts with expected exact Metro',
    'listen EADDRINUSE: address already in use',
    'connect ECONNREFUSED 127.0.0.1',
    'Error in "onPrepare" hook',
    'Could not create a new session',
    'Appium preflight rejected this target',
    'Jest did not exit one second after the test run',
  ];
  for (const line of examples) {
    assert.ok(hardFailureForLine(line), line);
  }
  assert.equal(new Set(HARD_FAILURE_MARKERS.map(marker => marker.name)).size, HARD_FAILURE_MARKERS.length);
});

test('hard marker registry recognizes every alternation in compound markers', () => {
  for (const [name, examples] of Object.entries({
    'metro-transform': [
      'TransformError: syntax exploded',
      'error: bundling failed: Error',
      'BUNDLE ./index.js failed',
      'BUNDLE ./index.js error',
    ],
    'development-server': [
      'Could not connect to development server',
      'Cannot connect to the development server',
    ],
    'wrong-target': [
      'wrong slot selected for Metro',
      'Metro does not match expected exact serial',
    ],
    'appium-prepare': [
      'onPrepare hook failed',
      'Error in "onPrepare"',
      'Appium listener failed',
    ],
    'session-create': [
      'Failed to create session',
      'Could not create a new session',
      'session not created',
    ],
    'preflight-rejection': [
      'preflight failed',
      'preflight rejected',
      'refusing to select target; no mutation was started',
    ],
  })) {
    for (const line of examples) assert.equal(hardFailureForLine(line)?.name, name, line);
  }
});

test('ordinary ad outcomes, latency, warnings, and Gradle status are not hard markers', () => {
  for (const line of [
    'Ad failed to load: no-fill',
    'internal-error <Google:HTML> Incorrect native ad response',
    'still waiting for element after ordinary load latency',
    'stale element reference warning; retrying lookup',
    'Watchman warning: Recrawled this watch',
    '> Task :app:assembleDebug UP-TO-DATE',
    'CocoaPods will not include dist/main.ios.jsbundle; served by dev server',
    'Method onConnected(android.os.Bundle) failed lock verification and will run slower.',
  ]) {
    assert.equal(hardFailureForLine(line), undefined, line);
  }
});

test('Metro requires both TCP and authoritative marker and times out at 120 seconds', async () => {
  const clock = new FakeClock();
  const supervisor = new StartupSupervisor([], clock);
  const waiting = supervisor.waitForMetro();
  supervisor.recordMetroTcpReady();
  clock.advance(METRO_STARTUP_TIMEOUT_MS - 1);
  assert.equal(supervisor.phase, 'metro');
  supervisor.recordLine('metro', 'Dev server ready');
  await waiting;
  assert.equal(supervisor.phase, 'worker');

  const timeoutClock = new FakeClock();
  const timeout = new StartupSupervisor([], timeoutClock);
  const rejected = assert.rejects(timeout.waitForMetro(), /120000ms.*tcp=false marker=false/);
  timeoutClock.advance(METRO_STARTUP_TIMEOUT_MS);
  await rejected;
});

test('external Metro requires platform bundle prefetch, not TCP or status alone', async () => {
  const clock = new FakeClock();
  const supervisor = new StartupSupervisor([], clock);
  const waiting = waitForExternalMetroReadiness(supervisor, 9999, {
    platform: 'android',
    listen: async () => true,
    probe: async () => false,
    pollMs: 10,
  });
  supervisor.recordMetroTcpReady();
  clock.advance(METRO_STARTUP_TIMEOUT_MS - 1);
  assert.equal(supervisor.phase, 'metro');
  const rejected = assert.rejects(
    waiting,
    /120000ms.*waiting for metro startup readiness \(tcp=true marker=false\)/,
  );
  clock.advance(1);
  await rejected;
});

test('external Metro accepts platform bundle prefetch as the ready marker', async () => {
  const supervisor = new StartupSupervisor([], new FakeClock());
  await waitForExternalMetroReadiness(supervisor, 9999, {
    platform: 'ios',
    listen: async () => true,
    probe: async () => true,
    pollMs: 1,
  });
  assert.equal(supervisor.phase, 'worker');
});

test('metro bundle URL matches CI e2e workflow probes', async () => {
  assert.equal(
    metroBundleRequestUrl(8081, 'android'),
    'http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false&inlineSourceMap=true',
  );
  assert.equal(
    metroBundleRequestUrl(13007, 'ios'),
    'http://127.0.0.1:13007/index.bundle?platform=ios&dev=true&minify=false&inlineSourceMap=true',
  );
});

test('Metro marker is accepted only from the Metro source', async () => {
  const clock = new FakeClock();
  const supervisor = new StartupSupervisor([], clock);
  const waiting = supervisor.waitForMetro();
  supervisor.recordMetroTcpReady();
  supervisor.recordLine('child', 'Dev server ready');
  clock.advance(METRO_STARTUP_TIMEOUT_MS - 1);
  assert.equal(supervisor.phase, 'metro');
  supervisor.recordLine('metro', 'Dev server ready');
  await waiting;
});

test('shared Metro driver enforces one timeout envelope and cancels TCP polling', async () => {
  const clock = new FakeClock();
  const supervisor = new StartupSupervisor([], clock);
  let probeSignal: AbortSignal | undefined;
  const waiting = waitForMetroReadiness(supervisor, signal => {
    probeSignal = signal;
    return new Promise<void>(() => undefined);
  });
  supervisor.recordLine('metro', 'Dev server ready');
  const rejected = assert.rejects(
    waiting,
    /120000ms.*tcp=false marker=true/,
  );
  clock.advance(METRO_STARTUP_TIMEOUT_MS);
  await rejected;
  assert.equal(probeSignal?.aborted, true);
});

test('worker and app phases enforce positive AND barriers at their deadlines', async () => {
  for (const count of [1, 3, 6]) {
    const clock = new FakeClock();
    const children = Array.from({ length: count }, (_, index) => `child-${index}`);
    const supervisor = new StartupSupervisor(children, clock);
    await metroReady(supervisor);

    const workers = supervisor.waitForWorkers();
    for (const child of children.slice(0, -1)) {
      supervisor.recordLine(child, 'Execution of 1 workers started');
      supervisor.recordLine(child, 'Appium session created successfully');
    }
    clock.advance(WORKER_STARTUP_TIMEOUT_MS - 1);
    assert.equal(supervisor.phase, 'worker');
    supervisor.recordLine(children.at(-1)!, 'Execution of 1 workers started');
    assert.equal(supervisor.phase, 'worker');
    supervisor.recordLine(children.at(-1)!, 'Appium session created successfully');
    await workers;

    const apps = supervisor.waitForApps();
    for (const child of children.slice(0, -1)) {
      supervisor.recordLine(child, `${STARTUP_READY_MARKER} {"ok":true}`);
    }
    clock.advance(APP_STARTUP_TIMEOUT_MS - 1);
    assert.equal(supervisor.phase, 'app');
    supervisor.recordLine(children.at(-1)!, `${STARTUP_READY_MARKER} {"ok":true}`);
    await apps;
    assert.equal(supervisor.phase, 'complete');
  }
});

test('worker and app phase timeouts reject at their exact deadlines', async () => {
  const workerClock = new FakeClock();
  const worker = new StartupSupervisor(['child'], workerClock);
  await metroReady(worker);
  const workerRejected = assert.rejects(
    worker.waitForWorkers(),
    /60000ms.*workers=0\/1 sessions=0\/1/,
  );
  workerClock.advance(WORKER_STARTUP_TIMEOUT_MS);
  await workerRejected;

  const appClock = new FakeClock();
  const app = new StartupSupervisor(['child'], appClock);
  await metroReady(app);
  const workers = app.waitForWorkers();
  app.recordLine('child', 'Execution of 1 worker started');
  app.recordLine('child', 'Appium session created successfully');
  await workers;
  const appRejected = assert.rejects(app.waitForApps(), /120000ms.*0\/1 children/);
  appClock.advance(APP_STARTUP_TIMEOUT_MS);
  await appRejected;
});

test('combined parallel keeps Android at 60s while iOS may use 180s', async () => {
  const androidMiss = new FakeClock();
  const androidMissSupervisor = new StartupSupervisor(
    ['android:a-primary', 'ios:a-primary'],
    androidMiss,
    {
      defaultMs: WORKER_STARTUP_TIMEOUT_MS,
      byPrefix: { 'ios:': IOS_WORKER_STARTUP_TIMEOUT_MS },
    },
  );
  assert.equal(androidMissSupervisor.workerTimeoutFor('android:a-primary'), WORKER_STARTUP_TIMEOUT_MS);
  assert.equal(
    androidMissSupervisor.workerTimeoutFor('ios:a-primary'),
    IOS_WORKER_STARTUP_TIMEOUT_MS,
  );
  await metroReady(androidMissSupervisor);
  const androidMissed = assert.rejects(
    androidMissSupervisor.waitForWorkers(),
    /60000ms waiting for worker startup readiness \(android:a-primary/,
  );
  androidMissSupervisor.recordLine('ios:a-primary', 'Execution of 1 workers started');
  androidMissSupervisor.recordLine('ios:a-primary', 'Appium session created successfully');
  androidMiss.advance(WORKER_STARTUP_TIMEOUT_MS - 1);
  assert.equal(androidMissSupervisor.abortCount, 0);
  androidMiss.advance(1);
  await androidMissed;

  const iosLate = new FakeClock();
  const iosLateSupervisor = new StartupSupervisor(
    ['android:a-primary', 'ios:a-primary'],
    iosLate,
    {
      defaultMs: WORKER_STARTUP_TIMEOUT_MS,
      byPrefix: { 'ios:': IOS_WORKER_STARTUP_TIMEOUT_MS },
    },
  );
  await metroReady(iosLateSupervisor);
  const workers = iosLateSupervisor.waitForWorkers();
  iosLateSupervisor.recordLine('android:a-primary', 'Execution of 1 workers started');
  iosLateSupervisor.recordLine('android:a-primary', 'Appium session created successfully');
  // Android's 60s deadline elapses while Android is already ready — must not abort.
  iosLate.advance(WORKER_STARTUP_TIMEOUT_MS);
  assert.equal(iosLateSupervisor.abortCount, 0);
  assert.equal(iosLateSupervisor.phase, 'worker');
  iosLate.advance(IOS_WORKER_STARTUP_TIMEOUT_MS - WORKER_STARTUP_TIMEOUT_MS - 1);
  iosLateSupervisor.recordLine('ios:a-primary', 'Execution of 1 workers started');
  iosLateSupervisor.recordLine('ios:a-primary', 'Appium session created successfully');
  await workers;
  assert.equal(iosLateSupervisor.phase, 'app');
});

test('serial-ios uses the 180s iOS worker ceiling (CI cold WDA session create)', async () => {
  const clock = new FakeClock();
  const supervisor = new StartupSupervisor(
    ['serial-ios'],
    clock,
    IOS_WORKER_STARTUP_TIMEOUT_MS,
  );
  assert.equal(supervisor.workerTimeoutFor('serial-ios'), IOS_WORKER_STARTUP_TIMEOUT_MS);
  await metroReady(supervisor);
  const workers = supervisor.waitForWorkers();
  supervisor.recordLine('serial-ios', 'Execution of 1 worker started');
  // Past the old 60s serial ceiling — session still pending should not abort yet.
  clock.advance(WORKER_STARTUP_TIMEOUT_MS);
  assert.equal(supervisor.abortCount, 0);
  supervisor.recordLine('serial-ios', 'Appium session created successfully');
  await workers;
});

test('real WDIO session URL is positive only after a session id exists', async () => {
  const supervisor = new StartupSupervisor(['android'], new FakeClock());
  await metroReady(supervisor);
  const workers = supervisor.waitForWorkers();
  supervisor.recordLine('android', 'Execution of 1 workers started');
  supervisor.recordLine(
    'android',
    'INFO webdriver: [POST] http://127.0.0.1:18013/session',
  );
  assert.equal(supervisor.phase, 'worker');
  supervisor.recordLine(
    'android',
    'INFO webdriver: [POST] http://127.0.0.1:18013/session/438ddb1d-9fd0-4889-ada2-3190ebd4d044/appium/settings',
  );
  await workers;
  assert.equal(supervisor.phase, 'app');
});

test('five app-ready children plus sixth hard failure aborts once', async () => {
  const children = Array.from({ length: 6 }, (_, index) => `child-${index}`);
  const supervisor = new StartupSupervisor(children, new FakeClock());
  await metroReady(supervisor);
  const workers = supervisor.waitForWorkers();
  for (const child of children) {
    supervisor.recordLine(child, 'Execution of 1 workers started');
    supervisor.recordLine(child, 'Appium session created successfully');
  }
  await workers;
  const apps = supervisor.waitForApps();
  for (const child of children.slice(0, 5)) {
    supervisor.recordLine(child, STARTUP_READY_MARKER);
  }
  supervisor.recordLine(children[5]!, 'Unable to load script from Metro');
  supervisor.recordLine(children[5]!, 'ECONNREFUSED');
  await assert.rejects(apps, /unable-load-script/);
  assert.equal(supervisor.abortCount, 1);
  assert.equal(supervisor.phase, 'app');
});

test('early process exit and external Metro health loss fail the active phase', async () => {
  const exited = new StartupSupervisor(['child'], new FakeClock());
  const metro = exited.waitForMetro();
  exited.recordProcessExit('Metro owner', 8);
  await assert.rejects(metro, /exited during metro startup with code 8/);

  const health = new StartupSupervisor(['child'], new FakeClock());
  await metroReady(health);
  const workers = health.waitForWorkers();
  health.recordExternalMetroHealthLoss(13007);
  await assert.rejects(workers, /stopped responding/);
});

test('diagnostic tail exit is ignored but failure to start aborts startup', async () => {
  const exited = new StartupSupervisor(['child'], new FakeClock());
  await metroReady(exited);
  const workers = exited.waitForWorkers();
  exited.recordLine('child', 'Execution of 1 worker started');
  exited.recordLine('child', 'Appium session created successfully');
  await workers;
  const apps = exited.waitForApps();
  exited.recordProcessExit('device:child', 9);
  assert.equal(exited.abortCount, 0);
  exited.recordLine('child', STARTUP_READY_MARKER);
  await apps;

  const failedStart = new StartupSupervisor(['child'], new FakeClock());
  await metroReady(failedStart);
  const failedWorkers = failedStart.waitForWorkers();
  failedStart.recordFailure('device:child failed to start', new Error('spawn ENOENT'));
  await assert.rejects(failedWorkers, /device:child failed to start.*spawn ENOENT/);
});

test('standalone Metro owner interruption rejects the pending barrier promptly', async () => {
  const signals = new EventEmitter();
  const child = fakeOwnedProcess();
  let drains = 0;
  const run = runPackager(false, {
    listen: async () => false,
    paths: invocationPaths('packager-interrupt-test'),
    signalSource: signals,
    spawn: () => {
      queueMicrotask(() => signals.emit('SIGINT'));
      return child.command;
    },
    drain: async processes => {
      drains += 1;
      await Promise.all([...processes].map(process => process.stop()));
    },
  });
  await promptly(assert.rejects(run, /Operator stop.*SIGINT/));
  assert.equal(drains, 1);
  assert.equal(child.stops(), 1);
});

test('serial Appium owner arms abort and drain before WDIO spawn', async () => {
  const signals = new EventEmitter();
  const child = fakeOwnedProcess();
  let drains = 0;
  let spawns = 0;
  const run = runWdioOwned(
    'android',
    {
      metroPort: 8081,
      appiumPort: 4725,
      androidApkPath: '/tmp/app-debug.apk',
    },
    {},
    'emulator-5554',
    {
      listen: async () => true,
      probeMetroPackager: async () => true,
      paths: invocationPaths('serial-interrupt-test'),
      signalSource: signals,
      spawn: () => {
        spawns += 1;
        queueMicrotask(() => signals.emit('SIGTERM'));
        return child.command;
      },
      drain: async processes => {
        drains += 1;
        await Promise.all([...processes].map(process => process.stop()));
      },
    },
  );
  await promptly(assert.rejects(run, /Operator stop.*SIGTERM/));
  assert.equal(spawns, 1);
  assert.equal(drains, 1);
  assert.equal(child.stops(), 1);
  assert.equal(signals.listenerCount('SIGINT'), 0);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});

test('a successful child may finish after its app-ready positive while siblings start', async () => {
  const supervisor = new StartupSupervisor(['fast', 'slow'], new FakeClock());
  await metroReady(supervisor);
  const workers = supervisor.waitForWorkers();
  for (const child of ['fast', 'slow']) {
    supervisor.recordLine(child, 'Execution of 1 workers started');
    supervisor.recordLine(child, 'Appium session created successfully');
  }
  await workers;
  const apps = supervisor.waitForApps();
  supervisor.recordLine('fast', STARTUP_READY_MARKER);
  supervisor.recordProcessExit('fast', 0);
  assert.equal(supervisor.abortCount, 0);
  supervisor.recordLine('slow', STARTUP_READY_MARKER);
  await apps;
});

test('E7 regression: overlapping bundle failure wins before Metro owner exit', async () => {
  const supervisor = new StartupSupervisor(['ios:a'], new FakeClock());
  await metroReady(supervisor);
  const workers = supervisor.waitForWorkers();
  supervisor.recordLine('ios:a', 'BUNDLE ./index.js failed with transform error');
  supervisor.recordProcessExit('Metro owner', 0);
  await assert.rejects(workers, /metro-transform/);
  assert.equal(supervisor.abortCount, 1);
});

test('invocation paths are unique and never overwrite first-run evidence', () => {
  const first = invocationPaths();
  const second = invocationPaths();
  assert.notEqual(first.root, second.root);
  mkdirSync(first.root, { recursive: true });
  writeFileSync(first.metro, 'first evidence', { flag: 'wx' });
  mkdirSync(second.root, { recursive: true });
  writeFileSync(second.metro, 'second evidence', { flag: 'wx' });
  assert.equal(readFileSync(first.metro, 'utf8'), 'first evidence');
  assert.equal(readFileSync(second.metro, 'utf8'), 'second evidence');
  assert.ok(existsSync(first.metro));
});

test('device startup tails are exact-target and never global', () => {
  assert.deepEqual(androidDeviceLogCommand('emulator-5558'), {
    bin: 'adb',
    args: [
      '-s',
      'emulator-5558',
      'logcat',
      '-T',
      '0',
      'ReactNative:V',
      'ReactNativeJS:V',
      'AndroidRuntime:E',
      '*:S',
    ],
  });
  const ios = iosDeviceLogCommand('selected-udid');
  assert.deepEqual(ios.args.slice(0, 4), ['simctl', 'spawn', 'selected-udid', 'log']);
  assert.match(ios.args.at(-1)!, /process == "ReactTestApp"/);
  assert.doesNotMatch(ios.args.join(' '), /booted|--all/);
});

test('Android device lines ignore host-only markers but retain bundle-load failures', async () => {
  const supervisor = new StartupSupervisor(['android'], new FakeClock());
  await metroReady(supervisor);
  const workers = supervisor.waitForWorkers();
  supervisor.recordLine('android', 'Execution of 1 worker started');
  supervisor.recordLine('android', 'Appium session created successfully');
  await workers;
  const apps = supervisor.waitForApps();
  supervisor.recordLine(
    'device:android',
    'ReactNativeJS: unrelated service ECONNREFUSED and EADDRINUSE',
    ANDROID_DEVICE_HARD_FAILURES,
  );
  assert.equal(supervisor.abortCount, 0);
  supervisor.recordLine(
    'device:android',
    'ReactNativeJS: Unable to load script from Metro',
    ANDROID_DEVICE_HARD_FAILURES,
  );
  await assert.rejects(apps, /unable-load-script/);
});

test('cleanup awaits stop and descendant completion before returning', async () => {
  const events: string[] = [];
  let complete!: () => void;
  const completion = new Promise<number>(resolve => {
    complete = () => {
      events.push('completion');
      resolve(130);
    };
  });
  const draining = stopAndDrain([
    {
      completion,
      stop: async () => {
        events.push('sigterm');
        queueMicrotask(complete);
      },
      onLine: () => () => undefined,
    },
  ]);
  events.push('summary-attempt');
  await draining;
  events.push('summary');
  assert.deepEqual(events, ['sigterm', 'summary-attempt', 'completion', 'summary']);

});

test('process-tree stop escalates and reports residual PIDs behaviorally', async () => {
  const clock = new FakeClock();
  const signals: NodeJS.Signals[] = [];
  const reports: string[] = [];
  const child = Object.assign(new EventEmitter(), {
    pid: 4321,
    exitCode: null,
    signalCode: null,
  });
  const stopping = stopChildProcessTree(child, {
    clock: clock as ProcessStopClock,
    kill: (_pid, signal) => signals.push(signal),
    report: message => reports.push(message),
  });
  assert.deepEqual(signals, ['SIGTERM']);
  clock.advance(5_000);
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  clock.advance(25_000);
  await stopping;
  assert.deepEqual(reports, [
    '[e2e-residual-pid] pid=4321 remained after 30000ms drain ceiling',
  ]);
});

test('parallel parent owns Metro supervision without a nested standalone invocation', () => {
  const namedOwnerSource = readFileSync(
    path.join(repositoryRoot, 'tooling/appium/scripts/run-named.ts'),
    'utf8',
  );
  assert.match(
    namedOwnerSource,
    /if \(isParallelParentChild\(\)\) \{\s*execute\(packagerCommand/,
  );
  assert.match(namedOwnerSource, /else \{\s*await runPackager/);
});
