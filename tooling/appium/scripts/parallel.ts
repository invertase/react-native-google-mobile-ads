#!/usr/bin/env node
import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync, promises as fs } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
import type { ParallelPlatform } from '../src/parallelPlan.ts';
import {
  armAbortSignals,
  stopChildProcessTree,
} from '../src/ownedProcess.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isListening(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

function portIsFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close(error => resolve(error == null));
    });
  });
}

class NodeRunningCommand implements RunningCommand {
  readonly completion: Promise<number>;
  private stopping?: Promise<void>;
  private readonly lineListeners = new Set<(line: string) => void>();
  private stdoutRemainder = '';
  private stderrRemainder = '';

  constructor(
    private readonly child: ChildProcess,
    command: ChildCommand,
  ) {
    const log = command.logPath ? createWriteStream(command.logPath, { flags: 'wx' }) : undefined;
    const emitLines = (stream: 'stdout' | 'stderr', chunk: Buffer | string) => {
      const complete = `${
        stream === 'stdout' ? this.stdoutRemainder : this.stderrRemainder
      }${String(chunk)}`.split(/\r?\n/);
      const remainder = complete.pop() ?? '';
      if (stream === 'stdout') this.stdoutRemainder = remainder;
      else this.stderrRemainder = remainder;
      for (const line of complete) {
        for (const listener of this.lineListeners) listener(line);
      }
    };
    child.stdout?.on('data', chunk => {
      process.stdout.write(chunk);
      log?.write(chunk);
      emitLines('stdout', chunk);
    });
    child.stderr?.on('data', chunk => {
      process.stderr.write(chunk);
      log?.write(chunk);
      emitLines('stderr', chunk);
    });
    this.completion = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => {
        const exitCode = childSlotExitCode(code, signal);
        if (log) log.end(() => resolve(exitCode));
        else resolve(exitCode);
      });
    });
  }

  onLine(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener);
    return () => this.lineListeners.delete(listener);
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = stopChildProcessTree(this.child);
    return this.stopping;
  }
}

export class NodeParallelRunner implements ParallelRunner {
  async assertPortsFree(ports: number[]): Promise<void> {
    for (const port of ports) {
      if (!(await portIsFree(port))) {
        throw new Error(
          `Required parallel port 127.0.0.1:${port} is occupied; no mutation was started.`,
        );
      }
    }
  }

  async assertPortListening(port: number): Promise<void> {
    if (!(await isListening(port))) {
      throw new Error(
        `External worktree Metro 127.0.0.1:${port} is not listening; consumer parents never start it.`,
      );
    }
  }

  start(command: ChildCommand): RunningCommand {
    const bin = command.bin ?? 'yarn';
    const args = command.bin ? command.args ?? [] : [command.script, ...(command.args ?? [])];
    console.log(
      `[parallel] starting ${command.role}: ${bin} ${args.join(' ')}`.trim(),
    );
    if (command.logPath) mkdirSync(path.dirname(command.logPath), { recursive: true });
    const child = spawn(bin, args, {
      cwd: repoRoot,
      env: command.env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return new NodeRunningCommand(child, command);
  }

  monitorPort(port: number): RunningCommand {
    let stopped = false;
    let resolve!: (code: number) => void;
    const completion = new Promise<number>(done => {
      resolve = done;
    });
    void (async () => {
      while (!stopped) {
        if (!(await isListening(port))) {
          resolve(1);
          return;
        }
        await delay(250);
      }
      resolve(CANCELLED_EXIT_CODE);
    })();
    return {
      completion,
      stop: async () => {
        stopped = true;
      },
      onLine: () => () => undefined,
    };
  }

  async waitForPort(
    port: number,
    owner: RunningCommand,
    signal: AbortSignal,
  ): Promise<void> {
    let ownerExit: number | undefined;
    void owner.completion.then(
      code => {
        ownerExit = code;
      },
      () => {
        ownerExit = UNKNOWN_FAILURE_EXIT_CODE;
      },
    );
    while (!signal.aborted) {
      if (ownerExit != null) {
        throw new Error(`Packager exited with code ${ownerExit} before port ${port} opened.`);
      }
      if (await isListening(port)) return;
      await delay(100);
    }
  }

  async freshEnvFile(file: string): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.rm(file, { force: true });
    await fs.writeFile(file, '', { flag: 'wx' });
  }

  async readEnvFile(file: string): Promise<Record<string, string>> {
    const values: Record<string, string> = {};
    for (const line of (await fs.readFile(file, 'utf8')).split(/\r?\n/)) {
      if (!line) continue;
      const match = /^(RNGMA_IOS_UDID|RNGMA_IOS_VERSION)=(.+)$/.exec(line);
      if (!match) throw new Error(`Unexpected selector environment line in ${file}.`);
      values[match[1]!] = match[2]!;
    }
    if (!values.RNGMA_IOS_UDID || !values.RNGMA_IOS_VERSION) {
      throw new Error(`Selector did not persist a complete environment in ${file}.`);
    }
    return values;
  }

  async copyFile(source: string, destination: string): Promise<void> {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
    console.log(`[parallel] copied Android APK ${source} -> ${destination}`);
  }

  async installIosApp(udid: string, appPath: string): Promise<void> {
    console.log(`[parallel] installing iOS app on ${udid}: ${appPath}`);
    await new Promise<void>((resolve, reject) => {
      const boot = spawn('xcrun', ['simctl', 'boot', udid], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      boot.once('error', reject);
      boot.once('close', () => {
        // Already-Booted is a non-zero exit; continue to bootstatus either way.
        const status = spawn('xcrun', ['simctl', 'bootstatus', udid, '-b'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let statusErr = '';
        status.stderr?.on('data', chunk => {
          statusErr += String(chunk);
        });
        status.once('error', reject);
        status.once('close', (statusCode, statusSignal) => {
          if (statusSignal || statusCode !== 0) {
            reject(
              new Error(
                `simctl bootstatus ${udid} failed${statusErr ? `: ${statusErr.trim()}` : ''}`,
              ),
            );
            return;
          }
          const child = spawn('xcrun', ['simctl', 'install', udid, appPath], {
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stderr = '';
          child.stderr?.on('data', chunk => {
            stderr += String(chunk);
          });
          child.once('error', reject);
          child.once('close', (code, signal) => {
            if (signal) {
              reject(new Error(`simctl install ${udid} terminated by ${signal}`));
              return;
            }
            if (code !== 0) {
              reject(
                new Error(
                  `simctl install ${udid} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
                ),
              );
              return;
            }
            resolve();
          });
        });
      });
    });
    console.log(`[parallel] installed iOS app on ${udid}`);
  }
}

function printSummary(summary: {
  platform: ParallelPlatform;
  totalTests: number;
  slots: Array<{
    slot: number;
    spec: string;
    testCount: number;
    logPath: string;
    status: string;
    exitCode: number;
  }>;
  invocationId?: string;
  logRoot?: string;
}): void {
  console.log(
    `[parallel-summary] platform=${summary.platform} total=${summary.totalTests} invocation=${summary.invocationId ?? 'unknown'} logRoot=${summary.logRoot ?? 'unknown'}`,
  );
  for (const result of summary.slots) {
    console.log(
      `[parallel-summary] slot=${result.slot} spec=${result.spec} tests=${result.testCount} status=${result.status} exitCode=${result.exitCode} log=${result.logPath}`,
    );
  }
}

function main(): void {
  const platform = process.argv[2] as ParallelPlatform | 'both' | undefined;
  const metroArgument = process.argv[3] ?? '--metro=owner';
  if (
    (platform !== 'android' && platform !== 'ios' && platform !== 'both') ||
    (metroArgument !== '--metro=owner' && metroArgument !== '--metro=external') ||
    (platform === 'both' && metroArgument !== '--metro=owner') ||
    process.argv.length > 4
  ) {
    console.error('Usage: parallel.ts <android|ios> [--metro=owner|--metro=external] | both');
    process.exit(1);
  }
  const metroMode = metroArgument.slice('--metro='.length) as 'owner' | 'external';

  const controller = new AbortController();
  const runner = new NodeParallelRunner();
  const disarm = armAbortSignals(controller);

  const run =
    platform === 'both'
      ? runCombinedParallelE2e(runner, { signal: controller.signal })
      : runParallelE2e(platform, runner, { signal: controller.signal, metroMode });

  void run
    .then(summary => {
      if ('android' in summary) {
        printSummary(summary.android);
        printSummary(summary.ios);
      } else {
        printSummary(summary);
      }
    })
    .catch(error => {
      const summary = (
        error as {
          summary?: Parameters<typeof printSummary>[0] | CombinedParallelRunSummary;
        }
      ).summary;
      if (summary) {
        if ('android' in summary) {
          printSummary(summary.android);
          printSummary(summary.ios);
        } else {
          printSummary(summary);
        }
      }
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(disarm);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main();
}
