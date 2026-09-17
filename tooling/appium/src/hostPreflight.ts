import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Appium UiAutomator2 requires Android 8.0+ (API 26). */
export const MIN_ANDROID_API = 26;
/** Prefer a current Google APIs image when several AVDs qualify. */
export const PREFERRED_ANDROID_API = 36;
/** Yarn 4 + this repo's Appium/Metro stack is a hard floor on Node 24. Node 22 hard-fails locally. */
export const MIN_NODE_MAJOR = 24;

export function nodeMajor(version: string = process.version): number {
  const match = /^v?(\d+)/.exec(version.trim());
  return match ? Number(match[1]) : 0;
}

export function nodeMeetsMinimum(version?: string): boolean {
  return nodeMajor(version) >= MIN_NODE_MAJOR;
}

/** Parse API level from AVD names like `API36_GAPI`, `Pixel_API_26`, or `android-36`. */
export function parseAvdApi(name: string): number | null {
  const match = /(?:^|[_-])(?:API[_-]?|android-)(\d+)(?:$|[_-])/i.exec(name);
  return match ? Number(match[1]) : null;
}

export function selectAndroidAvd(
  avdNames: string[],
  options?: { minApi?: number; preferApi?: number },
): { name: string; api: number } | null {
  const minApi = options?.minApi ?? MIN_ANDROID_API;
  const preferApi = options?.preferApi ?? PREFERRED_ANDROID_API;
  const candidates = avdNames
    .map(name => {
      const api = parseAvdApi(name);
      return api == null ? null : { name, api };
    })
    .filter((row): row is { name: string; api: number } => row != null && row.api >= minApi);
  if (candidates.length === 0) {
    return null;
  }
  const preferred = candidates.filter(row => row.api === preferApi);
  const pool = preferred.length > 0 ? preferred : candidates;
  pool.sort((a, b) => b.api - a.api || a.name.localeCompare(b.name));
  return pool[0] ?? null;
}

export function selectConnectedAndroidDevice(
  devices: Array<{ serial: string; api: number }>,
  selectedSerial?: string,
): { serial: string; api: number } | null {
  const candidates = devices.filter(row => row.api >= MIN_ANDROID_API);
  if (selectedSerial) {
    return candidates.find(row => row.serial === selectedSerial) ?? null;
  }
  candidates.sort(
    (a, b) =>
      Number(b.api === PREFERRED_ANDROID_API) - Number(a.api === PREFERRED_ANDROID_API) ||
      b.api - a.api ||
      a.serial.localeCompare(b.serial),
  );
  return candidates[0] ?? null;
}

/**
 * React Native Test App produces a `.app` directory. Appium/xcodebuild need the
 * inner Mach-O (`ReactTestApp`), not an empty or stale wrapper.
 */
export function isCompleteIosAppBundle(appPath: string): boolean {
  if (!existsSync(appPath)) {
    return false;
  }
  try {
    if (!statSync(appPath).isDirectory()) {
      return false;
    }
  } catch {
    return false;
  }
  const executable = join(appPath, 'ReactTestApp');
  if (!existsSync(executable)) {
    return false;
  }
  try {
    return statSync(executable).isFile();
  } catch {
    return false;
  }
}

export type IosAppBundleResolution =
  | { kind: 'complete'; path: string }
  | { kind: 'incomplete'; path: string }
  | { kind: 'absent' };

export function resolveIosAppBundle(candidates: Array<string | undefined>): IosAppBundleResolution {
  let incompletePath: string | undefined;
  for (const candidate of candidates) {
    if (candidate == null || !existsSync(candidate)) {
      continue;
    }
    if (isCompleteIosAppBundle(candidate)) {
      return { kind: 'complete', path: candidate };
    }
    incompletePath ??= candidate;
  }
  return incompletePath ? { kind: 'incomplete', path: incompletePath } : { kind: 'absent' };
}

export function findCompleteIosAppBundle(
  candidates: Array<string | undefined>,
): string | undefined {
  const resolution = resolveIosAppBundle(candidates);
  return resolution.kind === 'complete' ? resolution.path : undefined;
}
