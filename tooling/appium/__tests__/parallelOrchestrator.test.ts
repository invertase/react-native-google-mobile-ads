import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { NodeParallelRunner } from '../scripts/parallel.ts';
import {
  PARALLEL_ASSIGNMENTS,
  createParallelPlan,
  parseParallelSlots,
  validateParallelAssignments,
  type ParallelAssignment,
} from '../src/parallelPlan.ts';
import {
  CANCELLED_EXIT_CODE,
  UNKNOWN_FAILURE_EXIT_CODE,
  childSlotExitCode,
  runCombinedParallelE2e,
  runParallelE2e,
  type ChildCommand,
  type CombinedParallelRunSummary,
  type ParallelRunner,
  type RunningCommand,
} from '../src/parallelOrchestrator.ts';
import { isParallelParentChild } from '../src/parentContract.ts';
import {
  SESSION_TEST_CAP,
  SMOKE_SHARDS,
  SMOKE_SHARD_TEST_TOTAL,
} from '../src/sessionShards.ts';
import { serialAndroidApkPath, slotAndroidApkPath } from '../src/slots.ts';
import {
  WDIO_SMOKE_SPECS,
  selectedWdioSpecs,
} from '../src/wdioSpecs.ts';

/** Expected summary rows when the first slot settles one way and siblings cancel. */
function expectedSlotRows(
  first: { status: string; exitCode: number },
): Array<{ slot: number; spec: string; testCount: number; status: string; exitCode: number }> {
  return PARALLEL_ASSIGNMENTS.map((assignment, index) => ({
    slot: assignment.slot,
    spec: assignment.spec,
    testCount: assignment.testCount,
    status: index === 0 ? first.status : 'cancelled',
    exitCode: index === 0 ? first.exitCode : CANCELLED_EXIT_CODE,
  }));
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

type Deferred = {
  promise: Promise<number>;
  resolve(code: number): void;
  reject(error: Error): void;
};

function deferred(): Deferred {
  let resolve!: (code: number) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<number>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail('Timed out waiting for deterministic mock phase.');
}

async function listeningServer(): Promise<{ port: number; server: Server }> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { port: address.port, server };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

async function promptly<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('monitorPort completion did not settle promptly')),
          2_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class MockRunner implements ParallelRunner {
  readonly events: string[] = [];
  readonly commands: ChildCommand[] = [];
  readonly children: Array<{
    command: ChildCommand;
    deferred: Deferred;
    stops: number;
    emit(line: string): void;
  }> = [];
  appiumExitCode = 0;
  autoCompleteAppium = true;
  autoAppiumStartup = true;
  autoAppReady = true;
  afterPorts?: () => void;
  abortAfterRole?: { role: string; abort(): void };
  onStart?: (command: ChildCommand) => void;
  heldRoles = new Set<string>();
  commandExitCodes = new Map<string, number>();
  packagerExitCodes = new Map<number, number>();
  packagerSpawnErrors = new Map<number, Error>();
  readinessErrors = new Map<number, Error>();
  readonly copies: Array<{ source: string; destination: string }> = [];
  copyErrors = new Map<string, Error>();
  heldCopies = new Map<string, Deferred>();
  versions = new Map<number, string>([
    [1, '26.5'],
    [2, '26.5'],
    [4, '26.5'],
    [6, '26.5'],
  ]);

  async assertPortsFree(ports: number[]): Promise<void> {
    this.events.push(`ports:${ports.join(',')}`);
    this.afterPorts?.();
  }

  async assertPortListening(port: number): Promise<void> {
    this.events.push(`listening:${port}`);
  }

  probeExternalMetroBundle = async () => true;

  start(command: ChildCommand): RunningCommand {
    this.commands.push(command);
    this.events.push(`start:${command.role}`);
    const pending = deferred();
    const listeners = new Set<(line: string) => void>();
    const state = {
      command,
      deferred: pending,
      stops: 0,
      emit: (line: string) => {
        this.events.push(`line:${command.role}:${line}`);
        for (const listener of listeners) listener(line);
      },
    };
    this.children.push(state);
    this.onStart?.(command);
    const running = {
      completion: pending.promise,
      stop: async () => {
        state.stops += 1;
        this.events.push(`stop:${command.role}`);
        pending.resolve(CANCELLED_EXIT_CODE);
      },
      onLine: (listener: (line: string) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    if (this.heldRoles.has(command.role)) {
      return running;
    }
    const configuredCode = this.commandExitCodes.get(command.role);
    if (configuredCode != null) {
      queueMicrotask(() => pending.resolve(configuredCode));
    } else if (command.role.endsWith('Appium')) {
      queueMicrotask(() => {
        if (this.autoAppiumStartup) {
          state.emit('Execution of 1 worker started');
          state.emit('Appium session created successfully');
          if (this.autoAppReady) state.emit('[e2e-startup-ready] {"ok":true}');
        }
        if (this.autoCompleteAppium) pending.resolve(this.appiumExitCode);
      });
    } else if (command.role.includes('exact-device startup log')) {
      // Device tails are long-lived owners and finish only when stopped.
    } else if (command.role.endsWith('packager')) {
      queueMicrotask(() => state.emit('Dev server ready'));
      const slot = Number(command.env.RNGMA_E2E_SLOT);
      const spawnError = this.packagerSpawnErrors.get(slot);
      if (spawnError) {
        queueMicrotask(() => pending.reject(spawnError));
      } else {
        const code = this.packagerExitCodes.get(slot);
        if (code != null) queueMicrotask(() => pending.resolve(code));
      }
    } else if (!command.role.endsWith('Appium')) {
      queueMicrotask(() => {
        pending.resolve(0);
        if (this.abortAfterRole?.role === command.role) {
          this.abortAfterRole.abort();
        }
      });
    }
    return running;
  }

  async waitForPort(port: number, _owner: RunningCommand, signal: AbortSignal): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
    if (signal.aborted) return;
    const error = this.readinessErrors.get(port);
    if (error) throw error;
    this.events.push(`ready:${port}`);
  }

  async freshEnvFile(file: string): Promise<void> {
    this.events.push(`fresh:${file}`);
  }

  async readEnvFile(file: string): Promise<Record<string, string>> {
    const slot = Number(/slot-(\d+)/.exec(file)?.[1]);
    return {
      RNGMA_IOS_UDID: `udid-${slot}`,
      RNGMA_IOS_VERSION: this.versions.get(slot)!,
    };
  }

  async copyFile(source: string, destination: string): Promise<void> {
    this.events.push(`copy:${destination}`);
    this.copies.push({ source, destination });
    const error = this.copyErrors.get(destination);
    if (error) throw error;
    const held = this.heldCopies.get(destination);
    if (held) await held.promise;
  }
}

test('parallel plan maps configured 1/4/5 slots to one Metro and positional specs', () => {
  const env = { RNGMA_E2E_PARALLEL_SLOTS: '1,4,5' };
  const android = createParallelPlan('android', env);
  assert.deepEqual(
    android.map(item => item.slot),
    [1, 4, 5],
  );
  assert.deepEqual(
    android.map(item => item.spec),
    WDIO_SMOKE_SPECS,
  );
  assert.deepEqual(
    android.map(item => item.testCount),
    SMOKE_SHARDS.map(shard => shard.testCount),
  );
  assert.ok(android.every(item => item.testCount <= SESSION_TEST_CAP));
  assert.equal(
    android.reduce((sum, item) => sum + item.testCount, 0),
    SMOKE_SHARD_TEST_TOTAL,
  );
  assert.deepEqual(
    android.map(item => item.metroPort),
    [13007, 13007, 13007],
  );
  assert.deepEqual(
    android.map(item => item.appiumPort),
    [13013, 16013, 17013],
  );
  assert.deepEqual(
    android.map(item => item.automationPort),
    [13014, 16014, 17014],
  );
  assert.deepEqual(
    android.map(item => item.mjpegPort),
    [13015, 16015, 17015],
  );
  assert.deepEqual(
    android.map(item => item.device),
    ['emulator-5558', 'emulator-5564', 'emulator-5566'],
  );
  assert.ok(android.every(item => item.logPath === ''));

  const ios = createParallelPlan('ios', env);
  assert.deepEqual(
    ios.map(item => item.metroPort),
    [13007, 13007, 13007],
  );
  assert.deepEqual(
    ios.map(item => item.appiumPort),
    [13113, 16113, 17113],
  );
  assert.deepEqual(
    ios.map(item => item.automationPort),
    [13114, 16114, 17114],
  );
  assert.deepEqual(
    ios.map(item => item.mjpegPort),
    [13115, 16115, 17115],
  );
  assert.deepEqual(
    ios.map(item => item.device),
    ['RN E2E iOS slot-1', 'RN E2E iOS slot-4', 'RN E2E iOS slot-5'],
  );
});

test('slot driver listeners are consumed by both actual WDIO configs', () => {
  const android = readFileSync(
    path.join(repositoryRoot, 'tooling/appium/wdio.android.conf.ts'),
    'utf8',
  );
  const ios = readFileSync(path.join(repositoryRoot, 'tooling/appium/wdio.ios.conf.ts'), 'utf8');
  assert.match(android, /'appium:systemPort': runtime\.slotResources\.automationPort/);
  assert.match(android, /'appium:mjpegServerPort': runtime\.slotResources\.mjpegPort/);
  assert.match(ios, /'appium:wdaLocalPort': runtime\.slotResources\.automationPort/);
  assert.match(ios, /'appium:mjpegServerPort': runtime\.slotResources\.mjpegPort/);
});

test('parallel mapping rejects forbidden, duplicate, and missing entries', () => {
  const copy = (): ParallelAssignment[] => PARALLEL_ASSIGNMENTS.map(item => ({ ...item }));
  const zero = copy();
  zero[0]!.slot = 0;
  assert.throws(() => validateParallelAssignments(zero), /slot 0/);
  const reserved = copy();
  reserved[0]!.slot = 3;
  assert.throws(() => validateParallelAssignments(reserved), /slot 3/);
  const duplicate = copy();
  duplicate[1]!.slot = 1;
  assert.throws(() => validateParallelAssignments(duplicate), /duplicate slot/);
  const alternateOperationalSlot = copy();
  alternateOperationalSlot[2]!.slot = 5;
  assert.doesNotThrow(() => validateParallelAssignments(alternateOperationalSlot));
  assert.throws(() => validateParallelAssignments(copy().slice(0, 2)), /exactly one wave/);
  const missingSpec = copy();
  missingSpec[2]!.spec = missingSpec[1]!.spec;
  assert.throws(() => validateParallelAssignments(missingSpec), /first-wave smoke spec/);
});

test('parallel slot configuration rejects malformed, forbidden, duplicate, and conflicting input', () => {
  for (const value of ['', '1,4', '1,4,5,6', '1,,5', '1,1,5', '0,4,5', '1,3,5', '1,4,8']) {
    assert.throws(() => parseParallelSlots(value));
  }
  assert.throws(
    () =>
      createParallelPlan('android', {
        RNGMA_E2E_PARALLEL_SLOTS: '1,4,5',
        RNGMA_E2E_SLOT: '1',
      }),
    /conflicts with the parallel parent contract/,
  );
});

test('WDIO defaults to all specs and accepts only one exact allowlisted spec', () => {
  assert.deepEqual(selectedWdioSpecs({}), WDIO_SMOKE_SPECS);
  assert.deepEqual(selectedWdioSpecs({ RNGMA_WDIO_SPEC: WDIO_SMOKE_SPECS[1] }), [
    WDIO_SMOKE_SPECS[1],
  ]);
  for (const invalid of [
    './test/specs/**/*.ts',
    '../formats.smoke.a-primary.spec.ts',
    `${WDIO_SMOKE_SPECS[0]},${WDIO_SMOKE_SPECS[1]}`,
  ]) {
    assert.throws(() => selectedWdioSpecs({ RNGMA_WDIO_SPEC: invalid }), /exact allowlisted/);
  }
});

test('parent-child codegen contract is exact and standalone defaults remain unchanged', () => {
  assert.equal(isParallelParentChild({}), false);
  assert.equal(
    isParallelParentChild({
      RNGMA_E2E_PARENT_CONTRACT: 'rngma-parallel-v1',
    }),
    false,
  );
  assert.equal(
    isParallelParentChild({
      RNGMA_E2E_CODEGEN_DONE: '1',
    }),
    false,
  );
  assert.equal(
    isParallelParentChild({
      RNGMA_E2E_PARENT_CONTRACT: 'rngma-parallel-v1',
      RNGMA_E2E_CODEGEN_DONE: '1',
    }),
    true,
  );
});

test('root and workspace expose parallel names without changing serial scripts', () => {
  const root = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const workspace = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'tooling/appium/package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
  assert.equal(
    root.scripts['tests:appium:android'],
    'yarn workspace @invertase/rngma-appium appium:android',
  );
  assert.equal(
    root.scripts['tests:appium:ios'],
    'cross-env RNGMA_WDA_PREBUILT=1 yarn workspace @invertase/rngma-appium appium:ios',
  );
  assert.equal(
    root.scripts['tests:appium:android:parallel'],
    'yarn workspace @invertase/rngma-appium appium:android:parallel',
  );
  assert.equal(
    root.scripts['tests:appium:ios:parallel'],
    'yarn workspace @invertase/rngma-appium appium:ios:parallel',
  );
  assert.equal(
    root.scripts['tests:appium:parallel'],
    'yarn workspace @invertase/rngma-appium appium:parallel',
  );
  assert.equal(workspace.scripts['appium:parallel'], 'tsx ./scripts/parallel.ts both');
  assert.equal(workspace.scripts['appium:android:parallel'], 'tsx ./scripts/parallel.ts android');
  assert.equal(workspace.scripts['appium:ios:parallel'], 'tsx ./scripts/parallel.ts ios');
  assert.equal(
    root.scripts['tests:appium:android:parallel:external'],
    'yarn workspace @invertase/rngma-appium appium:android:parallel:external',
  );
  assert.equal(
    root.scripts['tests:appium:ios:parallel:external'],
    'yarn workspace @invertase/rngma-appium appium:ios:parallel:external',
  );
});

test('Android builds once and fans the same APK out before concurrent children', async () => {
  const runner = new MockRunner();
  const summary = await runParallelE2e('android', runner, {
    env: { RNGMA_E2E_PARALLEL_SLOTS: '1,4,5' },
  });
  assert.equal(summary.totalTests, SMOKE_SHARD_TEST_TOTAL);
  assert.ok(summary.slots.every(result => result.status === 'pass'));
  assert.deepEqual(
    summary.slots.map(result => result.exitCode),
    [0, 0, 0],
  );
  assert.ok(
    summary.slots.every(
      result =>
        result.slot > 0 &&
        result.spec.length > 0 &&
        result.logPath.length > 0 &&
        result.testCount > 0,
    ),
  );
  assert.equal(
    runner.events[0],
    'ports:13007,13013,13014,13015,16013,16014,16015,17013,17014,17015',
  );
  assert.equal(runner.commands.filter(item => item.script === 'tests:e2e:codegen').length, 0);
  const builds = runner.commands.filter(item => item.script === 'tests:android:build');
  assert.equal(builds.length, 1);
  assert.equal(builds[0]?.env.RNGMA_E2E_SLOT, '1');
  assert.equal(builds[0]?.env.RNGMA_E2E_METRO_SLOT, '1');
  assert.equal(builds[0]?.role, 'shared Android build for Metro 13007');
  assert.deepEqual(runner.copies, [1, 4, 5].map(slot => ({
    source: serialAndroidApkPath(),
    destination: slotAndroidApkPath(slot),
  })));
  const lastCopy = runner.events.lastIndexOf(`copy:${slotAndroidApkPath(5)}`);
  const firstPackager = runner.events.findIndex(event => event.includes('worktree Metro owner'));
  assert.ok(lastCopy < firstPackager);
  assert.deepEqual(
    runner.events.filter(event => event.includes('packager') && event.startsWith('start:')),
    ['start:worktree Metro owner slot 1 packager'],
  );
  const appiums = runner.commands.filter(item => item.role.endsWith('Appium'));
  assert.deepEqual(
    appiums.map(item => item.env.RNGMA_WDIO_SPEC),
    WDIO_SMOKE_SPECS,
  );
  assert.ok(appiums.every(item => item.logPath?.endsWith('.log')));
  const tails = runner.commands.filter(item => item.role.includes('exact-device startup log'));
  assert.equal(tails.length, 3);
  assert.ok(
    tails.every(
      item =>
        item.bin === 'adb' &&
        item.args?.[0] === '-s' &&
        item.args.includes('-T') &&
        item.args.includes('ReactNativeJS:V'),
    ),
  );
  assert.ok(runner.commands.every(item => item.env.RNGMA_E2E_SLOT !== '3'));
});

test('worker-phase hard failure drains owners before rejecting with summary', async () => {
  const runner = new MockRunner();
  runner.autoCompleteAppium = false;
  runner.autoAppiumStartup = false;
  const run = runParallelE2e('android', runner, { env: {} });
  await waitFor(
    () => runner.children.filter(item => item.command.role.endsWith('Appium')).length === 3,
  );
  const appiums = runner.children.filter(item => item.command.role.endsWith('Appium'));
  appiums[1]!.emit('Could not create a new session');
  await assert.rejects(run, error => {
    assert.match((error as Error).message, /session-create/);
    assert.ok('summary' in (error as object));
    assert.ok(
      runner.events.filter(event => event.startsWith('stop:')).length >= 4,
      'all active owners must stop before startup rejection is summarized',
    );
    return true;
  });
  assert.equal(
    runner.commands.some(item => item.role.includes('exact-device startup log')),
    false,
  );
});

test('app-phase Android device bundle failure aborts after exact-target tails start', async () => {
  const runner = new MockRunner();
  runner.autoCompleteAppium = false;
  runner.autoAppReady = false;
  const run = runParallelE2e('android', runner, { env: {} });
  await waitFor(
    () =>
      runner.children.filter(item => item.command.role.includes('exact-device startup log'))
        .length === 3,
  );
  const tail = runner.children.find(item =>
    item.command.role.includes('exact-device startup log'),
  )!;
  tail.emit('ReactNativeJS: unrelated ECONNREFUSED');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(runner.events.filter(event => event.startsWith('stop:')).length, 0);
  tail.emit('ReactNativeJS: Unable to load script from Metro');
  await assert.rejects(run, /unable-load-script/);
  assert.ok(runner.children.every(item => item.stops <= 1));
});

test('Android starts one first-slot build for an alternate configured triple', async () => {
  const runner = new MockRunner();
  await runParallelE2e('android', runner, {
    env: { RNGMA_E2E_PARALLEL_SLOTS: '7,6,4' },
  });
  const builds = runner.commands.filter(item => item.script === 'tests:android:build');
  assert.equal(builds.length, 1);
  assert.equal(builds[0]?.env.RNGMA_E2E_SLOT, '7');
  assert.equal(builds[0]?.env.RNGMA_E2E_METRO_SLOT, '7');
  assert.deepEqual(
    runner.copies,
    [7, 6, 4].map(slot => ({
      source: serialAndroidApkPath(),
      destination: slotAndroidApkPath(slot),
    })),
  );
});

test('Android copy failure prevents Appium and reports cancelled slot summaries', async () => {
  const runner = new MockRunner();
  const failedDestination = slotAndroidApkPath(4);
  runner.copyErrors.set(failedDestination, new Error('copy failed'));
  await assert.rejects(
    () =>
      runParallelE2e('android', runner, {
        env: { RNGMA_E2E_PARALLEL_SLOTS: '1,4,5' },
      }),
    error => {
      const summary = (
        error as {
          summary?: { slots: Array<{ status: string; exitCode: number }> };
        }
      ).summary;
      assert.ok(summary?.slots.every(item => item.status === 'cancelled'));
      assert.ok(summary?.slots.every(item => item.exitCode === CANCELLED_EXIT_CODE));
      return /copy failed/.test((error as Error).message);
    },
  );
  assert.equal(
    runner.commands.filter(item => item.script === 'tests:android:build').length,
    1,
  );
  assert.deepEqual(
    runner.copies.map(item => item.destination),
    [slotAndroidApkPath(1), failedDestination],
  );
  assert.equal(
    runner.commands.some(item => item.role.endsWith('Appium')),
    false,
  );
});

test('external Metro consumers require the shared listener and never own a packager', async () => {
  const runner = new MockRunner();
  await runParallelE2e('android', runner, {
    env: { RNGMA_E2E_PARALLEL_SLOTS: '1,4,5' },
    metroMode: 'external',
  });
  assert.equal(
    runner.commands.some(item => item.script === 'tests:packager'),
    false,
  );
  assert.deepEqual(
    runner.events.filter(event => event.startsWith('listening:')),
    ['listening:13007', 'listening:13007'],
  );
  const children = runner.commands.filter(item => item.role.endsWith('Appium'));
  assert.ok(children.every(item => item.env.RNGMA_E2E_METRO_SLOT === '1'));
});

test('real external-port monitor settles on cancellation and listener loss', async () => {
  const runner = new NodeParallelRunner();

  const cancelledListener = await listeningServer();
  try {
    const cancelled = runner.monitorPort(cancelledListener.port);
    await cancelled.stop();
    assert.equal(await promptly(cancelled.completion), CANCELLED_EXIT_CODE);
  } finally {
    await closeServer(cancelledListener.server);
  }

  const unhealthyListener = await listeningServer();
  const unhealthy = runner.monitorPort(unhealthyListener.port);
  await closeServer(unhealthyListener.server);
  assert.equal(await promptly(unhealthy.completion), UNKNOWN_FAILURE_EXIT_CODE);
});

test('real Metro port waiter converts owner spawn rejection to exit failure', async () => {
  const runner = new NodeParallelRunner();
  const owner: RunningCommand = {
    completion: Promise.reject(new Error('spawn ENOENT')),
    stop: async () => undefined,
    onLine: () => () => undefined,
  };
  await promptly(
    assert.rejects(
      runner.waitForPort(1, owner, new AbortController().signal),
      /Packager exited with code 1 before port 1 opened/,
    ),
  );
});

test('combined barrier launches all six Appium children only after both preps', async () => {
  const runner = new MockRunner();
  runner.autoCompleteAppium = false;
  const androidCopy = deferred();
  runner.heldCopies.set(slotAndroidApkPath(6), androidCopy);
  runner.heldRoles.add('shared WDA prebuild');
  const run = runCombinedParallelE2e(runner, {
    env: { RNGMA_E2E_PARALLEL_SLOTS: '1,4,6' },
  });

  await waitFor(
    () =>
      runner.events.includes(`copy:${slotAndroidApkPath(6)}`) &&
      runner.children.some(item => item.command.role === 'shared WDA prebuild'),
  );
  const metroChildren = runner.children.filter(item => item.command.role.endsWith('packager'));
  assert.equal(metroChildren.length, 1);
  assert.equal(
    runner.events.some(event => event.startsWith('listening:')),
    false,
  );
  assert.ok(
    runner.events.indexOf('ready:13007') <
      runner.events.indexOf('start:shared Android build for Metro 13007'),
  );

  const iosPrep = runner.children.find(item => item.command.role === 'shared WDA prebuild')!;
  androidCopy.resolve(0);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(runner.children.filter(item => item.command.role.endsWith('Appium')).length, 0);
  iosPrep.deferred.resolve(0);
  await waitFor(
    () => runner.children.filter(item => item.command.role.endsWith('Appium')).length === 6,
  );

  const appiums = runner.children.filter(item => item.command.role.endsWith('Appium'));
  assert.equal(appiums.filter(item => item.command.role.startsWith('android ')).length, 3);
  assert.equal(appiums.filter(item => item.command.role.startsWith('ios ')).length, 3);
  assert.ok(appiums.every(item => item.stops === 0));
  await waitFor(
    () =>
      runner.children.filter(item => item.command.role.includes('exact-device startup log'))
        .length === 6,
  );
  for (const child of appiums) child.deferred.resolve(0);

  const summary = await run;
  assert.equal(summary.android.totalTests, SMOKE_SHARD_TEST_TOTAL);
  assert.equal(summary.ios.totalTests, SMOKE_SHARD_TEST_TOTAL);
  for (const platform of [summary.android, summary.ios]) {
    assert.deepEqual(
      platform.slots.map(item => item.testCount),
      SMOKE_SHARDS.map(shard => shard.testCount),
    );
    assert.ok(platform.slots.every(item => item.testCount <= SESSION_TEST_CAP));
  }
  assert.equal(metroChildren[0]?.stops, 1);
});

test('combined preparation failure cancels sibling prep and one Metro', async () => {
  const runner = new MockRunner();
  runner.heldRoles.add('shared codegen');
  runner.copyErrors.set(slotAndroidApkPath(6), new Error('slot 6 APK copy failed'));
  await assert.rejects(
    () =>
      runCombinedParallelE2e(runner, {
        env: { RNGMA_E2E_PARALLEL_SLOTS: '1,4,6' },
      }),
    /slot 6 APK copy failed/,
  );
  assert.equal(
    runner.children.some(item => item.command.role.endsWith('Appium')),
    false,
  );
  const owned = runner.children.filter(
    item => item.command.role.endsWith('packager') || item.command.role === 'shared codegen',
  );
  assert.ok(owned.every(item => item.stops === 1));
});

test('combined Metro hard marker during preparation preserves its diagnostic', async () => {
  const runner = new MockRunner();
  runner.heldRoles.add('shared codegen');
  runner.heldRoles.add('shared Android build for Metro 13007');
  runner.onStart = command => {
    if (command.role !== 'shared codegen') return;
    const metro = runner.children.find(item => item.command.role.endsWith('packager'));
    metro?.emit('BUNDLE ./index.js failed with transform error');
  };
  await assert.rejects(
    () =>
      runCombinedParallelE2e(runner, {
        env: { RNGMA_E2E_PARALLEL_SLOTS: '1,4,6' },
      }),
    /metro-transform/,
  );
  assert.equal(
    runner.children.some(item => item.command.role.endsWith('Appium')),
    false,
  );
});

test('combined Appium failure cancels sibling platform and Metro once', async () => {
  const runner = new MockRunner();
  runner.autoCompleteAppium = false;
  const run = runCombinedParallelE2e(runner, {
    env: { RNGMA_E2E_PARALLEL_SLOTS: '1,4,6' },
  });
  await waitFor(
    () => runner.children.filter(item => item.command.role.endsWith('Appium')).length === 6,
  );
  const appiums = runner.children.filter(item => item.command.role.endsWith('Appium'));
  const failed = appiums.find(item => item.command.role === 'android slot 1 Appium')!;
  failed.deferred.resolve(9);
  await assert.rejects(run, error => {
    const summary = (error as { summary?: CombinedParallelRunSummary }).summary;
    assert.equal(summary?.android.totalTests, SMOKE_SHARD_TEST_TOTAL);
    assert.equal(summary?.ios.totalTests, SMOKE_SHARD_TEST_TOTAL);
    assert.equal(summary?.android.slots[0]?.exitCode, 9);
    assert.ok(summary?.ios.slots.every(item => item.exitCode === CANCELLED_EXIT_CODE));
    return true;
  });
  const runtime = runner.children.filter(
    item => item.command.role.endsWith('packager') || item.command.role.endsWith('Appium'),
  );
  assert.equal(runtime.length, 7);
  assert.ok(runtime.every(item => item === failed || item.stops === 1));
});

test('combined unexpected Metro exit cancels all six Appium children', async () => {
  const runner = new MockRunner();
  runner.autoCompleteAppium = false;
  const run = runCombinedParallelE2e(runner, {
    env: { RNGMA_E2E_PARALLEL_SLOTS: '1,4,6' },
  });
  await waitFor(
    () => runner.children.filter(item => item.command.role.endsWith('Appium')).length === 6,
  );
  const metro = runner.children.find(item => item.command.role.endsWith('packager'))!;
  metro.deferred.resolve(8);
  await assert.rejects(run, /Metro owner exited unexpectedly with code 8/);
  assert.ok(
    runner.children
      .filter(item => item.command.role.endsWith('Appium'))
      .every(item => item.stops === 1),
  );
});

test('combined abort during prep cancels owned children and launches no Appium', async () => {
  const runner = new MockRunner();
  const controller = new AbortController();
  runner.heldRoles.add('shared WDA prebuild');
  const run = runCombinedParallelE2e(runner, {
    env: { RNGMA_E2E_PARALLEL_SLOTS: '1,4,6' },
    signal: controller.signal,
  });
  await waitFor(
    () =>
      runner.events.includes(`copy:${slotAndroidApkPath(6)}`) &&
      runner.children.some(item => item.command.role === 'shared WDA prebuild'),
  );
  controller.abort();
  await assert.rejects(run, /interrupted/);
  assert.equal(
    runner.children.some(item => item.command.role.endsWith('Appium')),
    false,
  );
  assert.ok(
    runner.children
      .filter(
        item => item.command.role.endsWith('packager') || runner.heldRoles.has(item.command.role),
      )
      .every(item => item.stops === 1),
  );
});

test('combined pre-abort stops before ports, Metro, or preparation', async () => {
  const runner = new MockRunner();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () =>
      runCombinedParallelE2e(runner, {
        env: { RNGMA_E2E_PARALLEL_SLOTS: '1,4,6' },
        signal: controller.signal,
      }),
    /interrupted/,
  );
  assert.deepEqual(runner.events, []);
  assert.deepEqual(runner.children, []);
});

test('combined invalid parent environment fails before host work', async () => {
  for (const env of [
    { RNGMA_E2E_PARALLEL_SLOTS: '1,4' },
    {
      RNGMA_E2E_PARALLEL_SLOTS: '1,4,6',
      RNGMA_E2E_SLOT: '1',
    },
  ]) {
    const runner = new MockRunner();
    await assert.rejects(() => runCombinedParallelE2e(runner, { env }));
    assert.deepEqual(runner.events, []);
    assert.deepEqual(runner.children, []);
  }
});

test('combined Metro readiness failure prevents all preparation', async () => {
  const runner = new MockRunner();
  runner.readinessErrors.set(13007, new Error('Metro never opened'));
  await assert.rejects(
    () =>
      runCombinedParallelE2e(runner, {
        env: { RNGMA_E2E_PARALLEL_SLOTS: '1,4,6' },
      }),
    /Metro never opened/,
  );
  assert.deepEqual(
    runner.commands.map(item => item.role),
    ['worktree Metro owner slot 1 packager'],
  );
  assert.equal(runner.children[0]?.stops, 1);
});

test('iOS isolates selections, builds serially, and prebuilds WDA once', async () => {
  const runner = new MockRunner();
  await runParallelE2e('ios', runner, { env: {} });
  assert.equal(runner.commands.filter(item => item.script === 'tests:e2e:codegen').length, 1);
  assert.deepEqual(
    runner.events
      .filter(event => event.startsWith('fresh:'))
      .map(event => event.match(/slot-(\d+)/)?.[1]),
    ['1', '2', '4'],
  );
  const builds = runner.commands.filter(item => item.script === 'tests:ios:run');
  assert.deepEqual(
    builds.map(item => item.args?.[1]),
    ['udid-1', 'udid-2', 'udid-4'],
  );
  assert.deepEqual(
    builds.map(item => item.env.RNGMA_IOS_UDID),
    ['udid-1', 'udid-2', 'udid-4'],
  );
  assert.equal(
    runner.commands.filter(item => item.script === 'tests:appium:ios:prebuild-wda').length,
    1,
  );
  const appiums = runner.commands.filter(item => item.role.endsWith('Appium'));
  assert.ok(
    appiums.every(item => item.env.RNGMA_IOS_APP?.includes(`slot-${item.env.RNGMA_E2E_SLOT}`)),
  );
});

test('iOS rejects mixed runtimes before build or WDA mutation', async () => {
  const runner = new MockRunner();
  runner.versions.set(4, '25.0');
  await assert.rejects(() => runParallelE2e('ios', runner, { env: {} }), /consistent/);
  assert.equal(
    runner.commands.some(item => item.script === 'tests:ios:run'),
    false,
  );
  assert.equal(
    runner.commands.some(item => item.script === 'tests:appium:ios:prebuild-wda'),
    false,
  );
});

test('first child failure cancels only started siblings and aggregates exits', async () => {
  const runner = new MockRunner();
  runner.autoCompleteAppium = false;
  const run = runParallelE2e('android', runner, { env: {} });
  await waitFor(
    () => runner.children.filter(item => item.command.role.endsWith('Appium')).length === 3,
  );
  const appiums = runner.children.filter(item => item.command.role.endsWith('Appium'));
  assert.equal(appiums.length, 3);
  appiums[1]!.deferred.resolve(7);
  await assert.rejects(run, error => {
    const summary = (
      error as {
        summary?: { slots: Array<{ status: string; exitCode: number }> };
      }
    ).summary;
    assert.deepEqual(
      summary?.slots.map(item => item.status),
      ['cancelled', 'fail', 'cancelled'],
    );
    assert.deepEqual(
      summary?.slots.map(item => item.exitCode),
      [CANCELLED_EXIT_CODE, 7, CANCELLED_EXIT_CODE],
    );
    return true;
  });
  const runtime = runner.children.filter(
    item => item.command.role.endsWith('packager') || item.command.role.endsWith('Appium'),
  );
  assert.ok(runtime.every(item => item.stops === 1 || item === appiums[1]));
});

test('child signal deaths map every Node signal to slot exitCode 130', () => {
  assert.equal(childSlotExitCode(0, undefined), 0);
  assert.equal(childSlotExitCode(9, null), 9);
  assert.equal(childSlotExitCode(null, undefined), UNKNOWN_FAILURE_EXIT_CODE);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGHUP', 'SIGUSR1'] as const) {
    assert.equal(childSlotExitCode(null, signal), CANCELLED_EXIT_CODE);
    assert.equal(childSlotExitCode(0, signal), CANCELLED_EXIT_CODE);
  }
  const runnerSource = readFileSync(
    path.join(repositoryRoot, 'tooling/appium/scripts/parallel.ts'),
    'utf8',
  );
  assert.match(runnerSource, /childSlotExitCode\(code, signal\)/);
  assert.doesNotMatch(runnerSource, /137|143/);
});

test('SIGTERM child completion fails slot 1 with 130 and cancels siblings at 130', async () => {
  const runner = new MockRunner();
  runner.autoCompleteAppium = false;
  const run = runParallelE2e('android', runner, { env: {} });
  await waitFor(
    () => runner.children.filter(item => item.command.role.endsWith('Appium')).length === 3,
  );
  const appiums = runner.children.filter(item => item.command.role.endsWith('Appium'));
  appiums[0]!.deferred.resolve(childSlotExitCode(null, 'SIGTERM'));
  await assert.rejects(run, error => {
    const summary = (
      error as {
        summary?: {
          slots: Array<{
            slot: number;
            spec: string;
            testCount: number;
            logPath: string;
            status: string;
            exitCode: number;
          }>;
        };
      }
    ).summary;
    assert.deepEqual(
      summary?.slots.map(item => ({
        slot: item.slot,
        spec: item.spec,
        testCount: item.testCount,
        status: item.status,
        exitCode: item.exitCode,
      })),
      expectedSlotRows({ status: 'fail', exitCode: CANCELLED_EXIT_CODE }),
    );
    assert.ok(summary?.slots.every(item => item.logPath.includes(`slot-${item.slot}`)));
    return true;
  });
  const runtime = runner.children.filter(
    item => item.command.role.endsWith('packager') || item.command.role.endsWith('Appium'),
  );
  assert.ok(runtime.every(item => item.stops === 1 || item === appiums[0]));
});

test('SIGKILL child completion uses the same 130 slot mapping', async () => {
  const runner = new MockRunner();
  runner.autoCompleteAppium = false;
  const run = runParallelE2e('android', runner, { env: {} });
  await waitFor(
    () => runner.children.filter(item => item.command.role.endsWith('Appium')).length === 3,
  );
  const appiums = runner.children.filter(item => item.command.role.endsWith('Appium'));
  appiums[0]!.deferred.resolve(childSlotExitCode(null, 'SIGKILL'));
  await assert.rejects(run, error => {
    const summary = (
      error as {
        summary?: { slots: Array<{ status: string; exitCode: number }> };
      }
    ).summary;
    assert.deepEqual(
      summary?.slots.map(item => item.status),
      ['fail', 'cancelled', 'cancelled'],
    );
    assert.deepEqual(
      summary?.slots.map(item => item.exitCode),
      [CANCELLED_EXIT_CODE, CANCELLED_EXIT_CODE, CANCELLED_EXIT_CODE],
    );
    return true;
  });
});

test('packager readiness rejection fails slot 1 with 1 and cancels siblings at 130', async () => {
  const runner = new MockRunner();
  runner.readinessErrors.set(13007, new Error('Metro never opened'));
  await assert.rejects(
    () => runParallelE2e('android', runner, { env: {} }),
    error => {
      const summary = (
        error as {
          summary?: {
            slots: Array<{
              slot: number;
              spec: string;
              testCount: number;
              logPath: string;
              status: string;
              exitCode: number;
            }>;
          };
        }
      ).summary;
      assert.deepEqual(
        summary?.slots.map(item => ({
          slot: item.slot,
          spec: item.spec,
          testCount: item.testCount,
          status: item.status,
          exitCode: item.exitCode,
        })),
        expectedSlotRows({ status: 'fail', exitCode: UNKNOWN_FAILURE_EXIT_CODE }),
      );
      assert.match(
        summary?.slots[0]?.logPath ?? '',
        /^\/tmp\/rngma-e2e\/[^/]+\/android-slot-1-a-primary\.log$/,
      );
      return true;
    },
  );
  assert.equal(
    runner.children.some(item => item.command.role.endsWith('Appium')),
    false,
  );
  const packagers = runner.children.filter(item => item.command.role.endsWith('packager'));
  assert.equal(packagers.length, 1);
  assert.ok(packagers.every(item => item.stops === 1));
});

test('packager spawn rejection is an unknown startup failure on that slot only', async () => {
  const runner = new MockRunner();
  runner.packagerSpawnErrors.set(1, new Error('spawn ENOENT'));
  await assert.rejects(
    () => runParallelE2e('android', runner, { env: {} }),
    error => {
      const summary = (
        error as {
          summary?: { slots: Array<{ status: string; exitCode: number }> };
        }
      ).summary;
      assert.deepEqual(
        summary?.slots.map(item => item.status),
        ['fail', 'cancelled', 'cancelled'],
      );
      assert.deepEqual(
        summary?.slots.map(item => item.exitCode),
        [UNKNOWN_FAILURE_EXIT_CODE, CANCELLED_EXIT_CODE, CANCELLED_EXIT_CODE],
      );
      return /spawn ENOENT/.test((error as Error).message);
    },
  );
  assert.equal(
    runner.children.some(item => item.command.role.endsWith('Appium')),
    false,
  );
});

test('packager startup failure reports numeric exit and starts no Appium child', async () => {
  const runner = new MockRunner();
  runner.packagerExitCodes.set(1, 9);
  await assert.rejects(
    () => runParallelE2e('android', runner, { env: {} }),
    error => {
      const summary = (
        error as {
          summary?: { slots: Array<{ status: string; exitCode: number }> };
        }
      ).summary;
      assert.deepEqual(
        summary?.slots.map(item => item.status),
        ['fail', 'cancelled', 'cancelled'],
      );
      assert.deepEqual(
        summary?.slots.map(item => item.exitCode),
        [9, CANCELLED_EXIT_CODE, CANCELLED_EXIT_CODE],
      );
      return true;
    },
  );
  assert.equal(
    runner.children.some(item => item.command.role.endsWith('Appium')),
    false,
  );
  assert.ok(
    runner.children
      .filter(item => item.command.role.endsWith('packager'))
      .every(item => item.stops <= 1),
  );
});

test('pre-aborted signal fails before ports or command spawn', async () => {
  const runner = new MockRunner();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => runParallelE2e('android', runner, { env: {}, signal: controller.signal }),
    /interrupted/,
  );
  assert.deepEqual(runner.events, []);
  assert.deepEqual(runner.children, []);
});

test('external abort listener is removed after successful completion', async () => {
  const runner = new MockRunner();
  const controller = new AbortController();
  const signal = controller.signal;
  const add = signal.addEventListener.bind(signal);
  const remove = signal.removeEventListener.bind(signal);
  let adds = 0;
  let removes = 0;
  signal.addEventListener = ((...args: Parameters<AbortSignal['addEventListener']>) => {
    adds += 1;
    return add(...args);
  }) as AbortSignal['addEventListener'];
  signal.removeEventListener = ((...args: Parameters<AbortSignal['removeEventListener']>) => {
    removes += 1;
    return remove(...args);
  }) as AbortSignal['removeEventListener'];
  await runParallelE2e('android', runner, { env: {}, signal });
  assert.equal(adds, 1);
  assert.equal(removes, 1);
});

test('abort during earliest preparation stops it once and starts nothing later', async () => {
  const runner = new MockRunner();
  const controller = new AbortController();
  runner.onStart = command => {
    if (command.role === 'shared codegen') controller.abort();
  };
  await assert.rejects(
    () => runParallelE2e('ios', runner, { env: {}, signal: controller.signal }),
    /interrupted/,
  );
  assert.deepEqual(
    runner.commands.map(item => item.role),
    ['shared codegen'],
  );
  assert.equal(runner.children[0]?.stops, 1);
});

test('abort between preparation phases prevents the next command', async () => {
  const runner = new MockRunner();
  const controller = new AbortController();
  runner.abortAfterRole = {
    role: 'shared Android build for Metro 13007',
    abort: () => controller.abort(),
  };
  await assert.rejects(
    () => runParallelE2e('android', runner, { env: {}, signal: controller.signal }),
    /interrupted/,
  );
  assert.deepEqual(
    runner.commands.map(item => item.role),
    ['shared Android build for Metro 13007'],
  );
  assert.deepEqual(runner.copies, []);
  assert.ok(runner.children.every(item => item.stops <= 1));
});

test('signal cleanup stops every task-owned runtime child once with numeric cancellation', async () => {
  const runner = new MockRunner();
  runner.autoCompleteAppium = false;
  const controller = new AbortController();
  const run = runParallelE2e('android', runner, {
    env: {},
    signal: controller.signal,
  });
  await waitFor(
    () => runner.children.filter(item => item.command.role.endsWith('Appium')).length === 3,
  );
  controller.abort();
  await assert.rejects(run, error => {
    const typed = error as {
      message?: string;
      summary?: { slots: Array<{ status: string; exitCode: number }> };
    };
    assert.match(typed.message ?? '', /interrupted/);
    assert.deepEqual(
      typed.summary?.slots.map(item => item.status),
      ['cancelled', 'cancelled', 'cancelled'],
    );
    assert.deepEqual(
      typed.summary?.slots.map(item => item.exitCode),
      [CANCELLED_EXIT_CODE, CANCELLED_EXIT_CODE, CANCELLED_EXIT_CODE],
    );
    return true;
  });
  const runtime = runner.children.filter(
    item =>
      item.command.role.endsWith('packager') ||
      item.command.role.endsWith('Appium') ||
      item.command.role.includes('exact-device startup log'),
  );
  assert.equal(runtime.length, 7);
  assert.ok(runtime.every(item => item.stops === 1));
  assert.ok(
    runner.children.filter(item => !runtime.includes(item)).every(item => item.stops === 0),
  );
});
