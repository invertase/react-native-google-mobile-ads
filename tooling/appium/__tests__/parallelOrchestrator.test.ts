import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PARALLEL_ASSIGNMENTS,
  createParallelPlan,
  validateParallelAssignments,
  type ParallelAssignment,
} from '../src/parallelPlan.ts';
import {
  CANCELLED_EXIT_CODE,
  UNKNOWN_FAILURE_EXIT_CODE,
  childSlotExitCode,
  runParallelE2e,
  type ChildCommand,
  type ParallelRunner,
  type RunningCommand,
} from '../src/parallelOrchestrator.ts';
import { isParallelParentChild } from '../src/parentContract.ts';
import {
  WDIO_SMOKE_SPECS,
  selectedWdioSpecs,
} from '../src/wdioSpecs.ts';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

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

class MockRunner implements ParallelRunner {
  readonly events: string[] = [];
  readonly commands: ChildCommand[] = [];
  readonly children: Array<{
    command: ChildCommand;
    deferred: Deferred;
    stops: number;
  }> = [];
  appiumExitCode = 0;
  autoCompleteAppium = true;
  afterPorts?: () => void;
  abortAfterRole?: { role: string; abort(): void };
  onStart?: (command: ChildCommand) => void;
  packagerExitCodes = new Map<number, number>();
  packagerSpawnErrors = new Map<number, Error>();
  readinessErrors = new Map<number, Error>();
  versions = new Map<number, string>([
    [1, '26.5'],
    [2, '26.5'],
    [4, '26.5'],
  ]);

  async assertPortsFree(ports: number[]): Promise<void> {
    this.events.push(`ports:${ports.join(',')}`);
    this.afterPorts?.();
  }

  start(command: ChildCommand): RunningCommand {
    this.commands.push(command);
    this.events.push(`start:${command.role}`);
    const pending = deferred();
    const state = { command, deferred: pending, stops: 0 };
    this.children.push(state);
    this.onStart?.(command);
    if (command.role.endsWith('Appium') && this.autoCompleteAppium) {
      queueMicrotask(() => pending.resolve(this.appiumExitCode));
    } else if (command.role.endsWith('packager')) {
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
    return {
      completion: pending.promise,
      stop: async () => {
        state.stops += 1;
        pending.resolve(CANCELLED_EXIT_CODE);
      },
    };
  }

  async waitForPort(port: number): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
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
}

test('parallel plan locks exact slots, specs, ports, devices, logs, and 25 tests', () => {
  const android = createParallelPlan('android', {});
  assert.deepEqual(android.map(item => item.slot), [1, 2, 4]);
  assert.deepEqual(android.map(item => item.spec), WDIO_SMOKE_SPECS);
  assert.deepEqual(android.map(item => item.testCount), [15, 6, 4]);
  assert.equal(android.reduce((sum, item) => sum + item.testCount, 0), 25);
  assert.deepEqual(android.map(item => item.metroPort), [13007, 14007, 16007]);
  assert.deepEqual(android.map(item => item.appiumPort), [13013, 14013, 16013]);
  assert.deepEqual(android.map(item => item.automationPort), [13014, 14014, 16014]);
  assert.deepEqual(android.map(item => item.mjpegPort), [13015, 14015, 16015]);
  assert.deepEqual(android.map(item => item.device), [
    'emulator-5558',
    'emulator-5560',
    'emulator-5564',
  ]);
  assert.ok(android.every(item => item.logPath.includes(`slot-${item.slot}`)));

  const ios = createParallelPlan('ios', {});
  assert.deepEqual(ios.map(item => item.metroPort), [13107, 14107, 16107]);
  assert.deepEqual(ios.map(item => item.appiumPort), [13113, 14113, 16113]);
  assert.deepEqual(ios.map(item => item.automationPort), [13114, 14114, 16114]);
  assert.deepEqual(ios.map(item => item.mjpegPort), [13115, 14115, 16115]);
  assert.deepEqual(ios.map(item => item.device), [
    'RN E2E iOS slot-1',
    'RN E2E iOS slot-2',
    'RN E2E iOS slot-4',
  ]);
});

test('slot driver listeners are consumed by both actual WDIO configs', () => {
  const android = readFileSync(
    path.join(repositoryRoot, 'tooling/appium/wdio.android.conf.ts'),
    'utf8',
  );
  const ios = readFileSync(
    path.join(repositoryRoot, 'tooling/appium/wdio.ios.conf.ts'),
    'utf8',
  );
  assert.match(android, /'appium:systemPort': runtime\.slotResources\.automationPort/);
  assert.match(android, /'appium:mjpegServerPort': runtime\.slotResources\.mjpegPort/);
  assert.match(ios, /'appium:wdaLocalPort': runtime\.slotResources\.automationPort/);
  assert.match(ios, /'appium:mjpegServerPort': runtime\.slotResources\.mjpegPort/);
});

test('parallel mapping rejects forbidden, duplicate, and missing entries', () => {
  const copy = (): ParallelAssignment[] =>
    PARALLEL_ASSIGNMENTS.map(item => ({ ...item }));
  const zero = copy();
  zero[0]!.slot = 0;
  assert.throws(() => validateParallelAssignments(zero), /slot 0/);
  const reserved = copy();
  reserved[0]!.slot = 3;
  assert.throws(() => validateParallelAssignments(reserved), /slot 3/);
  const duplicate = copy();
  duplicate[1]!.slot = 1;
  assert.throws(() => validateParallelAssignments(duplicate), /duplicate slot/);
  const wrongOperationalSlot = copy();
  wrongOperationalSlot[2]!.slot = 5;
  assert.throws(() => validateParallelAssignments(wrongOperationalSlot), /must use slot 4/);
  assert.throws(() => validateParallelAssignments(copy().slice(0, 2)), /exactly three/);
  const missingSpec = copy();
  missingSpec[2]!.spec = missingSpec[1]!.spec;
  assert.throws(() => validateParallelAssignments(missingSpec), /every smoke spec/);
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
  const root = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
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
    workspace.scripts['appium:android:parallel'],
    'tsx ./scripts/parallel.ts android',
  );
  assert.equal(
    workspace.scripts['appium:ios:parallel'],
    'tsx ./scripts/parallel.ts ios',
  );
});

test('Android serializes one codegen and builds before concurrent children', async () => {
  const runner = new MockRunner();
  const summary = await runParallelE2e('android', runner, { env: {} });
  assert.equal(summary.totalTests, 25);
  assert.ok(summary.slots.every(result => result.status === 'pass'));
  assert.deepEqual(summary.slots.map(result => result.exitCode), [0, 0, 0]);
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
    'ports:13007,13013,13014,13015,14007,14013,14014,14015,16007,16013,16014,16015',
  );
  assert.equal(runner.commands.filter(item => item.script === 'tests:e2e:codegen').length, 1);
  assert.deepEqual(
    runner.commands
      .filter(item => item.script === 'tests:android:build')
      .map(item => item.env.RNGMA_E2E_SLOT),
    ['1', '2', '4'],
  );
  const lastBuild = runner.events.lastIndexOf('start:slot 4 Android build');
  const firstPackager = runner.events.findIndex(event => event === 'start:slot 1 packager');
  assert.ok(lastBuild < firstPackager);
  assert.deepEqual(
    runner.events.filter(event => event.includes('packager') && event.startsWith('start:')),
    ['start:slot 1 packager', 'start:slot 2 packager', 'start:slot 4 packager'],
  );
  const appiums = runner.commands.filter(item => item.role.endsWith('Appium'));
  assert.deepEqual(appiums.map(item => item.env.RNGMA_WDIO_SPEC), WDIO_SMOKE_SPECS);
  assert.ok(appiums.every(item => item.logPath?.endsWith('.log')));
  assert.ok(runner.commands.every(item => item.env.RNGMA_E2E_SLOT !== '3'));
});

test('iOS isolates selections, builds serially, and prebuilds WDA once', async () => {
  const runner = new MockRunner();
  await runParallelE2e('ios', runner, { env: {} });
  assert.equal(
    runner.commands.filter(item => item.script === 'tests:e2e:codegen').length,
    1,
  );
  assert.deepEqual(
    runner.events.filter(event => event.startsWith('fresh:')).map(event => event.match(/slot-(\d+)/)?.[1]),
    ['1', '2', '4'],
  );
  const builds = runner.commands.filter(item => item.script === 'tests:ios:run');
  assert.deepEqual(builds.map(item => item.args?.[1]), ['udid-1', 'udid-2', 'udid-4']);
  assert.deepEqual(builds.map(item => item.env.RNGMA_IOS_UDID), [
    'udid-1',
    'udid-2',
    'udid-4',
  ]);
  assert.equal(
    runner.commands.filter(item => item.script === 'tests:appium:ios:prebuild-wda').length,
    1,
  );
  const appiums = runner.commands.filter(item => item.role.endsWith('Appium'));
  assert.ok(appiums.every(item => item.env.RNGMA_IOS_APP?.includes(`slot-${item.env.RNGMA_E2E_SLOT}`)));
});

test('iOS rejects mixed runtimes before build or WDA mutation', async () => {
  const runner = new MockRunner();
  runner.versions.set(4, '25.0');
  await assert.rejects(() => runParallelE2e('ios', runner, { env: {} }), /consistent/);
  assert.equal(runner.commands.some(item => item.script === 'tests:ios:run'), false);
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
    const summary = (error as {
      summary?: { slots: Array<{ status: string; exitCode: number }> };
    }).summary;
    assert.deepEqual(summary?.slots.map(item => item.status), [
      'cancelled',
      'fail',
      'cancelled',
    ]);
    assert.deepEqual(summary?.slots.map(item => item.exitCode), [
      CANCELLED_EXIT_CODE,
      7,
      CANCELLED_EXIT_CODE,
    ]);
    return true;
  });
  const runtime = runner.children.filter(
    item =>
      item.command.role.endsWith('packager') ||
      item.command.role.endsWith('Appium'),
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
    const summary = (error as {
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
    }).summary;
    assert.deepEqual(
      summary?.slots.map(item => ({
        slot: item.slot,
        spec: item.spec,
        testCount: item.testCount,
        status: item.status,
        exitCode: item.exitCode,
      })),
      [
        {
          slot: 1,
          spec: WDIO_SMOKE_SPECS[0],
          testCount: 15,
          status: 'fail',
          exitCode: CANCELLED_EXIT_CODE,
        },
        {
          slot: 2,
          spec: WDIO_SMOKE_SPECS[1],
          testCount: 6,
          status: 'cancelled',
          exitCode: CANCELLED_EXIT_CODE,
        },
        {
          slot: 4,
          spec: WDIO_SMOKE_SPECS[2],
          testCount: 4,
          status: 'cancelled',
          exitCode: CANCELLED_EXIT_CODE,
        },
      ],
    );
    assert.ok(summary?.slots.every(item => item.logPath.includes(`slot-${item.slot}`)));
    return true;
  });
  const runtime = runner.children.filter(
    item =>
      item.command.role.endsWith('packager') ||
      item.command.role.endsWith('Appium'),
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
    const summary = (error as {
      summary?: { slots: Array<{ status: string; exitCode: number }> };
    }).summary;
    assert.deepEqual(summary?.slots.map(item => item.status), [
      'fail',
      'cancelled',
      'cancelled',
    ]);
    assert.deepEqual(summary?.slots.map(item => item.exitCode), [
      CANCELLED_EXIT_CODE,
      CANCELLED_EXIT_CODE,
      CANCELLED_EXIT_CODE,
    ]);
    return true;
  });
});

test('packager readiness rejection fails slot 1 with 1 and cancels siblings at 130', async () => {
  const runner = new MockRunner();
  runner.readinessErrors.set(13007, new Error('Metro never opened'));
  await assert.rejects(
    () => runParallelE2e('android', runner, { env: {} }),
    error => {
      const summary = (error as {
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
      }).summary;
      assert.deepEqual(
        summary?.slots.map(item => ({
          slot: item.slot,
          spec: item.spec,
          testCount: item.testCount,
          status: item.status,
          exitCode: item.exitCode,
        })),
        [
          {
            slot: 1,
            spec: WDIO_SMOKE_SPECS[0],
            testCount: 15,
            status: 'fail',
            exitCode: UNKNOWN_FAILURE_EXIT_CODE,
          },
          {
            slot: 2,
            spec: WDIO_SMOKE_SPECS[1],
            testCount: 6,
            status: 'cancelled',
            exitCode: CANCELLED_EXIT_CODE,
          },
          {
            slot: 4,
            spec: WDIO_SMOKE_SPECS[2],
            testCount: 4,
            status: 'cancelled',
            exitCode: CANCELLED_EXIT_CODE,
          },
        ],
      );
      assert.equal(
        summary?.slots[0]?.logPath,
        '/tmp/rngma-e2e-android-slot-1-a-primary.log',
      );
      return true;
    },
  );
  assert.equal(runner.children.some(item => item.command.role.endsWith('Appium')), false);
  const packagers = runner.children.filter(item => item.command.role.endsWith('packager'));
  assert.equal(packagers.length, 3);
  assert.ok(packagers.every(item => item.stops === 1));
});

test('packager spawn rejection is an unknown startup failure on that slot only', async () => {
  const runner = new MockRunner();
  runner.packagerSpawnErrors.set(1, new Error('spawn ENOENT'));
  await assert.rejects(
    () => runParallelE2e('android', runner, { env: {} }),
    error => {
      const summary = (error as {
        summary?: { slots: Array<{ status: string; exitCode: number }> };
      }).summary;
      assert.deepEqual(summary?.slots.map(item => item.status), [
        'fail',
        'cancelled',
        'cancelled',
      ]);
      assert.deepEqual(summary?.slots.map(item => item.exitCode), [
        UNKNOWN_FAILURE_EXIT_CODE,
        CANCELLED_EXIT_CODE,
        CANCELLED_EXIT_CODE,
      ]);
      return /spawn ENOENT/.test((error as Error).message);
    },
  );
  assert.equal(runner.children.some(item => item.command.role.endsWith('Appium')), false);
});

test('packager startup failure reports numeric exit and starts no Appium child', async () => {
  const runner = new MockRunner();
  runner.packagerExitCodes.set(2, 9);
  await assert.rejects(
    () => runParallelE2e('android', runner, { env: {} }),
    error => {
      const summary = (error as {
        summary?: { slots: Array<{ status: string; exitCode: number }> };
      }).summary;
      assert.deepEqual(summary?.slots.map(item => item.status), [
        'cancelled',
        'fail',
        'cancelled',
      ]);
      assert.deepEqual(summary?.slots.map(item => item.exitCode), [
        CANCELLED_EXIT_CODE,
        9,
        CANCELLED_EXIT_CODE,
      ]);
      return true;
    },
  );
  assert.equal(runner.children.some(item => item.command.role.endsWith('Appium')), false);
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
    () => runParallelE2e('android', runner, { env: {}, signal: controller.signal }),
    /interrupted/,
  );
  assert.deepEqual(runner.commands.map(item => item.role), ['shared codegen']);
  assert.equal(runner.children[0]?.stops, 1);
});

test('abort between preparation phases prevents the next command', async () => {
  const runner = new MockRunner();
  const controller = new AbortController();
  runner.abortAfterRole = {
    role: 'slot 1 Android build',
    abort: () => controller.abort(),
  };
  await assert.rejects(
    () => runParallelE2e('android', runner, { env: {}, signal: controller.signal }),
    /interrupted/,
  );
  assert.deepEqual(runner.commands.map(item => item.role), [
    'shared codegen',
    'slot 1 Android build',
  ]);
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
      item.command.role.endsWith('Appium'),
  );
  assert.equal(runtime.length, 6);
  assert.ok(runtime.every(item => item.stops === 1));
  assert.ok(
    runner.children
      .filter(item => !runtime.includes(item))
      .every(item => item.stops === 0),
  );
});
