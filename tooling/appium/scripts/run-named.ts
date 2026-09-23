#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  androidGradleCommand,
  androidRunCommands,
  iosBuildCommand,
  packagerCommand,
  assertAndroidSlotRunInventory,
  assertIosRunSelection,
  androidSlotBootCommand,
  type NamedCommand,
} from '../src/commands.ts';
import { defaultIosSimulatorAppPath } from '../src/formats.ts';
import { ensureAndroidMetroReverse } from '../src/hostPreflight.ts';
import { isParallelParentChild } from '../src/parentContract.ts';
import {
  runtimeResources,
  serialAndroidApkPath,
  slotIosAppPath,
} from '../src/slots.ts';
import {
  armAbortSignals,
  spawnOwned,
  stopAndDrain,
} from '../src/ownedProcess.ts';
import {
  invocationPaths,
  StartupSupervisor,
  waitForMetroReadiness,
  type InvocationPaths,
} from '../src/startupSupervisor.ts';
import type { RunningCommand } from '../src/parallelOrchestrator.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function execute(command: NamedCommand): void {
  execFileSync(command.bin, command.args, {
    cwd: command.cwd ? path.join(repoRoot, command.cwd) : repoRoot,
    stdio: 'inherit',
    env: command.env ?? process.env,
  });
}

function listening(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

type PackagerOptions = {
  listen?: (port: number) => Promise<boolean>;
  paths?: InvocationPaths;
  signalSource?: Parameters<typeof armAbortSignals>[2];
  spawn?: (
    bin: string,
    args: string[],
    options: { cwd: string; env?: NodeJS.ProcessEnv; logPath: string },
  ) => RunningCommand;
  drain?: typeof stopAndDrain;
};

export async function runPackager(
  resetCache: boolean,
  options: PackagerOptions = {},
): Promise<void> {
  const command = packagerCommand(resetCache);
  const runtime = runtimeResources(
    process.env.RNGMA_E2E_PLATFORM === 'ios' ? 'ios' : 'android',
  );
  const paths = options.paths ?? invocationPaths();
  const drain = options.drain ?? stopAndDrain;
  const owned: RunningCommand[] = [];
  let draining: Promise<void> | undefined;
  const drainOwned = () => {
    draining ??= drain(owned);
    return draining;
  };
  const startup = new StartupSupervisor([]);
  const controller = new AbortController();
  let stopping = false;
  const disarm = armAbortSignals(
    controller,
    signal => {
      stopping = true;
      if (startup.phase === 'metro') {
        startup.recordFailure('Operator stop', new Error(`received ${signal}`));
      }
      void drainOwned();
    },
    options.signalSource,
  );
  let child: RunningCommand;
  try {
    if (controller.signal.aborted) {
      throw new Error('Standalone Metro owner was interrupted before spawn.');
    }
    child = (options.spawn ?? spawnOwned)(command.bin, command.args, {
      cwd: command.cwd ? path.join(repoRoot, command.cwd) : repoRoot,
      env: command.env ?? process.env,
      logPath: paths.metro,
    });
  } catch (error) {
    disarm();
    await drainOwned();
    throw error;
  }
  owned.push(child);
  child.onLine(line => startup.recordLine('metro', line));
  void child.completion.then(
    code => {
      if (!stopping) startup.recordProcessExit('Metro owner', code);
    },
    () => {
      if (!stopping) startup.recordProcessExit('Metro owner', 1);
    },
  );
  startup.onFailure(() => {
    if (!stopping) void drainOwned();
  });
  const waitForTcp = async (signal: AbortSignal) => {
    while (!stopping && !signal.aborted) {
      if (await (options.listen ?? listening)(runtime.metroPort)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Metro TCP readiness was aborted.');
  };
  try {
    await waitForMetroReadiness(startup, waitForTcp);
    console.log(
      `[e2e-startup] invocation=${paths.id} phase=metro-ready log=${paths.metro}`,
    );
    const code = await Promise.race([child.completion, startup.failure]);
    if (!stopping) {
      throw new Error(`Standalone Metro owner exited unexpectedly with code ${code}.`);
    }
  } finally {
    disarm();
    await drainOwned();
  }
}

function output(bin: string, args: string[]): string {
  return execFileSync(bin, args, { encoding: 'utf8' }).trim();
}

function runAndroidBuild(): void {
  execute(androidGradleCommand());
  const runtime = runtimeResources('android');
  if (runtime.slot != null && !isParallelParentChild()) {
    mkdirSync(path.dirname(runtime.androidApkPath), { recursive: true });
    copyFileSync(serialAndroidApkPath(), runtime.androidApkPath);
    console.log(
      `Slot ${runtime.slot} APK baked for Metro ${runtime.metroPort}: ${runtime.androidApkPath}`,
    );
  }
}

function runAndroid(): void {
  const runtime = runtimeResources('android');
  const commands = androidRunCommands();
  if (runtime.slotResources) {
    console.log(
      `Android slot run pinned to ${runtime.slotResources.androidAvdName} (${runtime.slotResources.androidSerial}) with Metro ${runtime.metroPort}; no other device will be installed or launched.`,
    );
    const avdNames = output('emulator', ['-list-avds'])
      .split(/\r?\n/)
      .map(value => value.trim())
      .filter(Boolean);
    const onlineSerials = output('adb', ['devices'])
      .split(/\r?\n/)
      .slice(1)
      .map(line => line.trim().split(/\s+/))
      .filter(parts => parts[0] && parts[1] === 'device')
      .map(parts => parts[0]!);
    const connectedDevices = onlineSerials
      .filter(serial => serial === runtime.slotResources!.androidSerial)
      .map(serial => ({
        serial,
        avdName: output('adb', [
          '-s',
          serial,
          'shell',
          'getprop',
          'ro.boot.qemu.avd_name',
        ]),
      }));
    const state = assertAndroidSlotRunInventory(runtime, avdNames, connectedDevices);
    if (state === 'boot-required') {
      const boot = androidSlotBootCommand()!;
      const emulator = spawn(boot.bin, boot.args, {
        detached: true,
        stdio: 'ignore',
      });
      emulator.unref();
      execFileSync('adb', ['-s', runtime.slotResources.androidSerial, 'wait-for-device'], {
        stdio: 'ignore',
        timeout: 180_000,
      });
      assertAndroidSlotRunInventory(runtime, avdNames, [
        {
          serial: runtime.slotResources.androidSerial,
          avdName: output('adb', [
            '-s',
            runtime.slotResources.androidSerial,
            'shell',
            'getprop',
            'ro.boot.qemu.avd_name',
          ]),
        },
      ]);
    }
    ensureAndroidMetroReverse(
      runtime.slotResources.androidSerial,
      (bin, args) =>
        execFileSync(bin, args, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'inherit'],
          timeout: 10_000,
        }),
      runtime.metroPort,
    );
    console.log(
      `Android device ${runtime.slotResources.androidSerial} reaches this checkout's Metro through tcp:${runtime.metroPort}.`,
    );
  }
  commands.forEach(execute);
}

function runIos(argv: string[]): void {
  const runtime = runtimeResources('ios');
  const inventory =
    runtime.slot == null
      ? undefined
      : output('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
  const udid = assertIosRunSelection(argv, process.env, inventory);
  if (!isParallelParentChild()) {
    execute({ bin: 'yarn', args: ['tests:e2e:codegen'] });
  }
  execute({ bin: 'yarn', args: ['tests:ios:pod:install'] });
  execute(iosBuildCommand());
  execute({ bin: 'node', args: ['./scripts/run-ios-app.js', '--udid', udid] });
  if (runtime.slot != null && isParallelParentChild()) {
    const destination = slotIosAppPath(runtime.slot);
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(defaultIosSimulatorAppPath(), destination, { recursive: true });
    console.log(`Slot ${runtime.slot} iOS app preserved at ${destination}`);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'packager') {
    if (isParallelParentChild()) {
      execute(packagerCommand(process.argv.includes('--reset-cache')));
    } else {
      await runPackager(process.argv.includes('--reset-cache'));
    }
  } else if (command === 'android-build') {
    runAndroidBuild();
  } else if (command === 'android-run') {
    runAndroid();
  } else if (command === 'ios-run') {
    runIos(process.argv.slice(3));
  } else {
    throw new Error(
      'Usage: run-named.ts <packager [--reset-cache]|android-build|android-run|ios-run --udid <udid>>',
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
