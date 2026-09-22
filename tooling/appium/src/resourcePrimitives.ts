import {
  assertRngmaSlotAllowed,
  parseSlot,
  SERIAL_APPIUM_PORT,
  SERIAL_METRO_PORT,
  slotResources,
} from './slots.ts';

export const OPERATIONAL_SLOTS = [1, 2, 4, 5, 6, 7] as const;
export const SERIAL_ANDROID_SERIAL = 'emulator-5554';
export const SERIAL_ANDROID_AVD = 'TestingAVD';
export const SERIAL_IOS_SIMULATOR = 'iPhone 17';
export const EXAMPLE_ANDROID_PACKAGE = 'com.microsoft.reacttestapp';
export const EXAMPLE_IOS_BUNDLE_ID = 'com.microsoft.ReactTestApp';

export type ResourcePlatform = 'android' | 'ios';
export type ResourceCategory =
  | 'metro'
  | 'appium'
  | 'android-apps'
  | 'android-emulator'
  | 'ios-sims';

export type ResourceTarget = {
  slot?: number;
  platform: ResourcePlatform;
  metroPort: number;
  appiumPort: number;
  automationPort: number;
  mjpegPort: number;
  androidConsolePort?: number;
  androidSerial?: string;
  androidAvdName?: string;
  iosSimulatorName?: string;
};

export type ResourceOptions = {
  targets: ResourceTarget[];
  services: boolean;
  devices: boolean;
  only?: ReadonlySet<ResourceCategory>;
};

export class ResourceArgumentError extends Error {}

const KNOWN_CATEGORIES = new Set<ResourceCategory>([
  'metro',
  'appium',
  'android-apps',
  'android-emulator',
  'ios-sims',
]);

function parsePlatform(value: string | undefined): ResourcePlatform | undefined {
  if (value == null || value === '') return undefined;
  if (value !== 'android' && value !== 'ios') {
    throw new ResourceArgumentError(
      `platform must be android or ios; received "${value}".`,
    );
  }
  return value;
}

function serialTarget(platform: ResourcePlatform): ResourceTarget {
  if (platform === 'android') {
    return {
      platform,
      metroPort: SERIAL_METRO_PORT,
      appiumPort: SERIAL_APPIUM_PORT,
      automationPort: 8200,
      mjpegPort: 7810,
      androidConsolePort: 5554,
      androidSerial: SERIAL_ANDROID_SERIAL,
      androidAvdName: SERIAL_ANDROID_AVD,
    };
  }
  return {
    platform,
    metroPort: SERIAL_METRO_PORT,
    appiumPort: SERIAL_APPIUM_PORT,
    automationPort: 8100,
    mjpegPort: 9100,
    iosSimulatorName: SERIAL_IOS_SIMULATOR,
  };
}

function slottedTarget(slot: number, platform: ResourcePlatform): ResourceTarget {
  assertRngmaSlotAllowed(slot);
  const resources = slotResources(slot, platform);
  return {
    slot,
    platform,
    metroPort: resources.metroPort,
    appiumPort: resources.appiumPort,
    automationPort: resources.automationPort,
    mjpegPort: resources.mjpegPort,
    ...(platform === 'android'
      ? {
          androidConsolePort: resources.androidConsolePort,
          androidSerial: resources.androidSerial,
          androidAvdName: resources.androidAvdName,
        }
      : { iosSimulatorName: resources.iosSimulatorName }),
  };
}

function parseOnly(value: string): ReadonlySet<ResourceCategory> {
  if (!value) {
    throw new ResourceArgumentError('--only requires at least one category.');
  }
  const categories = value.split(',');
  for (const category of categories) {
    if (!KNOWN_CATEGORIES.has(category as ResourceCategory)) {
      throw new ResourceArgumentError(
        `unknown --only category "${category}"; known categories: ${[...KNOWN_CATEGORIES].join(', ')}`,
      );
    }
  }
  return new Set(categories as ResourceCategory[]);
}

export function parseResourceOptions(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  mode: 'check' | 'release',
): ResourceOptions {
  let slotValue: string | undefined;
  let slotFlag = false;
  let allSlots = false;
  let platformFlag: string | undefined;
  let services = false;
  let devices = false;
  let only: ReadonlySet<ResourceCategory> | undefined;

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;
    if (argument.startsWith('--slot=')) {
      slotFlag = true;
      slotValue = argument.slice('--slot='.length);
    } else if (argument === '--all-slots') {
      allSlots = true;
    } else if (argument.startsWith('--platform=')) {
      platformFlag = argument.slice('--platform='.length);
    } else if (mode === 'check' && (argument === '--services' || argument === '--strict')) {
      services = true;
    } else if (mode === 'release' && argument === '--devices') {
      devices = true;
    } else if (mode === 'release' && argument === '--only') {
      const value = argv[index + 1];
      if (value == null) throw new ResourceArgumentError('--only requires a value.');
      only = parseOnly(value);
      index++;
    } else if (mode === 'release' && argument.startsWith('--only=')) {
      only = parseOnly(argument.slice('--only='.length));
    } else {
      throw new ResourceArgumentError(`unknown argument "${argument}".`);
    }
  }

  if (slotFlag && allSlots) {
    throw new ResourceArgumentError('--slot and --all-slots are mutually exclusive.');
  }
  if (slotFlag && !slotValue) {
    throw new ResourceArgumentError('--slot requires an integer from 0 to 7.');
  }
  if (slotFlag && env.RNGMA_E2E_SLOT && env.RNGMA_E2E_SLOT !== slotValue) {
    throw new ResourceArgumentError(
      `--slot=${slotValue} conflicts with RNGMA_E2E_SLOT=${env.RNGMA_E2E_SLOT}.`,
    );
  }
  const selectedSlotValue = slotFlag ? slotValue : env.RNGMA_E2E_SLOT;
  if (allSlots && selectedSlotValue) {
    throw new ResourceArgumentError('--all-slots conflicts with RNGMA_E2E_SLOT.');
  }

  const cliPlatform = parsePlatform(platformFlag);
  const envPlatform = parsePlatform(env.RNGMA_E2E_PLATFORM);
  if (cliPlatform && envPlatform && cliPlatform !== envPlatform) {
    throw new ResourceArgumentError(
      `--platform=${cliPlatform} conflicts with RNGMA_E2E_PLATFORM=${envPlatform}.`,
    );
  }
  const selectedPlatform = cliPlatform ?? envPlatform;
  const platforms: ResourcePlatform[] = selectedPlatform
    ? [selectedPlatform]
    : ['android', 'ios'];

  let slots: Array<number | undefined>;
  if (allSlots) {
    slots = [undefined, ...OPERATIONAL_SLOTS];
  } else if (selectedSlotValue != null && selectedSlotValue !== '') {
    try {
      const slot = parseSlot(selectedSlotValue)!;
      assertRngmaSlotAllowed(slot);
      slots = [slot];
    } catch (error) {
      throw new ResourceArgumentError(
        error instanceof Error ? error.message : String(error),
      );
    }
  } else {
    slots = [undefined];
  }

  return {
    targets: slots.flatMap(slot =>
      platforms.map(platform =>
        slot == null ? serialTarget(platform) : slottedTarget(slot, platform),
      ),
    ),
    services,
    devices,
    only,
  };
}

export type ResourceInventory = {
  listeners: ReadonlyMap<number, readonly number[]>;
  androidDevices: readonly { serial: string; avdName: string }[];
  androidApps: ReadonlySet<string>;
  iosSimulators: readonly { name: string; udid: string; state: string }[];
  iosApps: ReadonlySet<string>;
};

export type ResourceFinding = {
  state: 'CLEAR' | 'INFO' | 'BUSY';
  kind: 'port' | 'android-app' | 'android-device' | 'ios-app' | 'ios-device';
  detail: string;
  target: ResourceTarget;
  port?: number;
  pids?: readonly number[];
};

function portFindings(
  target: ResourceTarget,
  inventory: ResourceInventory,
  services: boolean,
): ResourceFinding[] {
  const ports = [
    ['metro', target.metroPort, services],
    ['appium', target.appiumPort, true],
    ['automation', target.automationPort, true],
    ['mjpeg', target.mjpegPort, true],
    ...(target.androidConsolePort == null
      ? []
      : [['console', target.androidConsolePort, services] as const]),
  ] as const;
  return ports.map(([label, port, strict]) => {
    const pids = inventory.listeners.get(port) ?? [];
    const state = pids.length === 0 ? 'CLEAR' : strict ? 'BUSY' : 'INFO';
    return {
      state,
      kind: 'port',
      detail: `port :${port} (${label})${pids.length ? ` pids=${pids.join(',')}` : ''}`,
      target,
      port,
      pids,
    };
  });
}

function key(first: string, second: string): string {
  return `${first}\0${second}`;
}

export function classifyResources(
  options: Pick<ResourceOptions, 'targets' | 'services'>,
  inventory: ResourceInventory,
): ResourceFinding[] {
  const findings: ResourceFinding[] = [];
  for (const target of options.targets) {
    findings.push(...portFindings(target, inventory, options.services));
    if (target.platform === 'android') {
      const booted = inventory.androidDevices.some(
        device =>
          device.serial === target.androidSerial &&
          device.avdName === target.androidAvdName,
      );
      const appRunning = inventory.androidApps.has(
        key(target.androidSerial!, EXAMPLE_ANDROID_PACKAGE),
      ) && booted;
      findings.push({
        state: appRunning ? 'BUSY' : 'CLEAR',
        kind: 'android-app',
        detail: `android app ${EXAMPLE_ANDROID_PACKAGE} on ${target.androidSerial}`,
        target,
      });
      findings.push({
        state: booted ? 'BUSY' : 'CLEAR',
        kind: 'android-device',
        detail: `android device ${target.androidAvdName} (${target.androidSerial})`,
        target,
      });
    } else {
      const exactBooted = inventory.iosSimulators.filter(
        simulator =>
          simulator.name === target.iosSimulatorName &&
          simulator.state === 'Booted',
      );
      const appRunning = exactBooted.some(simulator =>
        inventory.iosApps.has(key(simulator.udid, EXAMPLE_IOS_BUNDLE_ID)),
      );
      findings.push({
        state: appRunning ? 'BUSY' : 'CLEAR',
        kind: 'ios-app',
        detail: `ios app ${EXAMPLE_IOS_BUNDLE_ID} on ${target.iosSimulatorName}`,
        target,
      });
      findings.push({
        state: exactBooted.length ? 'BUSY' : 'CLEAR',
        kind: 'ios-device',
        detail: `ios simulator ${target.iosSimulatorName}`,
        target,
      });
    }
  }
  return findings;
}

export function isBusy(findings: readonly ResourceFinding[]): boolean {
  return findings.some(finding => finding.state === 'BUSY');
}

export function categoryWanted(
  options: Pick<ResourceOptions, 'only' | 'devices'>,
  category: ResourceCategory,
): boolean {
  if (options.only) return options.only.has(category);
  if (category === 'android-emulator' || category === 'ios-sims') {
    return options.devices;
  }
  return true;
}

export function resourceKey(first: string, second: string): string {
  return key(first, second);
}
