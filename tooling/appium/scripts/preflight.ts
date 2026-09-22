import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bootAndPersistSelectedSimulator,
  DEFAULT_IOS_DEVICE_NAME,
  ensureAndroidMetroReverse,
  IOS_WDA_DERIVED_DATA_PATH,
  IOS_WDA_RUNNER_APP_PATH,
  inspectConnectedAndroidApis,
  isCompleteWdaRunnerApp,
  MIN_ANDROID_API,
  MIN_NODE_MAJOR,
  nodeMeetsMinimum,
  parseAvailableIosSimulators,
  PREFERRED_ANDROID_API,
  SELECT_AND_BOOT_GITHUB_ENV_ERROR,
  selectConnectedAndroidDevice,
  selectAndroidAvd,
  selectIosSimulator,
} from '../src/hostPreflight.ts';
import { iosAppBundleResolution, iosAppPath } from '../src/formats.ts';
import { runtimeResources, type RuntimeResources } from '../src/slots.ts';
import { androidSlotBootCommand } from '../src/commands.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');

function run(bin: string, args: string[]): string | null {
  try {
    return execFileSync(bin, args, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function checkNode(): void {
  if (nodeMeetsMinimum()) {
    console.log(`Node ${process.version} meets the v${MIN_NODE_MAJOR}+ floor.`);
    return;
  }
  console.error(
    `Node ${process.version} is below the v${MIN_NODE_MAJOR}+ floor. Node 22 hard-fails this stack. If nvm is available: nvm install 24 && nvm use 24 then retry the same yarn command. Yarn 4.10.3 on Node 24.x may flake install (cancel handler after settle); retry the same yarn, do not downgrade Node.`,
  );
  process.exit(1);
}

async function checkAppiumPort(port: number): Promise<void> {
  const available = await new Promise<boolean>(resolve => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close(error => resolve(error == null));
    });
  });
  if (available) {
    console.log(`Appium port 127.0.0.1:${port} is free.`);
    return;
  }

  const owner = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
  console.error(
    `Appium port 127.0.0.1:${port} is already in use. Do not start WDIO or retry while it is occupied.`,
  );
  if (owner) {
    console.error(owner);
  }
  console.error(
    'Identify the listener and stop it only if this task owns it; otherwise obtain an explicit ownership transfer.',
  );
  process.exit(1);
}

function bootSlotAndroid(runtime: RuntimeResources, avdNames: string[]): void {
  const slot = runtime.slotResources!;
  if (!avdNames.includes(slot.androidAvdName)) {
    console.error(
      `RNGMA slot ${slot.slot} is unprovisioned: exact AVD ${slot.androidAvdName} is missing. Run the canonical provisioning command first; Appium never creates AVDs.`,
    );
    process.exit(1);
  }
  const command = androidSlotBootCommand(process.env)!;
  const emulator = spawn(command.bin, command.args, { detached: true, stdio: 'ignore' });
  emulator.unref();
  execFileSync('adb', ['-s', slot.androidSerial, 'wait-for-device'], {
    stdio: 'ignore',
    timeout: 180_000,
  });
}

function checkAndroid(runtime: RuntimeResources): string {
  const sdkOut = run('adb', ['devices']);
  if (sdkOut == null) {
    console.error('adb is not available. Install platform-tools before yarn tests:appium:android.');
    process.exit(1);
  }
  const serials = sdkOut
    .split('\n')
    .slice(1)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('*'))
    .map(line => line.split(/\s+/))
    .filter(parts => parts[0] && parts[1] === 'device')
    .map(parts => parts[0]!);

  const selectedSerial = runtime.slotResources
    ? runtime.slotResources.androidSerial
    : process.env.RNGMA_ANDROID_UDID;
  if (
    runtime.slotResources &&
    process.env.RNGMA_ANDROID_UDID &&
    process.env.RNGMA_ANDROID_UDID !== selectedSerial
  ) {
    console.error(
      `RNGMA_ANDROID_UDID=${process.env.RNGMA_ANDROID_UDID} conflicts with RNGMA_E2E_SLOT=${runtime.slot}; expected ${selectedSerial}.`,
    );
    process.exit(1);
  }
  if (runtime.slotResources) {
    console.log(
      `Android slot preflight scopes every device query to ${selectedSerial}; unrelated connected devices remain inventory-only.`,
    );
  }
  const apis = inspectConnectedAndroidApis(
    serials,
    (bin, args) => run(bin, args) ?? '',
    selectedSerial,
  );

  const avdOut = run('emulator', ['-list-avds']);
  const names = avdOut
    ? avdOut
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
    : [];
  const avd = runtime.slotResources
    ? names.includes(runtime.slotResources.androidAvdName)
      ? { name: runtime.slotResources.androidAvdName, api: PREFERRED_ANDROID_API }
      : null
    : selectAndroidAvd(names);
  console.log(
    `emulator -list-avds: ${names.length === 0 ? 'none' : names.join(', ')}${
      avd ? `; deterministic choice=${avd.name} (API ${avd.api})` : ''
    }`,
  );

  const chosen = selectConnectedAndroidDevice(apis, selectedSerial);
  if (chosen) {
    if (runtime.slotResources) {
      const connectedAvd = run('adb', [
        '-s',
        chosen.serial,
        'shell',
        'getprop',
        'ro.boot.qemu.avd_name',
      ]);
      if (connectedAvd !== runtime.slotResources.androidAvdName) {
        console.error(
          `Android slot serial ${chosen.serial} is running ${connectedAvd || 'an unknown AVD'}, not exact ${runtime.slotResources.androidAvdName}. Refusing to select it.`,
        );
        process.exit(1);
      }
    }
    console.log(
      `Android device ${chosen.serial} API ${chosen.api} (>= ${MIN_ANDROID_API}; UiAutomator2 needs 8.0+).`,
    );
    return chosen.serial;
  }

  if (runtime.slotResources) {
    bootSlotAndroid(runtime, names);
    const raw = run('adb', [
      '-s',
      runtime.slotResources.androidSerial,
      'shell',
      'getprop',
      'ro.build.version.sdk',
    ]);
    const api = raw ? Number(raw) : NaN;
    if (!Number.isFinite(api) || api < MIN_ANDROID_API) {
      console.error(
        `Exact slot device ${runtime.slotResources.androidSerial} did not boot at API ${MIN_ANDROID_API}+.`,
      );
      process.exit(1);
    }
    const connectedAvd = run('adb', [
      '-s',
      runtime.slotResources.androidSerial,
      'shell',
      'getprop',
      'ro.boot.qemu.avd_name',
    ]);
    if (connectedAvd !== runtime.slotResources.androidAvdName) {
      console.error(
        `Booted slot serial reports ${connectedAvd || 'an unknown AVD'}, expected exact ${runtime.slotResources.androidAvdName}.`,
      );
      process.exit(1);
    }
    return runtime.slotResources.androidSerial;
  }

  if (selectedSerial) {
    const selected = apis.find(row => row.serial === selectedSerial);
    console.error(
      selected
        ? `Selected Android device ${selectedSerial} is API ${selected.api}; UiAutomator2 requires API ${MIN_ANDROID_API}+.`
        : `Selected Android device ${selectedSerial} is not connected and online.`,
    );
    console.error(
      `Choose a connected API ${MIN_ANDROID_API}+ serial or unset RNGMA_ANDROID_UDID. Connected: ${
        apis.length === 0 ? 'none' : apis.map(row => `${row.serial}=API${row.api}`).join(', ')
      }.`,
    );
  } else {
    console.error(
      `No connected Android device at API ${MIN_ANDROID_API}+. Connected: ${
        apis.length === 0 ? 'none' : apis.map(row => `${row.serial}=API${row.api}`).join(', ')
      }.`,
    );
  }
  if (avd) {
    console.error(
      `Boot ${avd.name} (API ${avd.api}) and retry the same yarn tests:appium:android. Do not retry on an API 24 emulator.`,
    );
  } else {
    console.error(
      `Create/boot an AVD at API ${MIN_ANDROID_API}+ (prefer API 36) then retry. emulator -list-avds is the inventory; do not guess the default AVD.`,
    );
  }
  process.exit(1);
}

function checkIos(
  runtime: RuntimeResources,
  options: { checkAppBundle?: boolean } = {},
): {
  udid: string;
  state: string;
  runtimeVersion: string;
} {
  const simctlJson = run('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
  if (simctlJson == null) {
    console.error(
      'Unable to inventory available iOS simulators with xcrun simctl. Install/select Xcode before yarn tests:appium:ios.',
    );
    process.exit(1);
  }
  let simulators;
  try {
    simulators = parseAvailableIosSimulators(simctlJson);
  } catch (error) {
    console.error(`Unable to parse xcrun simctl JSON: ${String(error)}`);
    process.exit(1);
  }
  const deviceName = runtime.slotResources
    ? runtime.slotResources.iosSimulatorName
    : process.env.RNGMA_IOS_DEVICE || DEFAULT_IOS_DEVICE_NAME;
  if (
    runtime.slotResources &&
    process.env.RNGMA_IOS_DEVICE &&
    process.env.RNGMA_IOS_DEVICE !== deviceName
  ) {
    console.error(
      `RNGMA_IOS_DEVICE=${process.env.RNGMA_IOS_DEVICE} conflicts with RNGMA_E2E_SLOT=${runtime.slot}; expected ${deviceName}.`,
    );
    process.exit(1);
  }
  const selected = selectIosSimulator(simulators, {
    deviceName,
    platformVersion: process.env.RNGMA_IOS_VERSION,
    udid: process.env.RNGMA_IOS_UDID,
  });
  if (!selected) {
    const availableIphones = simulators
      .filter(simulator => simulator.name.startsWith('iPhone '))
      .map(simulator => `${simulator.name} iOS ${simulator.runtimeVersion} (${simulator.udid})`)
      .sort();
    console.error(
      `No available exact-name iOS simulator matched ${deviceName}${process.env.RNGMA_IOS_VERSION ? ` on iOS ${process.env.RNGMA_IOS_VERSION}` : ''}${process.env.RNGMA_IOS_UDID ? ` with UDID ${process.env.RNGMA_IOS_UDID}` : ''}. Appium must not create a simulator.`,
    );
    console.error(
      `Available iPhones: ${availableIphones.length > 0 ? availableIphones.join(', ') : 'none'}.`,
    );
    process.exit(1);
  }
  console.log(
    `iOS simulator ${selected.name} iOS ${selected.runtimeVersion} ${selected.udid} (${selected.state}); using existing UDID.`,
  );

  if (process.env.RNGMA_WDA_PREBUILT === '1') {
    if (!isCompleteWdaRunnerApp()) {
      console.error(
        `RNGMA_WDA_PREBUILT=1 requires the complete shared artifact ${IOS_WDA_RUNNER_APP_PATH}. Run yarn tests:appium:ios:prebuild-wda first.`,
      );
      process.exit(1);
    }
    console.log(
      `iOS WDA prebuilt mode: usePrebuiltWDA=true; derivedDataPath=${IOS_WDA_DERIVED_DATA_PATH}; artifact=${IOS_WDA_RUNNER_APP_PATH}`,
    );
  }

  if (options.checkAppBundle === false) {
    return selected;
  }

  const resolution = iosAppBundleResolution();
  if (resolution.kind !== 'complete') {
    const unavailablePath = resolution.kind === 'absent' ? iosAppPath() : resolution.path;
    console.error(
      `iOS bundle is unavailable or incomplete (missing a regular ReactTestApp executable): ${unavailablePath}. Rebuild it or correct RNGMA_IOS_APP; do not blindly retry Appium or Node.`,
    );
    process.exit(1);
  }
  console.log(`iOS app bundle is complete: ${resolution.path}`);
  return selected;
}

function selectAndBootIos(runtime: RuntimeResources): void {
  const selected = checkIos(runtime, { checkAppBundle: false });
  try {
    bootAndPersistSelectedSimulator(
      selected,
      process.argv,
      (bin, args) => {
        execFileSync(bin, args, { stdio: 'inherit' });
      },
      appendFileSync,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === SELECT_AND_BOOT_GITHUB_ENV_ERROR) {
      console.error(message);
      process.exit(1);
    }
    throw error;
  }
  console.log(
    `Booted and persisted RNGMA_IOS_UDID=${selected.udid} RNGMA_IOS_VERSION=${selected.runtimeVersion}.`,
  );
}

async function main(): Promise<void> {
  const target = process.argv[2] ?? 'all';
  if (target !== 'android' && target !== 'ios' && target !== 'all') {
    throw new Error(`Unknown preflight target "${target}".`);
  }
  const runtimePlatform = target === 'ios' ? 'ios' : 'android';
  const runtime = runtimeResources(runtimePlatform);
  checkNode();
  if (target === 'ios' && process.argv.includes('--select-and-boot')) {
    selectAndBootIos(runtime);
    return;
  }
  await checkAppiumPort(runtime.appiumPort);
  let androidUdid: string | undefined;
  let iosUdid: string | undefined;
  let iosVersion: string | undefined;
  if (target === 'android' || target === 'all') {
    androidUdid = checkAndroid(runtime);
  }
  if (target === 'ios' || target === 'all') {
    const ios = checkIos(runtime);
    iosUdid = ios.udid;
    iosVersion = ios.runtimeVersion;
  }

  if (!process.argv.includes('--run')) {
    return;
  }
  if (target !== 'android' && target !== 'ios') {
    console.error('--run requires an android or ios target.');
    process.exit(1);
  }
  const codegen = spawnSync('yarn', ['tests:e2e:codegen'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (codegen.error) {
    throw codegen.error;
  }
  if (codegen.status !== 0) {
    process.exit(codegen.status ?? 1);
  }
  if (target === 'android' && androidUdid) {
    ensureAndroidMetroReverse(androidUdid, (bin, args) => {
      return execFileSync(bin, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
        timeout: 10_000,
      });
    }, runtime.metroPort);
    console.log(
      `Android device ${androidUdid} reaches this checkout's Metro through tcp:${runtime.metroPort}.`,
    );
  }
  const result = spawnSync('yarn', ['exec', 'wdio', 'run', `./wdio.${target}.conf.ts`], {
    env: {
      ...process.env,
      ...(androidUdid ? { RNGMA_ANDROID_UDID: androidUdid } : {}),
      ...(iosUdid ? { RNGMA_IOS_UDID: iosUdid } : {}),
      ...(iosVersion ? { RNGMA_IOS_VERSION: iosVersion } : {}),
      RNGMA_E2E_PLATFORM: target,
      RNGMA_IOS_DEVICE:
        target === 'ios' && runtime.slotResources
          ? runtime.slotResources.iosSimulatorName
          : process.env.RNGMA_IOS_DEVICE,
    },
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
