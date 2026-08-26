#!/usr/bin/env node
/**
 * Verify installed Appium drivers under APPIUM_HOME match drivers.manifest.json.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import {
  loadManifest,
  loadPackageJson,
  packageRoot,
  resolveAppiumBin,
  resolveAppiumHome,
} from './paths.mjs';

function assertPinsMatchPackageJson(manifest, pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.appium !== manifest.appium) {
    throw new Error(
      `drivers.manifest.json appium=${manifest.appium} != package.json appium=${deps.appium}`,
    );
  }
  for (const driver of manifest.drivers) {
    const pinned = deps[driver.package];
    if (pinned !== driver.version) {
      throw new Error(
        `drivers.manifest.json ${driver.package}@${driver.version} != package.json ${pinned}`,
      );
    }
  }
}

function listInstalledDrivers(appiumHome) {
  const appiumEntry = resolveAppiumBin();
  const result = spawnSync(process.execPath, [appiumEntry, 'driver', 'list', '--installed', '--json'], {
    cwd: packageRoot,
    env: { ...process.env, APPIUM_HOME: appiumHome },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`appium driver list failed (exit ${result.status}):\n${detail}`);
  }
  const parsed = JSON.parse(result.stdout || '{}');
  return parsed;
}

const manifest = loadManifest();
const pkg = loadPackageJson();
assertPinsMatchPackageJson(manifest, pkg);

const appiumHome = resolveAppiumHome(manifest);
if (!fs.existsSync(appiumHome)) {
  throw new Error(
    `APPIUM_HOME missing at ${appiumHome}. Run: yarn workspace @invertase/rngma-appium drivers:install`,
  );
}

const installed = listInstalledDrivers(appiumHome);
const failures = [];

for (const driver of manifest.drivers) {
  const entry = installed[driver.name];
  if (!entry) {
    failures.push(`missing driver "${driver.name}"`);
    continue;
  }
  const installedVersion = entry.version || entry.pkgVersion || entry.installVersion;
  if (installedVersion && installedVersion !== driver.version) {
    failures.push(
      `driver "${driver.name}" version ${installedVersion} != pinned ${driver.version}`,
    );
  }
}

if (failures.length > 0) {
  throw new Error(`Appium driver verify failed:\n- ${failures.join('\n- ')}`);
}

console.log(
  `OK: Appium ${manifest.appium}; drivers ${manifest.drivers
    .map(d => `${d.name}@${d.version}`)
    .join(', ')} under ${appiumHome}`,
);
