#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(scriptDirectory, '..');
export const CORE_PACKAGE = path.join(REPO_ROOT, 'packages/core');
export const EXAMPLE_PACKAGE = path.join(REPO_ROOT, 'RNGoogleMobileAdsExample');
export const OUTPUT_PATHS = Object.freeze({
  android: path.join(
    CORE_PACKAGE,
    'android/generated',
  ),
  ios: path.join(CORE_PACKAGE, 'ios/generated'),
});

const PLATFORMS = ['android', 'ios'];
const TOOLCHAIN_PINS = Object.freeze({
  'react-native': '0.86.0',
  '@react-native/codegen': '0.86.0',
  '@react-native-community/cli': '20.1.0',
  '@react-native-community/cli-platform-android': '20.1.0',
  '@react-native-community/cli-platform-ios': '20.1.0',
});

function packageVersion(packageJsonPath) {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
}

export function resolveToolchain() {
  const examplePackageJson = path.join(EXAMPLE_PACKAGE, 'package.json');
  const exampleManifest = JSON.parse(fs.readFileSync(examplePackageJson, 'utf8'));
  const exampleRequire = createRequire(examplePackageJson);
  const resolved = {};

  for (const [packageName, expectedVersion] of Object.entries(TOOLCHAIN_PINS)) {
    const declared =
      exampleManifest.dependencies?.[packageName] ??
      exampleManifest.devDependencies?.[packageName];
    assert.equal(
      declared,
      expectedVersion,
      `${packageName} must be pinned to ${expectedVersion} in RNGoogleMobileAdsExample`,
    );
    const packageJson = exampleRequire.resolve(`${packageName}/package.json`);
    const actualVersion = packageVersion(packageJson);
    assert.equal(
      actualVersion,
      expectedVersion,
      `${packageName} resolved from the example workspace at ${actualVersion}, expected ${expectedVersion}`,
    );
    resolved[packageName] = { packageJson, version: actualVersion };
  }

  const reactNativeRoot = path.dirname(resolved['react-native'].packageJson);
  const generator = path.join(
    reactNativeRoot,
    'scripts/generate-codegen-artifacts.js',
  );
  assert.ok(fs.existsSync(generator), `Missing React Native generator: ${generator}`);

  return Object.freeze({ generator, packages: Object.freeze(resolved) });
}

export function printToolchain(toolchain) {
  const summary = Object.entries(toolchain.packages)
    .map(([name, details]) => `${name}@${details.version}`)
    .join(', ');
  console.log(`[codegen] example-owned toolchain: ${summary}`);
  console.log(`[codegen] generator: ${toolchain.generator}`);
}

export function wipeOutput(outputPath) {
  fs.rmSync(outputPath, { recursive: true, force: true });
}

function flattenIosReactCodegen(outputPath) {
  const nested = path.join(outputPath, 'ReactCodegen');
  if (!fs.existsSync(nested)) {
    throw new Error(`React Native Codegen did not create ${nested}`);
  }

  for (const entry of fs.readdirSync(nested)) {
    fs.renameSync(path.join(nested, entry), path.join(outputPath, entry));
  }
  fs.rmSync(nested, { recursive: true, force: true });
}

export function regeneratePlatform(platform, execute = execFileSync) {
  if (!PLATFORMS.includes(platform)) {
    throw new Error(`platform must be android or ios, got: ${platform}`);
  }

  const outputPath = OUTPUT_PATHS[platform];
  const toolchain = resolveToolchain();
  printToolchain(toolchain);
  wipeOutput(outputPath);
  execute(
    process.execPath,
    [
      toolchain.generator,
      '--path',
      CORE_PACKAGE,
      '--targetPlatform',
      platform,
      '--outputPath',
      outputPath,
      '--source',
      'library',
    ],
    { cwd: EXAMPLE_PACKAGE, stdio: 'inherit' },
  );

  if (platform === 'ios') {
    // RN emits library files under <outputPath>/ReactCodegen. The pod owns
    // ios/generated directly, matching the stable package layout used by RNFB.
    flattenIosReactCodegen(outputPath);
  }
}

export function regenerateAll(execute = execFileSync) {
  for (const platform of PLATFORMS) {
    regeneratePlatform(platform, execute);
  }
}

function main(argv) {
  if (argv.length !== 1) {
    throw new Error('Usage: codegen-package.mjs <android|ios|all>');
  }
  if (argv[0] === 'all') {
    regenerateAll();
    return;
  }
  regeneratePlatform(argv[0]);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
