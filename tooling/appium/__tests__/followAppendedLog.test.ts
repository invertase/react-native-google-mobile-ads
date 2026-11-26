import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { followAppendedLog } from '../src/followAppendedLog.ts';

test('followAppendedLog reads a line appended after start and does not echo it', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'rngma-follow-'));
  const filePath = path.join(root, 'appium.log');
  writeFileSync(filePath, 'already-there\n');
  const lines: string[] = [];
  const parent: string[] = [];
  const original = process.stdout.write;
  process.stdout.write = ((chunk: unknown) => {
    parent.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  const stop = followAppendedLog(filePath, line => lines.push(line), { intervalMs: 20 });
  try {
    appendFileSync(filePath, 'session created successfully\n');
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.deepEqual(lines, ['session created successfully']);
    assert.equal(parent.some(chunk => chunk.includes('session created successfully')), false);
  } finally {
    stop();
    process.stdout.write = original;
    rmSync(root, { recursive: true, force: true });
  }
});
