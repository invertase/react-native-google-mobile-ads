#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { runtimeResources, serialAndroidApkPath } from '../src/slots.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function execute(command: NamedCommand): void {
  execFileSync(command.bin, command.args, {
    cwd: command.cwd ? path.join(repoRoot, command.cwd) : repoRoot,
    stdio: 'inherit',
    env: command.env ?? process.env,
  });
}

function output(bin: string, args: string[]): string {
  return execFileSync(bin, args, { encoding: 'utf8' }).trim();
}

function runAndroidBuild(): void {
  execute({ bin: 'yarn', args: ['tests:e2e:codegen'] });
  execute(androidGradleCommand());
  const runtime = runtimeResources('android');
  if (runtime.slot != null) {
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
  }
  execute({ bin: 'yarn', args: ['tests:e2e:codegen'] });
  commands.forEach(execute);
}

function runIos(argv: string[]): void {
  const runtime = runtimeResources('ios');
  const inventory =
    runtime.slot == null
      ? undefined
      : output('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
  const udid = assertIosRunSelection(argv, process.env, inventory);
  execute({ bin: 'yarn', args: ['tests:e2e:codegen'] });
  execute({ bin: 'yarn', args: ['tests:ios:pod:install'] });
  execute(iosBuildCommand());
  execute({ bin: 'node', args: ['./scripts/run-ios-app.js', '--udid', udid] });
}

const command = process.argv[2];
try {
  if (command === 'packager') {
    execute(packagerCommand(process.argv.includes('--reset-cache')));
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
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
