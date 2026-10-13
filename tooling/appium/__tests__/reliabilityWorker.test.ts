import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, test } from 'node:test';
import {
  buildReliabilityLayout,
  layoutDigest,
  layoutTestTotal,
} from '../src/reliabilityLayouts.ts';
import {
  createLogManager,
  decideLogRetention,
  DEFAULT_LOG_POLICY,
} from '../src/reliabilityLogs.ts';
import {
  parseReliabilityMode,
  RELIABILITY_MODES,
  reliabilityModePolicy,
} from '../src/reliabilityModes.ts';
import {
  acquireSingleSlot,
  createSlotOwnership,
  releaseSingleSlot,
} from '../src/reliabilityOwnership.ts';
import {
  createJobId,
  openReceiptStore,
  STARTUP_CELL_IDS,
  type ReliabilityJobIdentity,
} from '../src/reliabilityReceipts.ts';
import { createFlakeReducer } from '../src/reliabilityReducer.ts';
import {
  createDryRunReliabilityRunner,
  parseReliabilityWorkerArgv,
  RELIABILITY_RUNNER_BAIL_ENV,
  reliabilityShardEnv,
  runReliabilityWorker,
} from '../src/reliabilityWorker.ts';
import { SMOKE_SHARDS } from '../src/sessionShards.ts';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

const tempRoots: string[] = [];

function tempRoot(label: string): string {
  const root = mkdtempSync(path.join(tmpdir(), `rngma-reliability-${label}-`));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe('reliability modes', () => {
  test('exposes diagnose, burn-in, and qualify with runner bail off', () => {
    assert.deepEqual([...RELIABILITY_MODES], ['diagnose', 'burn-in', 'qualify']);
    for (const mode of RELIABILITY_MODES) {
      const policy = reliabilityModePolicy(mode);
      assert.equal(policy.runnerBail, false);
      assert.equal(policy.mochaBailWithinShard, true);
    }
    assert.equal(reliabilityModePolicy('qualify').creditsReceipts, true);
    assert.equal(reliabilityModePolicy('diagnose').creditsReceipts, false);
    assert.equal(reliabilityModePolicy('burn-in').creditsReceipts, false);
    assert.throws(() => parseReliabilityMode('soak'), /Unknown reliability mode/);
  });
});

describe('reliability layouts', () => {
  test('builds final and temporary layouts with stable digests', () => {
    const finalLayout = buildReliabilityLayout('final');
    assert.equal(finalLayout.kind, 'final');
    assert.equal(finalLayout.entries.length, SMOKE_SHARDS.length);
    assert.equal(
      finalLayout.digest,
      layoutDigest(finalLayout.kind, finalLayout.id, finalLayout.entries),
    );
    assert.equal(layoutTestTotal(finalLayout) > 0, true);

    const temporary = buildReliabilityLayout('temporary', SMOKE_SHARDS, {
      temporaryShardIds: [SMOKE_SHARDS[0]!.id],
    });
    assert.equal(temporary.entries.length, 1);
    assert.notEqual(temporary.digest, finalLayout.digest);
  });
});

describe('reliability receipts', () => {
  test('job ids are immutable and credits are exactly-once', () => {
    const root = tempRoot('receipts');
    const job: ReliabilityJobIdentity = {
      jobId: createJobId(() => '11111111-1111-1111-1111-111111111111'),
      mode: 'qualify',
      platform: 'android',
      slot: 1,
      layoutId: 'final-smoke',
      layoutDigest: 'abc',
      createdAt: '2026-10-13T00:00:00.000Z',
    };
    const store = openReceiptStore(job, root, {
      createReceiptId: (() => {
        let n = 0;
        return () => `rcpt_${++n}`;
      })(),
    });
    const first = store.append({
      iteration: 1,
      cellKind: 'test',
      cellId: 'banner',
      shardId: 'a-primary',
      outcome: 'pass',
      counted: true,
    });
    assert.equal(first.counted, true);
    const duplicate = store.append({
      iteration: 1,
      cellKind: 'test',
      cellId: 'banner',
      shardId: 'a-primary',
      outcome: 'pass',
      counted: true,
    });
    assert.equal(duplicate.counted, false);
    assert.match(duplicate.detail ?? '', /exactly-once/);
    assert.equal(store.countCredits({ cellKind: 'test', outcome: 'pass' }), 1);

    assert.throws(
      () =>
        openReceiptStore(
          { ...job, layoutDigest: 'changed' },
          root,
        ),
      /immutable/,
    );
  });
});

describe('reliability logs', () => {
  test('keeps full failure logs, samples pass logs, and enforces disk ceiling', async () => {
    assert.deepEqual(decideLogRetention('fail', 0, DEFAULT_LOG_POLICY), {
      action: 'keep-full',
      reason: 'failure',
    });
    assert.deepEqual(decideLogRetention('pass', 1, DEFAULT_LOG_POLICY), {
      action: 'discard',
      reason: 'pass-unsampled',
    });
    assert.deepEqual(decideLogRetention('pass', 0, DEFAULT_LOG_POLICY), {
      action: 'sample-compress',
      reason: 'pass-sample',
    });

    const root = tempRoot('logs');
    const logs = createLogManager(root, {
      ...DEFAULT_LOG_POLICY,
      diskCeilingBytes: 200,
      passSampleEvery: 1,
      sampleHeadLines: 2,
      sampleTailLines: 2,
    });
    const failPath = logs.shardLogPath(1, 'a-primary');
    mkdirSync(path.dirname(failPath), { recursive: true });
    writeFileSync(failPath, `${'failure-line\n'.repeat(20)}`);
    const fail = await logs.finalizeShardLog({
      iteration: 1,
      shardId: 'a-primary',
      outcome: 'fail',
      passIndex: -1,
    });
    assert.equal(fail.decision.action, 'keep-full');
    assert.equal(existsSync(failPath), true);

    for (let index = 0; index < 3; index += 1) {
      const shardId = `pass-${index}`;
      const passPath = logs.shardLogPath(1, shardId);
      mkdirSync(path.dirname(passPath), { recursive: true });
      writeFileSync(passPath, `${'pass-line\n'.repeat(50)}`);
      await logs.finalizeShardLog({
        iteration: 1,
        shardId,
        outcome: 'pass',
        passIndex: index,
      });
    }
    const enforced = logs.enforceDiskCeiling();
    assert.equal(enforced.deleted.length >= 1, true);
    // Ceiling deletes sampled pass archives only; full failure logs are retained.
    assert.equal(existsSync(failPath), true);
    assert.equal(enforced.bytesAfter >= fail.bytesRetained, true);
  });
});

describe('reliability ownership', () => {
  test('transitions through acquire, run, and release', async () => {
    const ownership = createSlotOwnership(1, 'android');
    assert.equal(ownership.state, 'not-requested');
    await acquireSingleSlot(ownership, {
      async checkClear() {
        return true;
      },
    });
    assert.equal(ownership.state, 'owned-idle');
    ownership.apply('start-work');
    assert.equal(ownership.state, 'owned-running');
    ownership.apply('finish-work');
    await releaseSingleSlot(ownership, async () => undefined);
    assert.equal(ownership.state, 'released');
  });

  test('force-acquire path displaces then owns', async () => {
    const ownership = createSlotOwnership(4, 'ios');
    let clearCalls = 0;
    let forced = false;
    await acquireSingleSlot(
      ownership,
      {
        async checkClear() {
          clearCalls += 1;
          return forced;
        },
        async forceAcquire() {
          forced = true;
        },
      },
      { allowForceAcquire: true },
    );
    assert.equal(ownership.state, 'owned-idle');
    assert.equal(clearCalls >= 2, true);
  });
});

describe('reliability worker', () => {
  test('wires named scripts at root and workspace', () => {
    const root = JSON.parse(
      readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const workspace = JSON.parse(
      readFileSync(
        path.join(repositoryRoot, 'tooling/appium/package.json'),
        'utf8',
      ),
    ) as { scripts: Record<string, string> };
    assert.equal(
      root.scripts['tests:appium:reliability'],
      'yarn workspace @invertase/rngma-appium reliability',
    );
    assert.equal(
      workspace.scripts.reliability,
      'tsx ./scripts/reliability-worker.ts',
    );
  });

  test('parses mode/platform/slot and disables runner bail in shard env', () => {
    const options = parseReliabilityWorkerArgv(
      [
        'qualify',
        '--platform=android',
        '--slot=1',
        '--layout=temporary',
        '--iterations=2',
        '--dry-run',
      ],
      {},
    );
    assert.equal(options.mode, 'qualify');
    assert.equal(options.platform, 'android');
    assert.equal(options.slot, 1);
    assert.equal(options.layoutKind, 'temporary');
    assert.equal(options.iterations, 2);
    assert.equal(options.dryRun, true);
    const env = reliabilityShardEnv(options, './test/specs/formats.smoke.a-primary.spec.ts', {});
    assert.equal(env[RELIABILITY_RUNNER_BAIL_ENV], '0');
    assert.equal(env.RNGMA_E2E_SLOT, '1');
    assert.equal(env.RNGMA_E2E_METRO_SLOT, '1');
    assert.equal(env.RNGMA_METRO_PORT, '13007');
    assert.match(env.RNGMA_METRO_CACHE_ROOT ?? '', /slot-1\/android\/cache$/);
  });

  test('parses positional mode after space-separated flag values', () => {
    // Equivalent to: yarn tests:appium:reliability --slot 1 diagnose --platform android --dry-run
    const options = parseReliabilityWorkerArgv(
      ['--slot', '1', 'diagnose', '--platform', 'android', '--dry-run'],
      {},
    );
    assert.equal(options.mode, 'diagnose');
    assert.equal(options.platform, 'android');
    assert.equal(options.slot, 1);
    assert.equal(options.dryRun, true);
  });

  test('dry-run qualify pilot credits startup/preamble/test and continues after shard fail', async () => {
    const root = tempRoot('worker');
    const layout = buildReliabilityLayout('temporary', SMOKE_SHARDS, {
      temporaryShardIds: [SMOKE_SHARDS[0]!.id, SMOKE_SHARDS[1]!.id],
    });
    const failCase = layout.entries[0]!.caseIds[0]!;
    const summary = await runReliabilityWorker(
      {
        mode: 'qualify',
        platform: 'android',
        slot: 1,
        layoutKind: 'temporary',
        iterations: 1,
        receiptRoot: path.join(root, 'receipts'),
        logRoot: path.join(root, 'logs'),
        dryRun: true,
        allowForceAcquire: false,
        layout,
        createJobId: () => 'job_pilot0001',
        now: () => new Date('2026-10-13T21:00:00.000Z'),
      },
      {
        runner: createDryRunReliabilityRunner({
          failAfterCase: {
            shardId: layout.entries[0]!.shardId,
            caseId: failCase,
          },
        }),
      },
    );

    assert.equal(summary.job.jobId, 'job_pilot0001');
    assert.equal(summary.runnerBail, false);
    assert.equal(summary.mochaBailWithinShard, true);
    assert.equal(summary.ownershipFinal, 'released');
    assert.equal(summary.shardFailures, 1);
    assert.equal(summary.failureArtifacts, 1);
    assert.equal(summary.iterationsCompleted, 1);
    // Both shards still record all startup cells (including first-shard mocha bail).
    const passingStartupShards = layout.entries.length;
    assert.equal(
      summary.credited.startup,
      STARTUP_CELL_IDS.length * passingStartupShards,
    );
    assert.equal(summary.credited.preamble >= 1, true);
    assert.equal(summary.credited.test >= 1, true);
    assert.equal(existsSync(summary.receiptsPath), true);
    const lines = readFileSync(summary.receiptsPath, 'utf8')
      .trim()
      .split('\n');
    assert.equal(lines.length >= 1, true);
    const startupRows = lines
      .map(line => JSON.parse(line) as { cellKind: string; shardId?: string; counted: boolean })
      .filter(row => row.cellKind === 'startup');
    assert.equal(startupRows.length, STARTUP_CELL_IDS.length * passingStartupShards);
    assert.equal(
      new Set(startupRows.map(row => row.shardId)).size,
      passingStartupShards,
    );
  });

  test('dry-run diagnose records receipt rows without statistical credits', async () => {
    const root = tempRoot('diagnose');
    const layout = buildReliabilityLayout('temporary', SMOKE_SHARDS, {
      temporaryShardIds: [SMOKE_SHARDS[0]!.id],
    });
    const summary = await runReliabilityWorker(
      {
        mode: 'diagnose',
        platform: 'android',
        slot: 1,
        layoutKind: 'temporary',
        iterations: 1,
        receiptRoot: path.join(root, 'receipts'),
        logRoot: path.join(root, 'logs'),
        dryRun: true,
        allowForceAcquire: false,
        layout,
        createJobId: () => 'job_diagnose0001',
        now: () => new Date('2026-10-13T21:00:00.000Z'),
      },
      {
        runner: createDryRunReliabilityRunner(),
      },
    );

    assert.equal(summary.credited.startup, 0);
    assert.equal(summary.credited.preamble, 0);
    assert.equal(summary.credited.test, 0);
    const rows = readFileSync(summary.receiptsPath, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as { counted: boolean });
    assert.equal(rows.length > 0, true);
    assert.equal(
      rows.every(row => row.counted === false),
      true,
    );
  });

  test('diagnose/burn-in on final layout do not mint final-layout risk credits', async () => {
    const root = tempRoot('risk-scope');
    const layout = buildReliabilityLayout('final', SMOKE_SHARDS);
    const caseId = layout.entries[0]!.caseIds[0]!;
    assert.equal(layout.entries[0]!.caseIds.length > 1, true);

    for (const mode of ['diagnose', 'burn-in'] as const) {
      const reducer = createFlakeReducer({
        artifactRoot: path.join(root, `${mode}-artifacts`),
      });
      await runReliabilityWorker(
        {
          mode,
          platform: 'android',
          slot: 1,
          layoutKind: 'final',
          iterations: 1,
          receiptRoot: path.join(root, `${mode}-receipts`),
          logRoot: path.join(root, `${mode}-logs`),
          dryRun: true,
          allowForceAcquire: false,
          layout,
          createJobId: () => `job_${mode}0001`,
          now: () => new Date('2026-10-13T21:00:00.000Z'),
        },
        {
          runner: createDryRunReliabilityRunner(),
          reducer,
        },
      );
      const cell = reducer.ledger.get({ caseId, platform: 'android' });
      assert.equal(cell.consecutiveFinalLayoutGreens, 0, mode);
      assert.equal(cell.consecutiveCandidateShardGreens >= 1, true, mode);
    }

    const qualifyReducer = createFlakeReducer({
      artifactRoot: path.join(root, 'qualify-artifacts'),
    });
    await runReliabilityWorker(
      {
        mode: 'qualify',
        platform: 'android',
        slot: 1,
        layoutKind: 'final',
        iterations: 1,
        receiptRoot: path.join(root, 'qualify-receipts'),
        logRoot: path.join(root, 'qualify-logs'),
        dryRun: true,
        allowForceAcquire: false,
        layout,
        createJobId: () => 'job_qualify0001',
        now: () => new Date('2026-10-13T21:00:00.000Z'),
      },
      {
        runner: createDryRunReliabilityRunner(),
        reducer: qualifyReducer,
      },
    );
    const qualifyCell = qualifyReducer.ledger.get({ caseId, platform: 'android' });
    assert.equal(qualifyCell.consecutiveFinalLayoutGreens >= 1, true);
  });
});
