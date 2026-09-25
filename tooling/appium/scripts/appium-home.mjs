import fs from 'node:fs';
import path from 'node:path';

/**
 * Write the manifest's npm `overrides` into APPIUM_HOME/package.json so every
 * `appium driver install` (npm install in APPIUM_HOME) resolves them to the pin.
 * Returns true when package.json changed.
 */
export function applyAppiumHomeOverrides(appiumHome, overrides = {}) {
  const pkgPath = path.join(appiumHome, 'package.json');
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
  if (JSON.stringify(pkg.overrides ?? {}) === JSON.stringify(overrides)) {
    return false;
  }
  if (Object.keys(overrides).length === 0) {
    delete pkg.overrides;
  } else {
    pkg.overrides = overrides;
  }
  fs.mkdirSync(appiumHome, { recursive: true });
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return true;
}

/** Every installed copy (hoisted or nested) of `name` under `nodeModules`. */
function findInstalledCopies(nodeModules, name, found = []) {
  if (!fs.existsSync(nodeModules)) {
    return found;
  }
  for (const entry of fs.readdirSync(nodeModules, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }
    const dirs = entry.name.startsWith('@')
      ? fs
          .readdirSync(path.join(nodeModules, entry.name), { withFileTypes: true })
          .filter(child => child.isDirectory())
          .map(child => path.join(nodeModules, entry.name, child.name))
      : [path.join(nodeModules, entry.name)];
    for (const dir of dirs) {
      const pkgPath = path.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === name) {
          found.push({ dir, version: pkg.version });
        }
      }
      findInstalledCopies(path.join(dir, 'node_modules'), name, found);
    }
  }
  return found;
}

/**
 * Failures for each overridden package that is missing from APPIUM_HOME or has
 * any installed copy whose version differs from the pin.
 */
export function findOverrideMismatches(appiumHome, overrides = {}) {
  const failures = [];
  const nodeModules = path.join(appiumHome, 'node_modules');
  for (const [name, pinned] of Object.entries(overrides)) {
    const copies = findInstalledCopies(nodeModules, name);
    if (copies.length === 0) {
      failures.push(`transitive "${name}" not installed (pinned ${pinned})`);
      continue;
    }
    for (const copy of copies) {
      if (copy.version !== pinned) {
        failures.push(
          `transitive "${name}" ${copy.version} != pinned ${pinned} at ${path.relative(appiumHome, copy.dir)}`,
        );
      }
    }
  }
  return failures;
}
