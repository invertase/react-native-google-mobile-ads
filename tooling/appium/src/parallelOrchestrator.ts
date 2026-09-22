import {
  createParallelPlan,
  type ParallelPlanEntry,
  type ParallelPlatform,
} from './parallelPlan.ts';
import { PARALLEL_PARENT_CONTRACT } from './parentContract.ts';

export type ChildCommand = {
  script: string;
  args?: string[];
  env: NodeJS.ProcessEnv;
  logPath?: string;
  role: string;
};

export type RunningCommand = {
  completion: Promise<number>;
  stop(): Promise<void>;
};

export type ParallelRunner = {
  assertPortsFree(ports: number[]): Promise<void>;
  start(command: ChildCommand): RunningCommand;
  waitForPort(port: number, owner: RunningCommand): Promise<void>;
  freshEnvFile(path: string): Promise<void>;
  readEnvFile(path: string): Promise<Record<string, string>>;
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
};

function cleanBaseEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean = { ...env };
  for (const name of [
    'RNGMA_E2E_SLOT',
    'RNGMA_E2E_PLATFORM',
    'RNGMA_WDIO_SPEC',
    'RNGMA_METRO_PORT',
    'RNGMA_APPIUM_PORT',
    'RNGMA_ANDROID_UDID',
    'RNGMA_IOS_DEVICE',
    'RNGMA_IOS_UDID',
    'RNGMA_IOS_VERSION',
    'RNGMA_IOS_APP',
    'RNGMA_WDA_PREBUILT',
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

function envFile(platform: ParallelPlatform, slot: number): string {
  return `/tmp/rngma-e2e-${platform}-slot-${slot}-selected.env`;
}

class ParallelAbortError extends Error {}

type AbortContext = {
  active: Set<RunningCommand>;
  stopped: Set<RunningCommand>;
  aborted: Promise<void>;
  throwIfAborted(): void;
  stopActive(): Promise<void>;
};

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
      entry =>
        results.get(entry.slot) ??
        slotResult(entry, 'cancelled', CANCELLED_EXIT_CODE),
    ),
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
  outcome: Promise<
    | { kind: 'exit'; code: number }
    | { kind: 'error'; error: Error }
  >;
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

async function runConcurrentPhase(
  platform: ParallelPlatform,
  plan: ParallelPlanEntry[],
  runner: ParallelRunner,
  context: AbortContext,
): Promise<ParallelRunSummary> {
  context.throwIfAborted();
  const packagers = plan.map(entry =>
    startLongLived(
      runner,
      context,
      entry,
      named(
        'tests:packager',
        childEnv(entry),
        `slot ${entry.slot} packager`,
        undefined,
        entry.logPath.replace(/\.log$/, '.packager.log'),
      ),
    ),
  );

  try {
    await Promise.all(
      packagers.map(async item => {
        const ready = runner
          .waitForPort(item.entry.metroPort, item.child)
          .then(
            () => ({ kind: 'ready' as const }),
            error => ({
              kind: 'error' as const,
              error: error instanceof Error ? error : new Error(String(error)),
            }),
          );
        const outcome = await Promise.race([
          ready,
          item.outcome,
          context.aborted.then(() => ({ kind: 'aborted' as const })),
        ]);
        if (outcome.kind === 'aborted') context.throwIfAborted();
        if (outcome.kind === 'error') {
          const results = new Map<number, SlotResult>([
            [
              item.entry.slot,
              slotResult(item.entry, 'fail', UNKNOWN_FAILURE_EXIT_CODE),
            ],
          ]);
          throw withSummary(outcome.error, platform, plan, results);
        }
        if (outcome.kind === 'exit') {
          const results = new Map<number, SlotResult>([
            [item.entry.slot, slotResult(item.entry, 'fail', outcome.code)],
          ]);
          throw withSummary(
            new Error(
              `Slot ${item.entry.slot} packager exited before readiness with code ${outcome.code}.`,
            ),
            platform,
            plan,
            results,
          );
        }
      }),
    );
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
        results.set(
          failed.entry.slot,
          slotResult(failed.entry, 'fail', failed.exitCode),
        );
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
        const result = slotResult(
          item.entry,
          outcome.code === 0 ? 'pass' : 'fail',
          outcome.code,
        );
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
          void context.stopActive().then(() =>
            resolve(summaryWith(platform, plan, results)),
          );
        }
      });
    }

    for (const item of packagers) {
      void item.outcome.then(outcome => {
        if (settled) return;
        context.active.delete(item.child);
        const code =
          outcome.kind === 'exit' ? outcome.code : UNKNOWN_FAILURE_EXIT_CODE;
        void finishFailure(
          outcome.kind === 'error'
            ? outcome.error
            : new Error(
                `Slot ${item.entry.slot} packager exited unexpectedly with code ${code}.`,
              ),
          { entry: item.entry, exitCode: code },
        );
      });
    }
  });
}

export async function runParallelE2e(
  platform: ParallelPlatform,
  runner: ParallelRunner,
  options: { env?: NodeJS.ProcessEnv; signal?: AbortSignal } = {},
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
        throw new ParallelAbortError(
          `Parallel ${platform} run interrupted by signal.`,
        );
      }
    },
    stopActive() {
      const pending = [...active].filter(child => !stopped.has(child));
      for (const child of pending) stopped.add(child);
      const current = Promise.allSettled(pending.map(child => child.stop())).then(
        () => undefined,
      );
      stopping = stopping
        ? Promise.allSettled([stopping, current]).then(() => undefined)
        : current;
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
    plan = createParallelPlan(platform, cleanBaseEnv(options.env ?? process.env));
    const ports = plan.flatMap(entry => [
      entry.metroPort,
      entry.appiumPort,
      entry.automationPort,
      entry.mjpegPort,
    ]);

    context.throwIfAborted();
    await runner.assertPortsFree(ports);
    context.throwIfAborted();
    if (platform === 'ios') {
      await runOwnedCommand(
        runner,
        context,
        named('tests:e2e:codegen', cleanBaseEnv(options.env ?? process.env), 'shared codegen'),
      );
      context.throwIfAborted();
    }

    if (platform === 'android') {
      for (const entry of plan) {
        context.throwIfAborted();
        await runOwnedCommand(
          runner,
          context,
          named('tests:android:build', childEnv(entry), `slot ${entry.slot} Android build`),
        );
        context.throwIfAborted();
      }
    } else {
      const selected = new Map<number, Record<string, string>>();
      for (const entry of plan) {
        context.throwIfAborted();
        const file = envFile(platform, entry.slot);
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
      const versions = new Set(
        [...selected.values()].map(env => env.RNGMA_IOS_VERSION),
      );
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
        named(
          'tests:appium:ios:prebuild-wda',
          childEnv(first),
          'shared WDA prebuild',
        ),
      );
      context.throwIfAborted();
    }

    context.throwIfAborted();
    return await runConcurrentPhase(platform, plan, runner, context);
  } catch (error) {
    await context.stopActive();
    if (
      plan.length > 0 &&
      !(error && typeof error === 'object' && 'summary' in error)
    ) {
      throw withSummary(error, platform, plan);
    }
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await context.stopActive();
  }
}
