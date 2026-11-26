#!/usr/bin/env node
/**
 * Install Appium drivers into a workspace-local APPIUM_HOME using pinned
 * versions from drivers.manifest.json (and matching yarn.lock deps).
 *
 * Drivers are not fully guaranteed by yarn.lock alone; this script + verify
 * is the pin contract. Idempotent: matching driver pins are skipped unless
 * transitive override pins are violated (exit 0 when nothing to do).
 * Manifest `overrides` pin known-breaking transitive driver deps via npm
 * overrides in APPIUM_HOME/package.json; violating copies trigger uninstall and
 * reinstall even when driver versions already match.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { applyAppiumHomeOverrides, findOverrideMismatches } from './appium-home.mjs';
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

function runAppium(args, appiumHome) {
  const appiumEntry = resolveAppiumBin();
  const result = spawnSync(process.execPath, [appiumEntry, ...args], {
    cwd: packageRoot,
    env: { ...process.env, APPIUM_HOME: appiumHome },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`appium ${args.join(' ')} failed (exit ${result.status}):\n${detail}`);
  }
  return result.stdout;
}

function listInstalledDrivers(appiumHome) {
  if (!fs.existsSync(appiumHome)) {
    return {};
  }
  const appiumEntry = resolveAppiumBin();
  const result = spawnSync(process.execPath, [appiumEntry, 'driver', 'list', '--installed', '--json'], {
    cwd: packageRoot,
    env: { ...process.env, APPIUM_HOME: appiumHome },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    // Fresh or incomplete APPIUM_HOME: treat as no drivers installed.
    return {};
  }
  try {
    return JSON.parse(result.stdout || '{}');
  } catch {
    return {};
  }
}

function installedVersion(entry) {
  if (!entry) {
    return undefined;
  }
  return entry.version || entry.pkgVersion || entry.installVersion;
}

const manifest = loadManifest();
const pkg = loadPackageJson();
assertPinsMatchPackageJson(manifest, pkg);

const appiumHome = resolveAppiumHome(manifest);
fs.mkdirSync(appiumHome, { recursive: true });
if (applyAppiumHomeOverrides(appiumHome, manifest.overrides)) {
  console.log(`Wrote npm overrides ${JSON.stringify(manifest.overrides ?? {})} to APPIUM_HOME.`);
}

const installed = listInstalledDrivers(appiumHome);
const staleTransitives =
  Object.keys(installed).length > 0 ? findOverrideMismatches(appiumHome, manifest.overrides) : [];
if (staleTransitives.length > 0) {
  console.log(
    `Reinstalling all drivers; transitive pins not satisfied:\n- ${staleTransitives.join('\n- ')}`,
  );
}

const mismatched = manifest.drivers.filter(
  driver => installedVersion(installed[driver.name]) !== driver.version,
);
if (mismatched.length > 0) {
  // Uninstall every stale driver before any install: Appium 4 driver peers conflict
  // when an older major (e.g. xcuitest 12) remains in APPIUM_HOME during npm install.
  for (const driver of manifest.drivers) {
    const current = installedVersion(installed[driver.name]);
    if (current && current !== driver.version) {
      console.log(
        `Uninstalling Appium driver ${driver.name}@${current} (pinned ${driver.version})…`,
      );
      runAppium(['driver', 'uninstall', driver.name], appiumHome);
    }
  }
}

if (staleTransitives.length > 0) {
  for (const driver of manifest.drivers) {
    const current = installedVersion(installed[driver.name]);
    if (current === driver.version) {
      console.log(
        `Uninstalling Appium driver ${driver.name}@${current} (reinstall for transitive pins)…`,
      );
      runAppium(['driver', 'uninstall', driver.name], appiumHome);
    }
  }
}

for (const driver of manifest.drivers) {
  const installSpec = `${driver.package}@${driver.version}`;
  const current = installedVersion(installed[driver.name]);

  if (current === driver.version && staleTransitives.length === 0 && mismatched.length === 0) {
    console.log(`Skipping Appium driver ${driver.name}@${driver.version} (already installed).`);
    continue;
  }

  if (current === driver.version && staleTransitives.length === 0 && mismatched.length > 0) {
    continue;
  }

  console.log(`Installing Appium driver ${driver.name} from npm (${installSpec})…`);
  // Exact npm version keeps the install reproducible (yarn.lock alone is not enough).
  runAppium(['driver', 'install', '--source=npm', installSpec], appiumHome);
}

const transitiveFailures = findOverrideMismatches(appiumHome, manifest.overrides);
if (transitiveFailures.length > 0) {
  throw new Error(
    `Appium driver install left unpinned transitives:\n- ${transitiveFailures.join('\n- ')}`,
  );
}

console.log(`Drivers installed under APPIUM_HOME=${appiumHome}`);
console.log('Run: yarn workspace @invertase/rngma-appium drivers:verify');
