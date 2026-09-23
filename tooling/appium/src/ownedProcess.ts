import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  CANCELLED_EXIT_CODE,
  childSlotExitCode,
  type RunningCommand,
} from './parallelOrchestrator.ts';
import { PROCESS_DRAIN_TIMEOUT_MS } from './startupSupervisor.ts';

export type ProcessStopClock = {
  setTimeout(callback: () => void, milliseconds: number): unknown;
  clearTimeout(timer: unknown): void;
};

const processStopClock: ProcessStopClock = {
  setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clearTimeout: timer => clearTimeout(timer as NodeJS.Timeout),
};

type OperatorSignal = 'SIGINT' | 'SIGTERM';

type SignalSource = {
  once(signal: OperatorSignal, listener: () => void): unknown;
  removeListener(signal: OperatorSignal, listener: () => void): unknown;
};

export function armAbortSignals(
  controller: AbortController,
  onAbort: (signal: OperatorSignal) => void = () => undefined,
  source: SignalSource = process,
): () => void {
  const listeners = new Map<OperatorSignal, () => void>();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    const listener = () => {
      if (controller.signal.aborted) return;
      controller.abort();
      onAbort(signal);
    };
    listeners.set(signal, listener);
    source.once(signal, listener);
  }
  return () => {
    for (const [signal, listener] of listeners) {
      source.removeListener(signal, listener);
    }
  };
}

export function stopChildProcessTree(
  child: Pick<ChildProcess, 'pid' | 'exitCode' | 'signalCode' | 'once'>,
  options: {
    clock?: ProcessStopClock;
    kill?: (pid: number, signal: NodeJS.Signals) => void;
    report?: (message: string) => void;
  } = {},
): Promise<void> {
  if (!child.pid || child.exitCode != null || child.signalCode != null) {
    return Promise.resolve();
  }
  const clock = options.clock ?? processStopClock;
  const kill = options.kill ?? process.kill;
  const report = options.report ?? console.error;
  const pid = child.pid;
  const killGroup = (signal: NodeJS.Signals) => {
    try {
      kill(-pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  return new Promise(resolve => {
    killGroup('SIGTERM');
    const force = clock.setTimeout(() => killGroup('SIGKILL'), 5_000);
    const drain = clock.setTimeout(() => {
      report(
        `[e2e-residual-pid] pid=${pid} remained after ${PROCESS_DRAIN_TIMEOUT_MS}ms drain ceiling`,
      );
      resolve();
    }, PROCESS_DRAIN_TIMEOUT_MS);
    child.once('exit', () => {
      clock.clearTimeout(force);
      clock.clearTimeout(drain);
      resolve();
    });
  });
}

class OwnedProcess implements RunningCommand {
  readonly completion: Promise<number>;
  private readonly listeners = new Set<(line: string) => void>();
  private stopping?: Promise<void>;
  private stdoutRemainder = '';
  private stderrRemainder = '';

  constructor(
    private readonly child: ChildProcess,
    logPath: string,
  ) {
    mkdirSync(path.dirname(logPath), { recursive: true });
    const log = createWriteStream(logPath, { flags: 'wx' });
    const consume = (stream: 'stdout' | 'stderr', chunk: Buffer | string) => {
      const complete = `${
        stream === 'stdout' ? this.stdoutRemainder : this.stderrRemainder
      }${String(chunk)}`.split(/\r?\n/);
      const remainder = complete.pop() ?? '';
      if (stream === 'stdout') this.stdoutRemainder = remainder;
      else this.stderrRemainder = remainder;
      for (const line of complete) {
        for (const listener of this.listeners) listener(line);
      }
      (stream === 'stdout' ? process.stdout : process.stderr).write(chunk);
      log.write(chunk);
    };
    child.stdout?.on('data', chunk => consume('stdout', chunk));
    child.stderr?.on('data', chunk => consume('stderr', chunk));
    this.completion = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => {
        const exitCode = childSlotExitCode(code, signal);
        log.end(() => resolve(exitCode));
      });
    });
  }

  onLine(listener: (line: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = stopChildProcessTree(this.child);
    return this.stopping;
  }
}

export function spawnOwned(
  bin: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    logPath: string;
  },
): OwnedProcess {
  return new OwnedProcess(
    spawn(bin, args, {
      cwd: options.cwd,
      env: options.env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
    options.logPath,
  );
}

export async function stopAndDrain(processes: Iterable<RunningCommand>): Promise<void> {
  const unique = [...new Set(processes)];
  await Promise.allSettled(
    unique.map(child => {
      let timer: NodeJS.Timeout | undefined;
      return Promise.race([
        Promise.allSettled([
          child.stop(),
          child.completion.catch(() => CANCELLED_EXIT_CODE),
        ]).then(() => undefined),
        new Promise<void>(resolve => {
          timer = setTimeout(resolve, PROCESS_DRAIN_TIMEOUT_MS);
        }),
      ]).finally(() => {
        if (timer) clearTimeout(timer);
      });
    }),
  );
}
