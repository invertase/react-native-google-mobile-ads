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

test('Android e2e CI uses a single API 36 google_apis image', () => {
  const source = readFileSync(join(workflowDir, 'tests_e2e_android.yml'), 'utf8');
  const matrix = source.slice(source.indexOf('matrix:'), source.indexOf('steps:'));
  assert.match(matrix, /api-level: \[36\]/);
  assert.match(matrix, /target: \[google_apis\]/);
  assert.doesNotMatch(matrix, /api-level: \[29\]/);
  assert.doesNotMatch(matrix, /playstore/);
});

test('the Pods cache stores the same ios directory its key hashes', () => {
  const source = readFileSync(join(workflowDir, 'tests_e2e_ios.yml'), 'utf8');
  const step = source.slice(source.indexOf('name: Cache Pods'));
  const cachedPath = /^\s+path: (\S+)$/m.exec(step)?.[1];
  const hashedLock = /hashFiles\('([^']+Podfile\.lock)'\)/.exec(step)?.[1];

  assert.ok(cachedPath, 'Cache Pods step must declare a path');
  assert.ok(hashedLock, 'Cache Pods key must hash a Podfile.lock');
  assert.equal(
    cachedPath,
    `${dirname(hashedLock)}/Pods`,
    'a key hashing one Podfile.lock while caching a different tree can never hit',
  );
});
