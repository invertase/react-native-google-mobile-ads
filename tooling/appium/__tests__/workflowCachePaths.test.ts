import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `actions/cache` silently no-ops on a path that does not exist: it reports a miss on
// restore and skips the save step entirely, so a wrong path looks like a permanently
// cold cache rather than a failure. The iOS Pods cache pointed at `tests/ios/Pods`
// (an RNFB-shaped path absent from this repo) and therefore never cached anything.

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const workflowDir = join(repoRoot, '.github', 'workflows');

function workflowFiles(): string[] {
  return readdirSync(workflowDir).filter(name => name.endsWith('.yml') || name.endsWith('.yaml'));
}

test('every repo-relative workflow cache path resolves inside this checkout', () => {
  for (const file of workflowFiles()) {
    const source = readFileSync(join(workflowDir, file), 'utf8');
    for (const match of source.matchAll(/^\s+path: (\S+)$/gm)) {
      const value = match[1];
      // Home-relative, absolute, and step-output paths live outside the checkout.
      if (value.startsWith('~') || value.startsWith('/') || value.startsWith('${{')) {
        continue;
      }
      // The cached directory itself is build output and need not exist yet, but the
      // directory that will contain it must, or the path is simply wrong.
      const parent = join(repoRoot, dirname(value));
      assert.ok(existsSync(parent), `${file}: cache path "${value}" has no directory ${parent}`);
    }
  }
});

test('Android e2e CI uses a single API 36 Play Store image', () => {
  const source = readFileSync(join(workflowDir, 'tests_e2e_android.yml'), 'utf8');
  const matrix = source.slice(source.indexOf('matrix:'), source.indexOf('steps:'));
  assert.match(matrix, /api-level: \[36\]/);
  assert.match(matrix, /target: \[google_apis_playstore\]/);
  assert.doesNotMatch(matrix, /api-level: \[29\]/);
});

test('Android e2e CI pins ubuntu-24.04 and Node for WDIO stability', () => {
  const source = readFileSync(join(workflowDir, 'tests_e2e_android.yml'), 'utf8');
  const androidJob = source.slice(source.indexOf('  android:'), source.indexOf('    steps:'));
  assert.match(androidJob, /runs-on: ubuntu-24\.04/);
  assert.match(source, /node-version: '24\.22\.3'/);
  assert.doesNotMatch(source, /node-version: '24\.21\.0'/);
});

test('iOS e2e CI pins Node 24.22.3 and fails install on launch-contract gate', () => {
  const source = readFileSync(join(workflowDir, 'tests_e2e_ios.yml'), 'utf8');
  assert.match(source, /node-version: '24\.22\.3'/);
  assert.doesNotMatch(source, /^\s+node-version:\s*24\s*$/m);
  const install = source.slice(source.indexOf('name: Install example on simulator'));
  assert.match(install, /set -euo pipefail/);
  assert.match(install, /launch-contract gate|ImageVersion/);
  assert.doesNotMatch(install, /nick-fields\/retry@v3/);
  assert.match(install, /yarn tests:ios:run/);
});

test('WDIO shared conf enables CI-only specFileRetries', () => {
  const source = readFileSync(
    join(repoRoot, 'tooling/appium/wdio.shared.conf.ts'),
    'utf8',
  );
  assert.match(source, /specFileRetries:\s*1/);
  assert.match(source, /GITHUB_ACTIONS/);
});

test('WDIO iOS conf lowers log level on CI', () => {
  const source = readFileSync(
    join(repoRoot, 'tooling/appium/wdio.ios.conf.ts'),
    'utf8',
  );
  assert.match(source, /logLevel:\s*'warn'/);
  assert.match(source, /GITHUB_ACTIONS/);
});

test('the Pods cache stores the same ios directory its key hashes', () => {
  const source = readFileSync(join(workflowDir, 'tests_e2e_ios.yml'), 'utf8');
  const step = source.slice(source.indexOf('name: Pods Cache Restore'));
  const cachedPath = /^\s+path: (\S+)$/m.exec(step)?.[1];
  const hashedLock = /hashFiles\('([^']+Podfile\.lock)'\)/.exec(step)?.[1];

  assert.ok(cachedPath, 'Pods Cache Restore step must declare a path');
  assert.ok(hashedLock, 'Pods Cache Restore key must hash a Podfile.lock');
  assert.equal(
    cachedPath,
    `${dirname(hashedLock)}/Pods`,
    'a key hashing one Podfile.lock while caching a different tree can never hit',
  );
});
