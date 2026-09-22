#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  androidProvisionCommands,
  executeCreateOnly,
  iosProvisionCommands,
  parseProvisionPlatforms,
  type ProvisionCommand,
} from '../src/provision.ts';
import { requireRngmaSlot, slotResources } from '../src/slots.ts';

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

function provisionAndroid(slot: number): void {
  const avdNames = androidInventory();
  console.log(`Android AVD inventory before: ${JSON.stringify(avdNames)}`);
  const name = slotResources(slot, 'android').androidAvdName;
  const installedPackages = avdNames.includes(name)
    ? []
    : output('sdkmanager', ['--list_installed'])
        .split(/\r?\n/)
        .map(line => line.split('|')[0]?.trim() ?? '')
        .filter(Boolean);
  const commands = androidProvisionCommands({ slot, avdNames, installedPackages });
  executeCreateOnly(commands, execute);
  console.log(
    commands.length === 0
      ? `Reusing existing Android AVD ${name}.`
      : `Created Android AVD ${name}.`,
  );
  console.log(`Android AVD inventory after: ${JSON.stringify(androidInventory())}`);
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

function provisionIos(slot: number): void {
  const inventory = output('xcrun', ['simctl', 'list', '--json']);
  console.log(`iOS simulator inventory before: ${JSON.stringify(iosInventoryNames(inventory))}`);
  const commands = iosProvisionCommands(slot, inventory);
  executeCreateOnly(commands, execute);
  const name = slotResources(slot, 'ios').iosSimulatorName;
  console.log(
    commands.length === 0
      ? `Reusing existing iOS simulator ${name}.`
      : `Created iOS simulator ${name}.`,
  );
  console.log(
    `iOS simulator inventory after: ${JSON.stringify(
      iosInventoryNames(output('xcrun', ['simctl', 'list', '--json'])),
    )}`,
  );
}

function main(): void {
  const platforms = parseProvisionPlatforms(process.argv[2], process.env);
  const slot = requireRngmaSlot(process.env.RNGMA_E2E_SLOT);
  if (platforms.includes('android')) {
    provisionAndroid(slot);
  }
  if (platforms.includes('ios')) {
    provisionIos(slot);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
