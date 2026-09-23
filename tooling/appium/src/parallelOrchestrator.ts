import {
  createParallelPlan,
  type ParallelPlanEntry,
  type ParallelPlatform,
} from './parallelPlan.ts';
import { PARALLEL_PARENT_CONTRACT } from './parentContract.ts';
import { serialAndroidApkPath } from './slots.ts';
import {
  ANDROID_DEVICE_HARD_FAILURES,
  PROCESS_DRAIN_TIMEOUT_MS,
  StartupSupervisor,
  androidDeviceLogCommand,
  invocationPaths,
  iosDeviceLogCommand,
  waitForMetroReadiness,
  waitForExternalMetroReadiness,
  probeMetroPlatformBundle,
  type InvocationPaths,
  type MetroPackagerProbe,
} from './startupSupervisor.ts';

export type ChildCommand = {
  script: string;
  args?: string[];
  env: NodeJS.ProcessEnv;
  logPath?: string;
  role: string;
  bin?: string;
};

export type RunningCommand = {
  completion: Promise<number>;
  stop(): Promise<void>;
  onLine(listener: (line: string) => void): () => void;
};

export type ParallelRunner = {
  assertPortsFree(ports: number[]): Promise<void>;
  assertPortListening(port: number): Promise<void>;
  start(command: ChildCommand): RunningCommand;
  waitForPort(port: number, owner: RunningCommand, signal: AbortSignal): Promise<void>;
  freshEnvFile(path: string): Promise<void>;
  readEnvFile(path: string): Promise<Record<string, string>>;
  copyFile(source: string, destination: string): Promise<void>;
  monitorPort?(port: number): RunningCommand;
  /** Test seam: skip real Metro bundle prefetch in mock orchestrator runs. */
  probeExternalMetroBundle?: MetroPackagerProbe;
};

/** Stable summary code for signal interruption, child-signal death, and sibling cancellation. */
export const CANCELLED_EXIT_CODE = 130;
export const UNKNOWN_FAILURE_EXIT_CODE = 1;

/**
 * Slot-result mapping for a child process completion.
 * Any Node signal (SIGINT/SIGTERM/SIGKILL/other) is 130. A numeric child
 * exit without a signal is preserved (0 success, 9 failure, …). Missing
 * both is the unknown-startup failure 1.
 */
export function childSlotExitCode(
  code: number | null | undefined,
  signal?: NodeJS.Signals | string | null,
): number {
  if (signal) {
    return CANCELLED_EXIT_CODE;
  }
  if (code == null) {
    return UNKNOWN_FAILURE_EXIT_CODE;
  }
  return code;
}

export type SlotResult = {
  slot: number;
  spec: string;
  testCount: number;
  logPath: string;
  status: 'pass' | 'fail' | 'cancelled';
  exitCode: number;
};

export type ParallelRunSummary = {
  platform: ParallelPlatform;
  totalTests: number;
  slots: SlotResult[];
  invocationId?: string;
  logRoot?: string;
};

export type CombinedParallelRunSummary = {
  android: ParallelRunSummary;
  ios: ParallelRunSummary;
};

function cleanBaseEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean = { ...env };
  for (const name of [
    'RNGMA_E2E_SLOT',
    'RNGMA_E2E_PLATFORM',
    'RNGMA_E2E_METRO_SLOT',
    'RNGMA_E2E_PARALLEL_SLOTS',
    'RNGMA_WDIO_SPEC',
    'RNGMA_METRO_PORT',
    'RNGMA_APPIUM_PORT',
    'RNGMA_ANDROID_UDID',
    'RNGMA_IOS_DEVICE',
    'RNGMA_IOS_UDID',
    'RNGMA_IOS_VERSION',
    'RNGMA_IOS_APP',
    'RNGMA_WDA_PREBUILT',
    'RNGMA_E2E_INVOCATION_ID',
    'RNGMA_E2E_LOG_ROOT',
  ]) {
    delete clean[name];
  }
  return clean;
}

function childEnv(entry: ParallelPlanEntry): NodeJS.ProcessEnv {
  return {
    ...entry.env,
    RNGMA_E2E_PARENT_CONTRACT: PARALLEL_PARENT_CONTRACT,
    RNGMA_E2E_CODEGEN_DONE: '1',
  };
}

function named(
  script: string,
  env: NodeJS.ProcessEnv,
  role: string,
  args?: string[],
  logPath?: string,
): ChildCommand {
  return { script, env, role, ...(args ? { args } : {}), ...(logPath ? { logPath } : {}) };
}

class ParallelAbortError extends Error {}

type AbortContext = {
  active: Set<RunningCommand>;
  stopped: Set<RunningCommand>;
  aborted: Promise<void>;
  throwIfAborted(): void;
  stopActive(): Promise<void>;
};

async function stopAndDrainCommand(child: RunningCommand): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  await Promise.race([
    Promise.allSettled([child.stop(), child.completion]).then(() => undefined),
    new Promise<void>(resolve => {
      timer = setTimeout(resolve, PROCESS_DRAIN_TIMEOUT_MS);
    }),
  ]);
  if (timer) clearTimeout(timer);
}

function slotResult(
  entry: ParallelPlanEntry,
  status: SlotResult['status'],
  exitCode: number,
): SlotResult {
  return {
    slot: entry.slot,
    spec: entry.spec,
    testCount: entry.testCount,
    logPath: entry.logPath,
    status,
    exitCode,
  };
}

function summaryWith(
  platform: ParallelPlatform,
  plan: ParallelPlanEntry[],
  results: Map<number, SlotResult>,
): ParallelRunSummary {
  return {
    platform,
    totalTests: plan.reduce((sum, item) => sum + item.testCount, 0),
    slots: plan.map(
      entry => results.get(entry.slot) ?? slotResult(entry, 'cancelled', CANCELLED_EXIT_CODE),
    ),
    invocationId: plan[0]?.env.RNGMA_E2E_INVOCATION_ID,
    logRoot: plan[0]?.env.RNGMA_E2E_LOG_ROOT,
  };
}

function withSummary(
  error: unknown,
  platform: ParallelPlatform,
  plan: ParallelPlanEntry[],
  results: Map<number, SlotResult> = new Map(),
): Error & { summary: ParallelRunSummary } {
  const normalized = error instanceof Error ? error : new Error(String(error));
  return Object.assign(normalized, {
    summary: summaryWith(platform, plan, results),
  });
}

async function runOwnedCommand(
  runner: ParallelRunner,
  context: AbortContext,
  command: ChildCommand,
): Promise<void> {
  context.throwIfAborted();
  const child = runner.start(command);
  context.active.add(child);
  context.throwIfAborted();
  try {
    const code = await child.completion;
    context.throwIfAborted();
    if (code !== 0) {
      throw new Error(`${command.role} exited with code ${code}.`);
    }
  } finally {
    context.active.delete(child);
  }
}

type LongLivedChild = {
  entry: ParallelPlanEntry;
  child: RunningCommand;
  outcome: Promise<{ kind: 'exit'; code: number } | { kind: 'error'; error: Error }>;
};

function startLongLived(
  runner: ParallelRunner,
  context: AbortContext,
  entry: ParallelPlanEntry,
  command: ChildCommand,
): LongLivedChild {
  context.throwIfAborted();
  const child = runner.start(command);
  context.active.add(child);
  context.throwIfAborted();
  return {
    entry,
    child,
    outcome: child.completion.then(
      code => ({ kind: 'exit' as const, code }),
      error => ({
        kind: 'error' as const,
        error: error instanceof Error ? error : new Error(String(error)),
      }),
    ),
  };
}

function superviseLines(
  startup: StartupSupervisor,
  source: string,
  child: RunningCommand,
): void {
  child.onLine(line => startup.recordLine(source, line));
  void child.completion.then(
    code => startup.recordProcessExit(source, code),
    () => startup.recordProcessExit(source, UNKNOWN_FAILURE_EXIT_CODE),
  );
}

function deviceTailCommand(
  platform: ParallelPlatform,
  entry: ParallelPlanEntry,
  paths: InvocationPaths,
): ChildCommand {
  const target =
    platform === 'android'
      ? androidDeviceLogCommand(entry.device)
      : iosDeviceLogCommand(entry.env.RNGMA_IOS_UDID!);
  return {
    bin: target.bin,
    script: target.bin,
    args: target.args,
    env: entry.env,
    role: `${platform} slot ${entry.slot} exact-device startup log`,
    logPath: paths.device(platform, `slot-${entry.slot}-${entry.label}`),
  };
}

async function closeStartupBarrier(
  platform: ParallelPlatform,
  appiums: LongLivedChild[],
  runner: ParallelRunner,
  context: AbortContext,
  startup: StartupSupervisor,
  paths: InvocationPaths,
): Promise<RunningCommand[]> {
  for (const item of appiums) superviseLines(startup, item.entry.label, item.child);
  await Promise.race([startup.waitForWorkers(), startup.failure]);
  console.log(
    `[e2e-startup] invocation=${paths.id} phase=worker-session-ready children=${appiums.length}/${appiums.length}`,
  );
  const tails = appiums.map(item => {
    const command = deviceTailCommand(platform, item.entry, paths);
    const tail = runner.start(command);
    context.active.add(tail);
    console.log(
      `[e2e-startup] invocation=${paths.id} phase=device-tail platform=${platform} slot=${item.entry.slot} target=${platform === 'android' ? item.entry.device : item.entry.env.RNGMA_IOS_UDID} command=${JSON.stringify([command.bin, ...(command.args ?? [])])} log=${command.logPath}`,
    );
    tail.onLine(line =>
      startup.recordLine(
        `device:${item.entry.label}`,
        line,
        platform === 'android' ? ANDROID_DEVICE_HARD_FAILURES : undefined,
      ),
    );
    void tail.completion.then(
      code => startup.recordProcessExit(`device:${item.entry.label}`, code),
      error => startup.recordFailure(`device:${item.entry.label} failed to start`, error),
    );
    return tail;
  });
  await Promise.race([startup.waitForApps(), startup.failure]);
  console.log(
    `[e2e-startup] invocation=${paths.id} phase=app-ready children=${appiums.length}/${appiums.length}`,
  );
  return tails;
}

async function runConcurrentPhase(
  platform: ParallelPlatform,
  plan: ParallelPlanEntry[],
  runner: ParallelRunner,
  context: AbortContext,
  metroMode: 'owner' | 'external',
  paths: InvocationPaths,
): Promise<ParallelRunSummary> {
  context.throwIfAborted();
  const metroEntry = plan[0]!;
  const packagers =
    metroMode === 'owner'
      ? [
          startLongLived(
            runner,
            context,
            metroEntry,
            named(
              'tests:packager',
              childEnv(metroEntry),
              `worktree Metro owner slot ${metroEntry.slot} packager`,
              undefined,
              paths.metro,
            ),
          ),
        ]
      : [];
  const startup = new StartupSupervisor(plan.map(entry => entry.label));
  startup.onFailure(() => void context.stopActive());

  try {
    if (metroMode === 'owner') {
      await Promise.all(
        packagers.map(async item => {
          superviseLines(startup, 'metro', item.child);
          const readiness = waitForMetroReadiness(startup, signal =>
            runner.waitForPort(item.entry.metroPort, item.child, signal),
          );
          const outcome = await (async () => {
            try {
              return await Promise.race([
                readiness.then(() => ({ kind: 'tcp-ready' as const })),
                item.outcome,
                startup.failure,
                context.aborted.then(() => ({ kind: 'aborted' as const })),
              ]);
            } catch (error) {
              const results = new Map<number, SlotResult>([
                [item.entry.slot, slotResult(item.entry, 'fail', UNKNOWN_FAILURE_EXIT_CODE)],
              ]);
              throw withSummary(error, platform, plan, results);
            }
          })();
          if (outcome instanceof Error) throw outcome;
          if (outcome.kind === 'aborted') context.throwIfAborted();
          if (outcome.kind === 'error') {
            const results = new Map<number, SlotResult>([
              [item.entry.slot, slotResult(item.entry, 'fail', UNKNOWN_FAILURE_EXIT_CODE)],
            ]);
            throw withSummary(outcome.error, platform, plan, results);
          }
          if (outcome.kind === 'exit') {
            const results = new Map<number, SlotResult>([
              [item.entry.slot, slotResult(item.entry, 'fail', outcome.code)],
            ]);
            throw withSummary(
              new Error(`Worktree Metro owner exited before readiness with code ${outcome.code}.`),
              platform,
              plan,
              results,
            );
          }
          console.log(
            `[e2e-startup] invocation=${paths.id} phase=metro-ready log=${paths.metro}`,
          );
        }),
      );
    } else {
      await runner.assertPortListening(metroEntry.metroPort);
      await waitForExternalMetroReadiness(startup, metroEntry.metroPort, {
        platform,
        listen: async () => true,
        probe: runner.probeExternalMetroBundle ?? probeMetroPlatformBundle,
      });
      console.log(
        `[e2e-startup] invocation=${paths.id} phase=external-metro-ready endpoint=127.0.0.1:${metroEntry.metroPort}`,
      );
      const health = runner.monitorPort?.(metroEntry.metroPort);
      if (health) {
        context.active.add(health);
        void health.completion.then(code => {
          if (code !== CANCELLED_EXIT_CODE) {
            startup.recordExternalMetroHealthLoss(metroEntry.metroPort);
          }
        });
      }
    }
    context.throwIfAborted();
  } catch (error) {
    await context.stopActive();
    throw error;
  }

  const appiums = plan.map(entry => {
    context.throwIfAborted();
    const env = childEnv(entry);
    if (platform === 'ios') env.RNGMA_IOS_APP = entry.iosAppPath;
    return startLongLived(
      runner,
      context,
      entry,
      named(
        platform === 'android' ? 'tests:appium:android' : 'tests:appium:ios',
        env,
        `slot ${entry.slot} Appium`,
        undefined,
        entry.logPath,
      ),
    );
  });

  try {
    await closeStartupBarrier(platform, appiums, runner, context, startup, paths);
  } catch (error) {
    await context.stopActive();
    throw withSummary(error, platform, plan);
  }

  return new Promise<ParallelRunSummary>((resolve, reject) => {
    let settled = false;
    const results = new Map<number, SlotResult>();

    const finishFailure = async (
      error: Error,
      failed?: { entry: ParallelPlanEntry; exitCode: number },
    ) => {
      if (settled) return;
      settled = true;
      if (failed) {
        results.set(failed.entry.slot, slotResult(failed.entry, 'fail', failed.exitCode));
      }
      await context.stopActive();
      reject(withSummary(error, platform, plan, results));
    };

    void context.aborted.then(() =>
      finishFailure(new ParallelAbortError(`Parallel ${platform} run interrupted by signal.`)),
    );

    for (const item of appiums) {
      void item.outcome.then(outcome => {
        if (settled) return;
        context.active.delete(item.child);
        if (outcome.kind === 'error') {
          void finishFailure(outcome.error, {
            entry: item.entry,
            exitCode: UNKNOWN_FAILURE_EXIT_CODE,
          });
          return;
        }
        const result = slotResult(item.entry, outcome.code === 0 ? 'pass' : 'fail', outcome.code);
        results.set(item.entry.slot, result);
        if (outcome.code !== 0) {
          void finishFailure(
            new Error(`Slot ${item.entry.slot} Appium exited with code ${outcome.code}.`),
            { entry: item.entry, exitCode: outcome.code },
          );
          return;
        }
        if (results.size === plan.length) {
          settled = true;
          void context.stopActive().then(() => resolve(summaryWith(platform, plan, results)));
        }
      });
    }

    for (const item of packagers) {
      void item.outcome.then(outcome => {
        if (settled) return;
        context.active.delete(item.child);
        const code = outcome.kind === 'exit' ? outcome.code : UNKNOWN_FAILURE_EXIT_CODE;
        void finishFailure(
          outcome.kind === 'error'
            ? outcome.error
            : new Error(`Worktree Metro owner exited unexpectedly with code ${code}.`),
          { entry: item.entry, exitCode: code },
        );
      });
    }
  });
}

async function preparePlatform(
  platform: ParallelPlatform,
  plan: ParallelPlanEntry[],
  runner: ParallelRunner,
  context: AbortContext,
  parentEnv: NodeJS.ProcessEnv,
  paths: InvocationPaths,
): Promise<void> {
  context.throwIfAborted();
  if (platform === 'ios') {
    await runOwnedCommand(
      runner,
      context,
      named('tests:e2e:codegen', cleanBaseEnv(parentEnv), 'shared codegen'),
    );
    context.throwIfAborted();
  }

  if (platform === 'android') {
    const first = plan[0]!;
    await runOwnedCommand(
      runner,
      context,
      named(
        'tests:android:build',
        childEnv(first),
        `shared Android build for Metro ${first.metroPort}`,
      ),
    );
    context.throwIfAborted();
    for (const entry of plan) {
      context.throwIfAborted();
      await runner.copyFile(serialAndroidApkPath(), entry.androidApkPath!);
      context.throwIfAborted();
    }
    return;
  }

  const selected = new Map<number, Record<string, string>>();
  for (const entry of plan) {
    context.throwIfAborted();
    const file = paths.selection(entry.slot);
    await runner.freshEnvFile(file);
    context.throwIfAborted();
    await runOwnedCommand(
      runner,
      context,
      named(
        'tests:appium:ios:select-and-boot',
        childEnv(entry),
        `slot ${entry.slot} iOS selection`,
        ['--github-env', file],
      ),
    );
    context.throwIfAborted();
    const selection = await runner.readEnvFile(file);
    context.throwIfAborted();
    selected.set(entry.slot, selection);
  }
  const versions = new Set([...selected.values()].map(env => env.RNGMA_IOS_VERSION));
  if (versions.size !== 1 || versions.has(undefined)) {
    throw new Error('Selected iOS slots must use one consistent simulator runtime.');
  }
  for (const entry of plan) {
    context.throwIfAborted();
    const selection = selected.get(entry.slot)!;
    await runOwnedCommand(
      runner,
      context,
      named(
        'tests:ios:run',
        { ...childEnv(entry), ...selection },
        `slot ${entry.slot} iOS build/install`,
        ['--udid', selection.RNGMA_IOS_UDID!],
      ),
    );
    context.throwIfAborted();
    Object.assign(entry.env, selection);
  }
  const first = plan[0]!;
  context.throwIfAborted();
  await runOwnedCommand(
    runner,
    context,
    named('tests:appium:ios:prebuild-wda', childEnv(first), 'shared WDA prebuild'),
  );
  context.throwIfAborted();
}

export async function runParallelE2e(
  platform: ParallelPlatform,
  runner: ParallelRunner,
  options: {
    env?: NodeJS.ProcessEnv;
    signal?: AbortSignal;
    metroMode?: 'owner' | 'external';
  } = {},
): Promise<ParallelRunSummary> {
  const signal = options.signal;
  let resolveAborted!: () => void;
  const aborted = new Promise<void>(resolve => {
    resolveAborted = resolve;
  });
  const active = new Set<RunningCommand>();
  const stopped = new Set<RunningCommand>();
  let stopping: Promise<void> | undefined;
  const context: AbortContext = {
    active,
    stopped,
    aborted,
    throwIfAborted() {
      if (signal?.aborted) {
        throw new ParallelAbortError(`Parallel ${platform} run interrupted by signal.`);
      }
    },
    stopActive() {
      const pending = [...active].filter(child => !stopped.has(child));
      for (const child of pending) stopped.add(child);
      const current = Promise.allSettled(
        pending.map(stopAndDrainCommand),
      ).then(() => undefined);
      stopping = stopping ? Promise.allSettled([stopping, current]).then(() => undefined) : current;
      return stopping;
    },
  };
  const onAbort = () => {
    resolveAborted();
    void context.stopActive();
  };

  // Attach the external abort listener before planning, port checks, files,
  // commands, device selection, or any other preparation can begin.
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();

  let plan: ParallelPlanEntry[] = [];
  try {
    context.throwIfAborted();
    const parentEnv = options.env ?? process.env;
    const paths = invocationPaths();
    plan = createParallelPlan(platform, parentEnv);
    for (const entry of plan) {
      entry.env.RNGMA_E2E_INVOCATION_ID = paths.id;
      entry.env.RNGMA_E2E_LOG_ROOT = paths.root;
      entry.logPath = paths.child(platform, `slot-${entry.slot}-${entry.label}`);
    }
    const metroMode = options.metroMode ?? 'owner';
    const servicePorts = plan.flatMap(entry => [
      entry.appiumPort,
      entry.automationPort,
      entry.mjpegPort,
    ]);
    const metroPort = plan[0]!.metroPort;

    context.throwIfAborted();
    await runner.assertPortsFree([...(metroMode === 'owner' ? [metroPort] : []), ...servicePorts]);
    if (metroMode === 'external') {
      await runner.assertPortListening(metroPort);
    }
    await preparePlatform(platform, plan, runner, context, parentEnv, paths);

    context.throwIfAborted();
    return await runConcurrentPhase(platform, plan, runner, context, metroMode, paths);
  } catch (error) {
    await context.stopActive();
    if (plan.length > 0 && !(error && typeof error === 'object' && 'summary' in error)) {
      throw withSummary(error, platform, plan);
    }
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await context.stopActive();
  }
}

function combinedSummaryWith(
  androidPlan: ParallelPlanEntry[],
  iosPlan: ParallelPlanEntry[],
  results: Record<ParallelPlatform, Map<number, SlotResult>>,
): CombinedParallelRunSummary {
  return {
    android: summaryWith('android', androidPlan, results.android),
    ios: summaryWith('ios', iosPlan, results.ios),
  };
}

function withCombinedSummary(
  error: unknown,
  androidPlan: ParallelPlanEntry[],
  iosPlan: ParallelPlanEntry[],
  results: Record<ParallelPlatform, Map<number, SlotResult>> = {
    android: new Map(),
    ios: new Map(),
  },
): Error & { summary: CombinedParallelRunSummary } {
  const normalized = error instanceof Error ? error : new Error(String(error));
  return Object.assign(normalized, {
    summary: combinedSummaryWith(androidPlan, iosPlan, results),
  });
}

async function runCombinedSessions(
  plans: Record<ParallelPlatform, ParallelPlanEntry[]>,
  runner: ParallelRunner,
  context: AbortContext,
  metro: LongLivedChild,
  startup: StartupSupervisor,
  paths: InvocationPaths,
): Promise<CombinedParallelRunSummary> {
  context.throwIfAborted();
  const sessions = (['android', 'ios'] as const).flatMap(platform =>
    plans[platform].map(entry => {
      const env = childEnv(entry);
      if (platform === 'ios') env.RNGMA_IOS_APP = entry.iosAppPath;
      return {
        platform,
        item: startLongLived(
          runner,
          context,
          entry,
          named(
            platform === 'android' ? 'tests:appium:android' : 'tests:appium:ios',
            env,
            `${platform} slot ${entry.slot} Appium`,
            undefined,
            entry.logPath,
          ),
        ),
      };
    }),
  );

  for (const { platform, item } of sessions) {
    superviseLines(startup, `${platform}:${item.entry.label}`, item.child);
  }
  await Promise.race([startup.waitForWorkers(), startup.failure]);
  console.log(
    `[e2e-startup] invocation=${paths.id} phase=worker-session-ready children=${sessions.length}/${sessions.length}`,
  );
  for (const { platform, item } of sessions) {
    const command = deviceTailCommand(platform, item.entry, paths);
    const tail = runner.start(command);
    context.active.add(tail);
    console.log(
      `[e2e-startup] invocation=${paths.id} phase=device-tail platform=${platform} slot=${item.entry.slot} target=${platform === 'android' ? item.entry.device : item.entry.env.RNGMA_IOS_UDID} command=${JSON.stringify([command.bin, ...(command.args ?? [])])} log=${command.logPath}`,
    );
    tail.onLine(line =>
      startup.recordLine(
        `device:${platform}:${item.entry.label}`,
        line,
        platform === 'android' ? ANDROID_DEVICE_HARD_FAILURES : undefined,
      ),
    );
    void tail.completion.then(
      code => startup.recordProcessExit(`device:${platform}:${item.entry.label}`, code),
      error =>
        startup.recordFailure(
          `device:${platform}:${item.entry.label} failed to start`,
          error,
        ),
    );
  }
  await Promise.race([startup.waitForApps(), startup.failure]);
  console.log(
    `[e2e-startup] invocation=${paths.id} phase=app-ready children=${sessions.length}/${sessions.length}`,
  );

  return new Promise<CombinedParallelRunSummary>((resolve, reject) => {
    let settled = false;
    const results: Record<ParallelPlatform, Map<number, SlotResult>> = {
      android: new Map(),
      ios: new Map(),
    };

    const finishFailure = async (
      error: Error,
      failed?: {
        platform: ParallelPlatform;
        entry: ParallelPlanEntry;
        exitCode: number;
      },
    ) => {
      if (settled) return;
      settled = true;
      if (failed) {
        results[failed.platform].set(
          failed.entry.slot,
          slotResult(failed.entry, 'fail', failed.exitCode),
        );
      }
      await context.stopActive();
      reject(withCombinedSummary(error, plans.android, plans.ios, results));
    };

    void context.aborted.then(() =>
      finishFailure(new ParallelAbortError('Combined parallel run interrupted by signal.')),
    );

    for (const { platform, item } of sessions) {
      void item.outcome.then(outcome => {
        if (settled) return;
        context.active.delete(item.child);
        if (outcome.kind === 'error') {
          void finishFailure(outcome.error, {
            platform,
            entry: item.entry,
            exitCode: UNKNOWN_FAILURE_EXIT_CODE,
          });
          return;
        }
        results[platform].set(
          item.entry.slot,
          slotResult(item.entry, outcome.code === 0 ? 'pass' : 'fail', outcome.code),
        );
        if (outcome.code !== 0) {
          void finishFailure(
            new Error(
              `${platform} slot ${item.entry.slot} Appium exited with code ${outcome.code}.`,
            ),
            { platform, entry: item.entry, exitCode: outcome.code },
          );
          return;
        }
        if (
          results.android.size === plans.android.length &&
          results.ios.size === plans.ios.length
        ) {
          settled = true;
          void context
            .stopActive()
            .then(() => resolve(combinedSummaryWith(plans.android, plans.ios, results)));
        }
      });
    }

    void metro.outcome.then(outcome => {
      if (settled) return;
      context.active.delete(metro.child);
      const code = outcome.kind === 'exit' ? outcome.code : UNKNOWN_FAILURE_EXIT_CODE;
      void finishFailure(
        outcome.kind === 'error'
          ? outcome.error
          : new Error(`Worktree Metro owner exited unexpectedly with code ${code}.`),
      );
    });
  });
}

export async function runCombinedParallelE2e(
  runner: ParallelRunner,
  options: { env?: NodeJS.ProcessEnv; signal?: AbortSignal } = {},
): Promise<CombinedParallelRunSummary> {
  const signal = options.signal;
  let resolveAborted!: () => void;
  const aborted = new Promise<void>(resolve => {
    resolveAborted = resolve;
  });
  const active = new Set<RunningCommand>();
  const stopped = new Set<RunningCommand>();
  let stopping: Promise<void> | undefined;
  const context: AbortContext = {
    active,
    stopped,
    aborted,
    throwIfAborted() {
      if (signal?.aborted) {
        throw new ParallelAbortError('Combined parallel run interrupted by signal.');
      }
    },
    stopActive() {
      const pending = [...active].filter(child => !stopped.has(child));
      for (const child of pending) stopped.add(child);
      const current = Promise.allSettled(
        pending.map(stopAndDrainCommand),
      ).then(() => undefined);
      stopping = stopping ? Promise.allSettled([stopping, current]).then(() => undefined) : current;
      return stopping;
    },
  };
  const onAbort = () => {
    resolveAborted();
    void context.stopActive();
  };

  // Arm cancellation before planning, port checks, Metro, or preparation.
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();

  let androidPlan: ParallelPlanEntry[] = [];
  let iosPlan: ParallelPlanEntry[] = [];
  try {
    context.throwIfAborted();
    const parentEnv = options.env ?? process.env;
    const paths = invocationPaths();
    androidPlan = createParallelPlan('android', parentEnv);
    iosPlan = createParallelPlan('ios', parentEnv);
    for (const entry of androidPlan) {
      entry.env.RNGMA_E2E_INVOCATION_ID = paths.id;
      entry.env.RNGMA_E2E_LOG_ROOT = paths.root;
      entry.logPath = paths.child('android', `slot-${entry.slot}-${entry.label}`);
    }
    for (const entry of iosPlan) {
      entry.env.RNGMA_E2E_INVOCATION_ID = paths.id;
      entry.env.RNGMA_E2E_LOG_ROOT = paths.root;
      entry.logPath = paths.child('ios', `slot-${entry.slot}-${entry.label}`);
    }
    const metroEntry = androidPlan[0]!;
    const ports = new Set([
      metroEntry.metroPort,
      ...androidPlan.flatMap(entry => [entry.appiumPort, entry.automationPort, entry.mjpegPort]),
      ...iosPlan.flatMap(entry => [entry.appiumPort, entry.automationPort, entry.mjpegPort]),
    ]);
    await runner.assertPortsFree([...ports]);
    context.throwIfAborted();

    const metro = startLongLived(
      runner,
      context,
      metroEntry,
      named(
        'tests:packager',
        childEnv(metroEntry),
        `worktree Metro owner slot ${metroEntry.slot} packager`,
        undefined,
        paths.metro,
      ),
    );
    const startup = new StartupSupervisor([
      ...androidPlan.map(entry => `android:${entry.label}`),
      ...iosPlan.map(entry => `ios:${entry.label}`),
    ]);
    startup.onFailure(() => void context.stopActive());
    superviseLines(startup, 'metro', metro.child);
    const readiness = waitForMetroReadiness(startup, signal =>
      runner.waitForPort(metroEntry.metroPort, metro.child, signal),
    );
    const readyOutcome = await Promise.race([
      readiness.then(() => ({ kind: 'ready' as const })),
      startup.failure,
      metro.outcome,
      context.aborted.then(() => ({ kind: 'aborted' as const })),
    ]);
    if (readyOutcome.kind === 'aborted') context.throwIfAborted();
    if (readyOutcome.kind === 'error') throw readyOutcome.error;
    if (readyOutcome.kind === 'exit') {
      throw new Error(
        `Worktree Metro owner exited before readiness with code ${readyOutcome.code}.`,
      );
    }
    console.log(
      `[e2e-startup] invocation=${paths.id} phase=metro-ready log=${paths.metro}`,
    );
    context.throwIfAborted();

    const preparations = Promise.all([
      preparePlatform('android', androidPlan, runner, context, parentEnv, paths),
      preparePlatform('ios', iosPlan, runner, context, parentEnv, paths),
    ]);
    const prepOutcome = await Promise.race([
      preparations.then(() => ({ kind: 'prepared' as const })),
      startup.failure,
      metro.outcome,
      context.aborted.then(() => ({ kind: 'aborted' as const })),
    ]);
    if (prepOutcome.kind === 'aborted') context.throwIfAborted();
    if (prepOutcome.kind === 'error') throw prepOutcome.error;
    if (prepOutcome.kind === 'exit') {
      throw new Error(
        `Worktree Metro owner exited during preparation with code ${prepOutcome.code}.`,
      );
    }
    context.throwIfAborted();

    // Cross-platform barrier: neither platform can enter Appium until both
    // preparation promises above have completed successfully.
    return await runCombinedSessions(
      { android: androidPlan, ios: iosPlan },
      runner,
      context,
      metro,
      startup,
      paths,
    );
  } catch (error) {
    await context.stopActive();
    if (
      androidPlan.length > 0 &&
      iosPlan.length > 0 &&
      !(error && typeof error === 'object' && 'summary' in error)
    ) {
      throw withCombinedSummary(error, androidPlan, iosPlan);
    }
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await context.stopActive();
  }
}
