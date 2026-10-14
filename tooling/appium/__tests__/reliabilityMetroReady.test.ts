import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import {
  ensureReliabilityMetroReady,
  waitForReliabilityMetroReady,
} from '../src/reliabilityMetro.ts';

describe('waitForReliabilityMetroReady', () => {
  test('resolves only after packager and platform bundle probes succeed', async () => {
    let packagerCalls = 0;
    let bundleCalls = 0;
    await waitForReliabilityMetroReady(13007, 'android', {
      timeoutMs: 2_000,
      async probePackager() {
        packagerCalls += 1;
        return packagerCalls >= 2;
      },
      async probeBundle() {
        bundleCalls += 1;
        return bundleCalls >= 1;
      },
    });
    assert.equal(packagerCalls >= 2, true);
    assert.equal(bundleCalls >= 1, true);
  });

  test('fails closed when probes never become ready', async () => {
    await assert.rejects(
      waitForReliabilityMetroReady(13007, 'android', {
        timeoutMs: 400,
        async probePackager() {
          return false;
        },
        async probeBundle() {
          return true;
        },
      }),
      /packager-status:running/,
    );
  });
});

describe('ensureReliabilityMetroReady', () => {
  test('reuses an already-ready Metro without spawning', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-metro-ready-'));
    let spawned = false;
    const handle = await ensureReliabilityMetroReady({
      slot: 1,
      platform: 'android',
      repoRoot: root,
      logPath: path.join(root, 'metro.log'),
      env: {},
      async probePackager() {
        return true;
      },
      spawnImpl: (() => {
        spawned = true;
        throw new Error('should not spawn');
      }) as never,
      async waitReady() {
        return undefined;
      },
    });
    assert.equal(handle.owned, false);
    assert.equal(handle.metroPort, 13007);
    assert.equal(spawned, false);
    await handle.stop();
  });

  test('spawns packager when host Metro is down and stops it on failure to ready', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-metro-spawn-'));
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      killed: boolean;
      exitCode: number | null;
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: (signal?: string) => boolean;
    };
    child.pid = 424242;
    child.killed = false;
    child.exitCode = null;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {
      child.killed = true;
      child.exitCode = 0;
      queueMicrotask(() => child.emit('close', 0));
      return true;
    };

    const originalKill = process.kill;
    let signaled: Array<{ pid: number; signal: string }> = [];
    (process as { kill: typeof process.kill }).kill = ((pid, signal) => {
      signaled.push({ pid, signal: String(signal) });
      if (pid === -child.pid) {
        child.kill();
        return true;
      }
      return originalKill(pid, signal as NodeJS.Signals);
    }) as typeof process.kill;

    let spawnArgs: string[] | undefined;
    try {
      await assert.rejects(
        ensureReliabilityMetroReady({
          slot: 1,
          platform: 'android',
          repoRoot: root,
          logPath: path.join(root, 'metro.log'),
          env: {
            RNGMA_E2E_SLOT: '1',
            RNGMA_E2E_PLATFORM: 'android',
          },
          spawnImpl: ((_bin, args) => {
            spawnArgs = args as string[];
            return child as never;
          }) as typeof import('node:child_process').spawn,
          async waitReady() {
            throw new Error('bundle never ready');
          },
        }),
        /bundle never ready/,
      );
    } finally {
      process.kill = originalKill;
    }
    assert.ok(spawnArgs?.includes('start'));
    assert.equal(child.killed, true);
    assert.equal(signaled.some(entry => entry.pid === -child.pid), true);
  });
});
