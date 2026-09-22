#!/usr/bin/env node
import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, promises as fs } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  childSlotExitCode,
  runCombinedParallelE2e,
  runParallelE2e,
  type ChildCommand,
  type CombinedParallelRunSummary,
  type ParallelRunner,
  type RunningCommand,
} from '../src/parallelOrchestrator.ts';
import type { ParallelPlatform } from '../src/parallelPlan.ts';

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

  constructor(
    private readonly child: ChildProcess,
    command: ChildCommand,
  ) {
    const log = command.logPath ? createWriteStream(command.logPath, { flags: 'w' }) : undefined;
    child.stdout?.on('data', chunk => {
      process.stdout.write(chunk);
      log?.write(chunk);
    });
    child.stderr?.on('data', chunk => {
      process.stderr.write(chunk);
      log?.write(chunk);
    });
    this.completion = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        log?.end();
        resolve(childSlotExitCode(code, signal));
      });
    });
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = new Promise(resolve => {
      if (this.child.exitCode != null || this.child.signalCode != null || !this.child.pid) {
        resolve();
        return;
      }
      const pid = this.child.pid;
      const killGroup = (signal: NodeJS.Signals) => {
        try {
          process.kill(-pid, signal);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
        }
      };
      killGroup('SIGTERM');
      const timer = setTimeout(() => {
        killGroup('SIGKILL');
      }, 5_000);
      this.child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    return this.stopping;
  }
}

class NodeParallelRunner implements ParallelRunner {
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
    console.log(
      `[parallel] starting ${command.role}: yarn ${command.script} ${(command.args ?? []).join(' ')}`.trim(),
    );
    const child = spawn('yarn', [command.script, ...(command.args ?? [])], {
      cwd: repoRoot,
      env: command.env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return new NodeRunningCommand(child, command);
  }

  async waitForPort(port: number, owner: RunningCommand): Promise<void> {
    let ownerExit: number | undefined;
    void owner.completion.then(code => {
      ownerExit = code;
    });
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (ownerExit != null) {
        throw new Error(`Packager exited with code ${ownerExit} before port ${port} opened.`);
      }
      if (await isListening(port)) return;
      await delay(100);
    }
    throw new Error(`Timed out waiting for task-owned Metro port ${port}.`);
  }

  async freshEnvFile(file: string): Promise<void> {
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
}): void {
  console.log(`[parallel-summary] platform=${summary.platform} total=${summary.totalTests}`);
  for (const result of summary.slots) {
    console.log(
      `[parallel-summary] slot=${result.slot} spec=${result.spec} tests=${result.testCount} status=${result.status} exitCode=${result.exitCode} log=${result.logPath}`,
    );
  }
}

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
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    controller.abort();
  });
}

const run =
  platform === 'both'
    ? runCombinedParallelE2e(runner, { signal: controller.signal })
    : runParallelE2e(platform, runner, { signal: controller.signal, metroMode });

run
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
  });
