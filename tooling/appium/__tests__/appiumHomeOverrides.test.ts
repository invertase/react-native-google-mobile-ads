import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
// @ts-expect-error untyped workspace .mjs helper
import { applyAppiumHomeOverrides, findOverrideMismatches } from '../scripts/appium-home.mjs';

const manifest = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'drivers.manifest.json'),
    'utf8',
  ),
);

const PIN = { 'bplist-parser': '0.3.2' };
const homes: string[] = [];

function makeHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'rngma-appium-home-'));
  homes.push(home);
  return home;
}

function installPackage(dir: string, name: string, version: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version }));
}

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

describe('APPIUM_HOME transitive pins', () => {
  test('manifest pins bplist-parser to the XCUITest-compatible 0.3.2', () => {
    assert.deepEqual(manifest.overrides, PIN);
  });

  test('writes overrides into APPIUM_HOME package.json and preserves driver deps', () => {
    const home = makeHome();
    writeFileSync(
      join(home, 'package.json'),
      JSON.stringify({ devDependencies: { 'appium-xcuitest-driver': '^12.8.0' } }),
    );
    assert.equal(applyAppiumHomeOverrides(home, PIN), true);
    assert.deepEqual(JSON.parse(readFileSync(join(home, 'package.json'), 'utf8')), {
      devDependencies: { 'appium-xcuitest-driver': '^12.8.0' },
      overrides: PIN,
    });
    assert.equal(applyAppiumHomeOverrides(home, PIN), false);
  });

  test('passes when every installed copy matches the pin', () => {
    const home = makeHome();
    installPackage(join(home, 'node_modules/bplist-parser'), 'bplist-parser', '0.3.2');
    installPackage(
      join(home, 'node_modules/@appium/support/node_modules/bplist-parser'),
      'bplist-parser',
      '0.3.2',
    );
    assert.deepEqual(findOverrideMismatches(home, PIN), []);
  });

  test('fails on the known-bad hoisted 0.5.0', () => {
    const home = makeHome();
    installPackage(join(home, 'node_modules/bplist-parser'), 'bplist-parser', '0.5.0');
    assert.deepEqual(findOverrideMismatches(home, PIN), [
      'transitive "bplist-parser" 0.5.0 != pinned 0.3.2 at node_modules/bplist-parser',
    ]);
  });

  test('fails on a nested copy that differs from the pin', () => {
    const home = makeHome();
    installPackage(join(home, 'node_modules/bplist-parser'), 'bplist-parser', '0.3.2');
    installPackage(
      join(home, 'node_modules/@appium/support/node_modules/bplist-parser'),
      'bplist-parser',
      '0.5.0',
    );
    const failures = findOverrideMismatches(home, PIN);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /0\.5\.0 != pinned 0\.3\.2 at node_modules\/@appium\/support\//);
  });

  test('fails when the pinned package is missing', () => {
    assert.deepEqual(findOverrideMismatches(makeHome(), PIN), [
      'transitive "bplist-parser" not installed (pinned 0.3.2)',
    ]);
  });
});
