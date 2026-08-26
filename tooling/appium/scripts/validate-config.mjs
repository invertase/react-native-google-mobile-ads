#!/usr/bin/env node
/**
 * Device-free Appium workspace validation: pins, resolvable deps, WDIO configs load.
 * Does not start Appium or touch an emulator/simulator.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  loadManifest,
  loadPackageJson,
  packageRoot,
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
    if (!pinned) {
      throw new Error(`package.json missing dependency ${driver.package}`);
    }
    if (pinned !== driver.version) {
      throw new Error(
        `drivers.manifest.json ${driver.package}@${driver.version} != package.json ${pinned}`,
      );
    }
  }
}

function findInstalledPackageDir(name) {
  const parts = name.startsWith('@') ? name.split('/') : [name];
  let dir = packageRoot;
  while (true) {
    const candidate = path.join(dir, 'node_modules', ...parts);
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error(`Cannot resolve installed package ${name} from ${packageRoot}`);
}

function assertResolvable(specifier) {
  findInstalledPackageDir(specifier);
}

const manifest = loadManifest();
const pkg = loadPackageJson();
assertPinsMatchPackageJson(manifest, pkg);

const required = [
  'appium',
  'webdriverio',
  '@wdio/cli',
  '@wdio/local-runner',
  '@wdio/mocha-framework',
  '@wdio/appium-service',
  'appium-uiautomator2-driver',
  'appium-xcuitest-driver',
  'tsx',
];
for (const specifier of required) {
  assertResolvable(specifier);
}

const appiumHome = resolveAppiumHome(manifest);
const { register } = await import('tsx/esm/api');
const unregister = register();
try {
  const shared = await import(pathToFileURL(path.join(packageRoot, 'wdio.shared.conf.ts')).href);
  const android = await import(pathToFileURL(path.join(packageRoot, 'wdio.android.conf.ts')).href);
  const ios = await import(pathToFileURL(path.join(packageRoot, 'wdio.ios.conf.ts')).href);

  if (!shared.config?.framework) {
    throw new Error('wdio.shared.conf.ts did not export a usable config.framework');
  }
  if (!android.config?.capabilities?.length) {
    throw new Error('wdio.android.conf.ts missing capabilities');
  }
  if (!ios.config?.capabilities?.length) {
    throw new Error('wdio.ios.conf.ts missing capabilities');
  }
} finally {
  unregister();
}

console.log('OK: @invertase/rngma-appium workspace pins + WDIO configs load');
console.log(`    Appium ${manifest.appium}; APPIUM_HOME=${appiumHome} (install via drivers:install)`);
console.log(
  `    Drivers: ${manifest.drivers.map(d => `${d.name}@${d.version}`).join(', ')}`,
);
