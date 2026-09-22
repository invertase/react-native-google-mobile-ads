#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  runSlotProvisioning,
  type ProvisionCommand,
} from '../src/provision.ts';

function output(bin: string, args: string[]): string {
  return execFileSync(bin, args, { encoding: 'utf8' });
}

function execute(command: ProvisionCommand): void {
  execFileSync(command.bin, command.args, {
    input: command.input,
    stdio: command.input == null ? 'inherit' : ['pipe', 'inherit', 'inherit'],
  });
}

function androidInventory(): string[] {
  return output('emulator', ['-list-avds'])
    .split(/\r?\n/)
    .map(value => value.trim())
    .filter(Boolean)
    .sort();
}

function iosInventoryNames(inventoryJson: string): string[] {
  const inventory = JSON.parse(inventoryJson) as {
    devices?: Record<string, Array<{ name?: string; udid?: string; isAvailable?: boolean }>>;
  };
  return Object.entries(inventory.devices ?? {})
    .flatMap(([runtime, devices]) =>
      devices
        .filter(device => device.isAvailable !== false && device.name && device.udid)
        .map(device => `${device.name}|${device.udid}|${runtime}`),
    )
    .sort();
}

function main(): void {
  const outcome = runSlotProvisioning({
    target: process.argv[2],
    env: process.env,
    architecture: process.arch,
    host: {
      listAndroidAvds() {
        const avdNames = androidInventory();
        console.log(`Android AVD inventory before: ${JSON.stringify(avdNames)}`);
        return avdNames;
      },
      listInstalledPackages() {
        return output('sdkmanager', ['--list_installed'])
          .split(/\r?\n/)
          .map(line => line.split('|')[0]?.trim() ?? '')
          .filter(Boolean);
      },
      listIosInventory() {
        const inventory = output('xcrun', ['simctl', 'list', '--json']);
        console.log(
          `iOS simulator inventory before: ${JSON.stringify(iosInventoryNames(inventory))}`,
        );
        return inventory;
      },
      run: execute,
    },
  });
  if (outcome.android) {
    console.log(
      outcome.android.reused
        ? `Reusing existing Android AVD ${outcome.android.name}.`
        : `Created Android AVD ${outcome.android.name}.`,
    );
    console.log(`Android AVD inventory after: ${JSON.stringify(androidInventory())}`);
  }
  if (outcome.ios) {
    console.log(
      outcome.ios.reused
        ? `Reusing existing iOS simulator ${outcome.ios.name}.`
        : `Created iOS simulator ${outcome.ios.name}.`,
    );
    console.log(
      `iOS simulator inventory after: ${JSON.stringify(
        iosInventoryNames(output('xcrun', ['simctl', 'list', '--json'])),
      )}`,
    );
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
