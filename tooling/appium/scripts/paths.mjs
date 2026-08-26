import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const manifestPath = path.join(packageRoot, 'drivers.manifest.json');
export const packageJsonPath = path.join(packageRoot, 'package.json');

export function loadManifest() {
  return require(manifestPath);
}

export function loadPackageJson() {
  return require(packageJsonPath);
}

export function resolveAppiumHome(manifest = loadManifest()) {
  return path.resolve(packageRoot, manifest.appiumHome);
}

export function resolveAppiumBin() {
  return require.resolve('appium/build/lib/main.js', { paths: [packageRoot] });
}
