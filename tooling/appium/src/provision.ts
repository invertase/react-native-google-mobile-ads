import { assertRngmaSlotAllowed, requireRngmaSlot, slotResources } from './slots.ts';

export type ProvisionPlatform = 'android' | 'ios';
export type ProvisionCommand = {
  bin: string;
  args: string[];
  input?: string;
};

const ANDROID_SYSTEM_IMAGE_PREFIX = 'system-images;android-36;google_apis';
export const IOS_DEVICE_TYPE_NAME = 'iPhone 17';

export function androidSystemImage(architecture: string): string {
  const abi =
    architecture === 'arm64'
      ? 'arm64-v8a'
      : architecture === 'x64'
        ? 'x86_64'
        : undefined;
  if (!abi) {
    throw new Error(
      `Unsupported host architecture "${architecture}" for Android slot provisioning; supported architectures: arm64, x64.`,
    );
  }
  return `${ANDROID_SYSTEM_IMAGE_PREFIX};${abi}`;
}

export function parseProvisionPlatforms(
  value: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ProvisionPlatform[] {
  if (value !== 'android' && value !== 'ios' && value !== 'both') {
    throw new Error(
      'Usage: RNGMA_E2E_SLOT=<1|2|4-7> yarn tests:appium:provision <android|ios|both>',
    );
  }
  const platform = env.RNGMA_E2E_PLATFORM;
  if (platform && platform !== 'android' && platform !== 'ios') {
    throw new Error(
      `RNGMA_E2E_PLATFORM must be android or ios; received "${platform}".`,
    );
  }
  if (value === 'both' && platform) {
    throw new Error(
      'Provisioning both platforms requires RNGMA_E2E_PLATFORM to be unset.',
    );
  }
  if (value !== 'both' && platform && platform !== value) {
    throw new Error(
      `RNGMA_E2E_PLATFORM=${platform} conflicts with provisioning ${value}.`,
    );
  }
  return value === 'both' ? ['android', 'ios'] : [value];
}

export function androidProvisionCommands(options: {
  slot: number;
  architecture: string;
  avdNames: string[];
  installedPackages: string[];
}): ProvisionCommand[] {
  assertRngmaSlotAllowed(options.slot);
  const systemImage = androidSystemImage(options.architecture);
  const name = slotResources(options.slot, 'android').androidAvdName;
  if (options.avdNames.includes(name)) {
    return [];
  }
  const commands: ProvisionCommand[] = [];
  if (!options.installedPackages.includes(systemImage)) {
    commands.push({
      bin: 'sdkmanager',
      args: [systemImage],
    });
  }
  commands.push({
    bin: 'avdmanager',
    args: [
      'create',
      'avd',
      '--name',
      name,
      '--package',
      systemImage,
      '--device',
      'pixel_9',
    ],
    input: 'no\n',
  });
  return commands;
}

type SimctlInventory = {
  devices?: Record<string, Array<{ name?: string; isAvailable?: boolean }>>;
  devicetypes?: Array<{ name?: string; identifier?: string }>;
  runtimes?: Array<{
    identifier?: string;
    version?: string;
    platform?: string;
    isAvailable?: boolean;
  }>;
};

function compareVersionsDescending(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

export function iosProvisionCommands(slot: number, inventoryJson: string): ProvisionCommand[] {
  assertRngmaSlotAllowed(slot);
  const name = slotResources(slot, 'ios').iosSimulatorName;
  const inventory = JSON.parse(inventoryJson) as SimctlInventory;
  const exists = Object.values(inventory.devices ?? {})
    .flat()
    .some(device => device.name === name && device.isAvailable !== false);
  if (exists) {
    return [];
  }
  const deviceType = inventory.devicetypes?.find(type => type.name === IOS_DEVICE_TYPE_NAME);
  if (!deviceType?.identifier) {
    throw new Error(`No exact ${IOS_DEVICE_TYPE_NAME} simulator device type is available.`);
  }
  const runtime = (inventory.runtimes ?? [])
    .filter(
      candidate =>
        candidate.platform === 'iOS' &&
        candidate.isAvailable !== false &&
        candidate.identifier &&
        candidate.version,
    )
    .sort((a, b) => compareVersionsDescending(a.version!, b.version!))[0];
  if (!runtime?.identifier) {
    throw new Error('No available iOS simulator runtime is installed.');
  }
  return [
    {
      bin: 'xcrun',
      args: ['simctl', 'create', name, deviceType.identifier, runtime.identifier],
    },
  ];
}

export function assertCreateOnly(commands: ProvisionCommand[]): void {
  const forbidden = /\b(delete|erase|remove|rename)\b/i;
  for (const command of commands) {
    const rendered = [command.bin, ...command.args].join(' ');
    if (forbidden.test(rendered)) {
      throw new Error(`Provisioning command is not create-only: ${rendered}`);
    }
  }
}

export function executeCreateOnly(
  commands: ProvisionCommand[],
  executor: (command: ProvisionCommand) => void,
): void {
  assertCreateOnly(commands);
  commands.forEach(executor);
}

export type ProvisionHost = {
  listAndroidAvds(): string[];
  listInstalledPackages(): string[];
  listIosInventory(): string;
  run(command: ProvisionCommand): void;
};

export type ProvisionOutcome = {
  android?: { name: string; reused: boolean };
  ios?: { name: string; reused: boolean };
};

export function runSlotProvisioning(options: {
  target: string | undefined;
  env: NodeJS.ProcessEnv;
  architecture: string;
  host: ProvisionHost;
}): ProvisionOutcome {
  const platforms = parseProvisionPlatforms(options.target, options.env);
  const slot = requireRngmaSlot(options.env.RNGMA_E2E_SLOT);
  if (platforms.includes('android')) {
    androidSystemImage(options.architecture);
  }

  const outcome: ProvisionOutcome = {};
  if (platforms.includes('android')) {
    const name = slotResources(slot, 'android').androidAvdName;
    const avdNames = options.host.listAndroidAvds();
    const installedPackages = avdNames.includes(name)
      ? []
      : options.host.listInstalledPackages();
    const commands = androidProvisionCommands({
      slot,
      architecture: options.architecture,
      avdNames,
      installedPackages,
    });
    executeCreateOnly(commands, options.host.run);
    outcome.android = { name, reused: commands.length === 0 };
  }
  if (platforms.includes('ios')) {
    const name = slotResources(slot, 'ios').iosSimulatorName;
    const inventory = options.host.listIosInventory();
    const commands = iosProvisionCommands(slot, inventory);
    executeCreateOnly(commands, options.host.run);
    outcome.ios = { name, reused: commands.length === 0 };
  }
  return outcome;
}
