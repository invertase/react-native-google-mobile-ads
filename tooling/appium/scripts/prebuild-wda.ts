#!/usr/bin/env node
import { readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_IOS_DEVICE_NAME,
  IOS_WDA_DERIVED_DATA_PATH,
  IOS_WDA_RUNNER_APP_PATH,
  isCompleteWdaRunnerApp,
  requireIosUdid,
} from '../src/hostPreflight.ts';

// Resolve through the pinned XCUITest driver's declared dependencies so the
// prebuild uses the same WDA implementation that Appium will launch.
const rootRequire = createRequire(import.meta.url);
const xcuitestRequire = createRequire(
  rootRequire.resolve('appium-xcuitest-driver/package.json'),
);

async function importDriverDependency(name: string): Promise<Record<string, any>> {
  const manifestPath = xcuitestRequire.resolve(`${name}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { main?: string };
  if (!manifest.main) {
    throw new Error(`${name} has no main entry in ${manifestPath}.`);
  }
  return import(pathToFileURL(resolve(dirname(manifestPath), manifest.main)).href);
}

async function main(): Promise<void> {
  const { getSimulator } = await importDriverDependency('appium-ios-simulator');
  const { WebDriverAgent } = await importDriverDependency('appium-webdriveragent');
  const { Simctl } = await importDriverDependency('node-simctl');

  const deviceName = process.env.RNGMA_IOS_DEVICE?.trim() || DEFAULT_IOS_DEVICE_NAME;
  const platformVersion = process.env.RNGMA_IOS_VERSION?.trim();
  if (!platformVersion) {
    throw new Error(
      'RNGMA_IOS_VERSION is required to prebuild WDA for the selected simulator runtime.',
    );
  }

  const udid = requireIosUdid();
  const devices = await new Simctl().getDevices(platformVersion, 'iOS');
  const deviceInfo = devices.find(device => device.udid === udid && device.name === deviceName);
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
