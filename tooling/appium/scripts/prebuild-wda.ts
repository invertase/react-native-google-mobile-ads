#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  DEFAULT_IOS_DEVICE_NAME,
  IOS_WDA_DERIVED_DATA_PATH,
  IOS_WDA_RUNNER_APP_PATH,
  isCompleteWdaRunnerApp,
  requireIosUdid,
} from '../src/hostPreflight.ts';
import { runtimeResources } from '../src/slots.ts';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** APPIUM_HOME driver tree first — matches the versions Appium 4 sessions load. */
function xcuitestDriverPackageJson(): string {
  const appiumHome = resolve(
    packageRoot,
    JSON.parse(readFileSync(resolve(packageRoot, 'drivers.manifest.json'), 'utf8'))
      .appiumHome as string,
  );
  const candidates = [
    resolve(appiumHome, 'node_modules/appium-xcuitest-driver/package.json'),
    resolve(packageRoot, 'node_modules/appium-xcuitest-driver/package.json'),
  ];
  const pkgPath = candidates.find(candidate => existsSync(candidate));
  if (!pkgPath) {
    throw new Error(
      'appium-xcuitest-driver is not installed; run yarn tests:appium:drivers:install.',
    );
  }
  return pkgPath;
}

const xcuitestRequire = createRequire(xcuitestDriverPackageJson());

async function importDriverDependency(name: string): Promise<Record<string, any>> {
  const manifestPath = xcuitestRequire.resolve(`${name}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { main?: string };
  if (!manifest.main) {
    throw new Error(`${name} has no main entry in ${manifestPath}.`);
  }
  return import(pathToFileURL(resolve(dirname(manifestPath), manifest.main)).href);
}

async function main(): Promise<void> {
  const { getSimulator, listSimulators } = await importDriverDependency('appium-ios-simulator');
  const { WebDriverAgent } = await importDriverDependency('appium-webdriveragent');

  const runtime = runtimeResources('ios');
  const deviceName =
    runtime.slotResources?.iosSimulatorName ||
    process.env.RNGMA_IOS_DEVICE?.trim() ||
    DEFAULT_IOS_DEVICE_NAME;
  const platformVersion = process.env.RNGMA_IOS_VERSION?.trim();
  if (!platformVersion) {
    throw new Error(
      'RNGMA_IOS_VERSION is required to prebuild WDA for the selected simulator runtime.',
    );
  }

  const udid = requireIosUdid();
  const deviceInfo = (await listSimulators()).find(
    device =>
      device.udid === udid && device.name === deviceName && device.sdk === platformVersion,
  );
  if (!deviceInfo) {
    throw new Error(
      `RNGMA_IOS_UDID=${udid} is not an available exact ${deviceName} on iOS ${platformVersion}.`,
    );
  }

  rmSync(IOS_WDA_DERIVED_DATA_PATH, { recursive: true, force: true });
  const device = await getSimulator(udid, {
    platform: deviceInfo.platform,
    checkExistence: false,
  });
  const wda = new WebDriverAgent({
    iosSdkVersion: platformVersion,
    platformVersion,
    showXcodeLog: true,
    device,
    derivedDataPath: IOS_WDA_DERIVED_DATA_PATH,
  });

  console.log(
    `Building WebDriverAgent for ${deviceName} iOS ${platformVersion} (${udid}) at ${IOS_WDA_DERIVED_DATA_PATH}…`,
  );
  await wda.xcodebuild.start(true);

  if (!isCompleteWdaRunnerApp()) {
    throw new Error(`WDA prebuild did not produce ${IOS_WDA_RUNNER_APP_PATH}.`);
  }
  console.log(`WebDriverAgent prebuild artifact ready: ${IOS_WDA_RUNNER_APP_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
