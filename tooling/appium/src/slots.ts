import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_SLOT = 0;
export const MAX_SLOT = 7;
export const RNGMA_RESERVED_SLOT = 3;
export const SERIAL_METRO_PORT = 8081;
export const SERIAL_APPIUM_PORT = 4725;

export type SlotPlatform = 'android' | 'ios' | 'macos';

const PLATFORM_OFFSETS: Record<SlotPlatform, number> = {
  android: 0,
  ios: 100,
  macos: 200,
};

export type SlotResources = {
  slot: number;
  platform: SlotPlatform;
  basePort: number;
  metroPort: number;
  appiumPort: number;
  automationPort: number;
  mjpegPort: number;
  androidConsolePort: number;
  androidSerial: string;
  androidAvdName: string;
  iosSimulatorName: string;
};

export function parseSlot(value: string | undefined): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `RNGMA_E2E_SLOT must be an integer from ${MIN_SLOT} to ${MAX_SLOT}; received "${value}".`,
    );
  }
  const slot = Number(value);
  if (slot < MIN_SLOT || slot > MAX_SLOT) {
    throw new Error(
      `RNGMA_E2E_SLOT must be an integer from ${MIN_SLOT} to ${MAX_SLOT}; received "${value}".`,
    );
  }
  return slot;
}

/** Generic slot math intentionally supports all slots, including RNFB's slot 3. */
export function slotResources(slot: number, platform: SlotPlatform): SlotResources {
  if (!Number.isInteger(slot) || slot < MIN_SLOT || slot > MAX_SLOT) {
    throw new Error(`slot must be an integer from ${MIN_SLOT} to ${MAX_SLOT}; received "${slot}".`);
  }
  const basePort = 12000 + slot * 1000 + PLATFORM_OFFSETS[platform];
  const androidConsolePort = 5556 + 2 * slot;
  return {
    slot,
    platform,
    basePort,
    metroPort: basePort + 7,
    appiumPort: basePort + 13,
    automationPort: basePort + 14,
    mjpegPort: basePort + 15,
    androidConsolePort,
    androidSerial: `emulator-${androidConsolePort}`,
    androidAvdName: `TestingAVD-${slot}`,
    iosSimulatorName: `RN E2E iOS slot-${slot}`,
  };
}

export function requireRngmaSlot(value: string | undefined): number {
  const slot = parseSlot(value);
  if (slot == null) {
    throw new Error(
      'RNGMA_E2E_SLOT is required. Choose an RNGMA slot (1, 2, or 4-7); serial devices are never provisioned.',
    );
  }
  assertRngmaSlotAllowed(slot);
  return slot;
}

export function assertRngmaSlotAllowed(slot: number): void {
  if (slot === RNGMA_RESERVED_SLOT) {
    throw new Error(
      'RNGMA_E2E_SLOT=3 is reserved for RNFB and cannot be provisioned, selected, or run by RNGMA.',
    );
  }
  if (slot === 0) {
    throw new Error(
      'RNGMA_E2E_SLOT=0 is library-supported but not an operational RNGMA slot; choose 1, 2, or 4-7.',
    );
  }
}

function parsePort(name: string, value: string | undefined, fallback: number): number {
  if (value == null || value === '') {
    return fallback;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer from 1 to 65535; received "${value}".`);
  }
  return port;
}

export type RuntimeResources = {
  slot?: number;
  metroPort: number;
  appiumPort: number;
  androidApkPath: string;
  slotResources?: SlotResources;
};

export function iosMetroProcessArguments(
  runtime: RuntimeResources,
): Record<string, { args: string[]; env: Record<string, string> }> {
  if (runtime.slot == null) {
    return {};
  }
  return {
    'appium:processArguments': {
      args: ['-RCT_jsLocation', `localhost:${runtime.metroPort}`],
      env: { RCT_METRO_PORT: String(runtime.metroPort) },
    },
  };
}

export function platformForSharedConfig(
  env: NodeJS.ProcessEnv = process.env,
): Exclude<SlotPlatform, 'macos'> {
  const value = env.RNGMA_E2E_PLATFORM;
  if (value === 'android' || value === 'ios') {
    return value;
  }
  if (env.RNGMA_E2E_SLOT != null && env.RNGMA_E2E_SLOT !== '') {
    throw new Error(
      'RNGMA_E2E_PLATFORM must be android or ios when RNGMA_E2E_SLOT selects shared WDIO ports.',
    );
  }
  return 'android';
}

export function runtimeResources(
  platform: Exclude<SlotPlatform, 'macos'>,
  env: NodeJS.ProcessEnv = process.env,
): RuntimeResources {
  const slot = parseSlot(env.RNGMA_E2E_SLOT);
  if (slot == null) {
    return {
      metroPort: parsePort('RNGMA_METRO_PORT', env.RNGMA_METRO_PORT, SERIAL_METRO_PORT),
      appiumPort: parsePort('RNGMA_APPIUM_PORT', env.RNGMA_APPIUM_PORT, SERIAL_APPIUM_PORT),
      androidApkPath: serialAndroidApkPath(),
    };
  }
  if (
    env.RNGMA_E2E_PLATFORM &&
    env.RNGMA_E2E_PLATFORM !== 'android' &&
    env.RNGMA_E2E_PLATFORM !== 'ios'
  ) {
    throw new Error(
      `RNGMA_E2E_PLATFORM must be android or ios; received "${env.RNGMA_E2E_PLATFORM}".`,
    );
  }
  if (env.RNGMA_E2E_PLATFORM && env.RNGMA_E2E_PLATFORM !== platform) {
    throw new Error(
      `RNGMA_E2E_PLATFORM=${env.RNGMA_E2E_PLATFORM} conflicts with the ${platform} command.`,
    );
  }
  assertRngmaSlotAllowed(slot);
  const resources = slotResources(slot, platform);
  for (const [name, value, expected] of [
    ['RNGMA_METRO_PORT', env.RNGMA_METRO_PORT, resources.metroPort],
    ['RNGMA_APPIUM_PORT', env.RNGMA_APPIUM_PORT, resources.appiumPort],
  ] as const) {
    if (value != null && value !== '' && parsePort(name, value, expected) !== expected) {
      throw new Error(
        `${name}=${value} conflicts with RNGMA_E2E_SLOT=${slot}; expected ${expected}.`,
      );
    }
  }
  return {
    slot,
    metroPort: resources.metroPort,
    appiumPort: resources.appiumPort,
    androidApkPath: slotAndroidApkPath(slot),
    slotResources: resources,
  };
}

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

export function serialAndroidApkPath(): string {
  return path.join(
    repoRoot(),
    'RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/app-debug.apk',
  );
}

export function slotAndroidApkPath(slot: number): string {
  slotResources(slot, 'android');
  return path.join(
    repoRoot(),
    `RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/slots/slot-${slot}/app-debug.apk`,
  );
}

export function slotIosAppPath(slot: number): string {
  slotResources(slot, 'ios');
  return path.join(
    repoRoot(),
    `RNGoogleMobileAdsExample/ios/build/slots/slot-${slot}/ReactTestApp.app`,
  );
}
