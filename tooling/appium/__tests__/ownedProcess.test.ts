import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnOwned } from '../src/ownedProcess.ts';

async function captureParent(
  mirrorToParent: boolean,
): Promise<{ lines: string[]; log: string; parent: string }> {
  const root = mkdtempSync(path.join(tmpdir(), 'rngma-owned-'));
  const logPath = path.join(root, 'child.log');
  const parent: string[] = [];
  const original = process.stdout.write;
  process.stdout.write = ((chunk: unknown) => {
    parent.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  const lines: string[] = [];
  try {
    const child = spawnOwned(process.execPath, ['-e', 'process.stdout.write("owned-token\\n")'], {
      cwd: root,
      logPath,
      mirrorToParent,
    });
    child.onLine(line => lines.push(line));
    await child.completion;
    return { lines, log: readFileSync(logPath, 'utf8'), parent: parent.join('') };
  } finally {
    process.stdout.write = original;
    rmSync(root, { recursive: true, force: true });
  }
}

test('spawnOwned mirrorToParent false keeps the log and onLine off the parent', async () => {
  const result = await captureParent(false);
  assert.deepEqual(result.lines, ['owned-token']);
  assert.equal(result.log, 'owned-token\n');
  assert.equal(result.parent.includes('owned-token'), false);
});

test('spawnOwned mirrors to the parent by default', async () => {
  const result = await captureParent(true);
  assert.deepEqual(result.lines, ['owned-token']);
  assert.equal(result.log, 'owned-token\n');
  assert.equal(result.parent.includes('owned-token'), true);
});
