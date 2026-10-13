import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildReliabilityLayout,
  layoutTestTotal,
  parseLayoutKind,
  type LayoutKind,
  type ReliabilityLayout,
} from './reliabilityLayouts.ts';
import {
  createLogManager,
  DEFAULT_LOG_POLICY,
  type LogManager,
  type LogPolicy,
} from './reliabilityLogs.ts';
import {
  parseReliabilityMode,
  reliabilityModePolicy,
  type ReliabilityMode,
} from './reliabilityModes.ts';
import {
  acquireSingleSlot,
  createSlotOwnership,
  releaseSingleSlot,
  type OwnershipState,
  type SlotAcquireDeps,
  type SlotOwnership,
} from './reliabilityOwnership.ts';
import {
  createJobId,
  openReceiptStore,
  STARTUP_CELL_IDS,
  type ReceiptStore,
  type ReliabilityJobIdentity,
} from './reliabilityReceipts.ts';
import { reliabilityMetroEnv } from './reliabilityMetro.ts';
import {
  createEvidenceLedger,
  defaultCellDependencyDigests,
  type EvidenceLedger,
} from './reliabilityEvidence.ts';
import {
  createFlakeReducer,
  type FlakeReducer,
} from './reliabilityReducer.ts';
import { greenScopeForWorkerPass } from './reliabilityRisk.ts';
import {
  configurationForPlatformBackend,
  isQualifyingConfiguration,
  STATS_PROJECTION_DISCLAIMER,
  type StatsProjection,
} from './reliabilityStats.ts';
import { assertRngmaSlotAllowed, parseSlot } from './slots.ts';
import type { ShardId } from './sessionShards.ts';

export const RELIABILITY_RUNNER_BAIL_ENV = 'RNGMA_WDIO_RUNNER_BAIL';

export type ReliabilityPlatform = 'android' | 'ios';

export type ShardRunRequest = {
  iteration: number;
  shardId: ShardId;
  spec: string;
  caseIds: readonly string[];
  logPath: string;
  env: NodeJS.ProcessEnv;
};

export type ShardRunResult = {
  /** Overall shard process outcome after mocha bail within the shard. */
  outcome: 'pass' | 'fail' | 'cancelled';
  startup: Record<(typeof STARTUP_CELL_IDS)[number], 'pass' | 'fail' | 'skipped'>;
  preamble: 'pass' | 'fail' | 'skipped';
  /** Per-case outcomes in layout order. Remaining cases after mocha bail are skipped. */
  tests: Array<{ caseId: string; outcome: 'pass' | 'fail' | 'skipped' | 'cancelled' }>;
  detail?: string;
};

export type ReliabilityRunner = {
  runShard(request: ShardRunRequest): Promise<ShardRunResult>;
};

export type ReliabilityWorkerOptions = {
  mode: ReliabilityMode;
  platform: ReliabilityPlatform;
  slot: number;
  layoutKind: LayoutKind;
  iterations: number;
  receiptRoot: string;
  logRoot: string;
  /** When true, do not invoke live device acquire — used by unit/harness pilots. */
  dryRun: boolean;
  allowForceAcquire: boolean;
  /**
   * Android backend selection for statistical configuration mapping.
   * Classic is canary-only and never receives statistical credits.
   */
  androidBackend?: 'classic' | 'nextgen';
  temporaryShardIds?: readonly ShardId[];
  layout?: ReliabilityLayout;
  logPolicy?: LogPolicy;
  now?: () => Date;
  createJobId?: () => string;
};

export type ReliabilityWorkerSummary = {
  job: ReliabilityJobIdentity;
  mode: ReliabilityMode;
  platform: ReliabilityPlatform;
  slot: number;
  layout: ReliabilityLayout;
  iterationsPlanned: number;
  iterationsCompleted: number;
  runnerBail: false;
  mochaBailWithinShard: true;
  ownershipFinal: OwnershipState;
  receiptsPath: string;
  credited: {
    startup: number;
    preamble: number;
    test: number;
  };
  shardFailures: number;
  /** Exact failure artifacts written by the adaptive flake reducer. */
  failureArtifacts: number;
  /**
   * Non-authoritative statistical projection from this worker's evidence ledger.
   * Live dashboards must keep the manual/untested disclaimer until later wire-up.
   */
  statsProjection: StatsProjection;
  diskBytes: number;
  diskCeilingBytes: number;
};

function parsePlatform(value: string | undefined): ReliabilityPlatform {
  if (value !== 'android' && value !== 'ios') {
    throw new Error(`platform must be android or ios; received "${value ?? ''}".`);
  }
  return value;
}

function parseIterations(value: string | undefined, fallback: number): number {
  if (value == null || value === '') return fallback;
  if (!/^\d+$/.test(value)) {
    throw new Error(`iterations must be a positive integer; received "${value}".`);
  }
  const parsed = Number(value);
  if (parsed < 1) {
    throw new Error(`iterations must be >= 1; received ${parsed}.`);
  }
  return parsed;
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  for (const argument of argv) {
    if (argument.startsWith(prefix)) {
      return argument.slice(prefix.length);
    }
  }
  const index = argv.indexOf(name);
  if (index >= 0) {
    return argv[index + 1];
  }
  return undefined;
}

function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(name);
}

/** Space-separated flags whose next argv token is a value, not a positional mode. */
const RELIABILITY_FLAGS_WITH_VALUE = new Set([
  '--mode',
  '--platform',
  '--slot',
  '--layout',
  '--iterations',
  '--receipt-root',
  '--log-root',
  '--temporary-shards',
  '--android-backend',
]);

function parseAndroidBackend(
  value: string | undefined,
): 'classic' | 'nextgen' | undefined {
  if (value == null || value === '') return undefined;
  if (value === 'classic' || value === 'legacy') return 'classic';
  if (value === 'nextgen') return 'nextgen';
  throw new Error(
    `android-backend must be classic, legacy, or nextgen; received "${value}".`,
  );
}

/**
 * First non-flag positional that is not a known flag's value (e.g. `--slot 1 diagnose`).
 */
function findPositionalReliabilityMode(argv: readonly string[]): string | undefined {
  let index = 0;
  while (index < argv.length) {
    const argument = argv[index]!;
    if (argument.startsWith('-')) {
      const equals = argument.indexOf('=');
      const flagName = equals >= 0 ? argument.slice(0, equals) : argument;
      if (equals < 0 && RELIABILITY_FLAGS_WITH_VALUE.has(flagName)) {
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    return argument;
  }
  return undefined;
}

/**
 * Parse reliability worker CLI argv.
 * Modes may be positional (`diagnose`) or `--mode=diagnose`.
 */
export function parseReliabilityWorkerArgv(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): ReliabilityWorkerOptions {
  const positionalMode = findPositionalReliabilityMode(argv);
  const mode = parseReliabilityMode(flagValue(argv, '--mode') ?? positionalMode);
  const policy = reliabilityModePolicy(mode);
  const platform = parsePlatform(
    flagValue(argv, '--platform') ?? env.RNGMA_E2E_PLATFORM,
  );
  const slotRaw = flagValue(argv, '--slot') ?? env.RNGMA_E2E_SLOT;
  const slot = parseSlot(slotRaw);
  if (slot == null) {
    throw new Error('Reliability worker requires --slot or RNGMA_E2E_SLOT.');
  }
  assertRngmaSlotAllowed(slot);
  const layoutKind = parseLayoutKind(flagValue(argv, '--layout'));
  const iterations = parseIterations(flagValue(argv, '--iterations'), policy.defaultIterations);
  const receiptRoot =
    flagValue(argv, '--receipt-root') ??
    path.join('/tmp/rngma-e2e-reliability', 'receipts');
  const logRoot =
    flagValue(argv, '--log-root') ?? path.join('/tmp/rngma-e2e-reliability', 'logs');
  const temporary = flagValue(argv, '--temporary-shards');
  const androidBackend = parseAndroidBackend(
    flagValue(argv, '--android-backend') ?? env.RNGMA_ANDROID_BACKEND,
  );
  return {
    mode,
    platform,
    slot,
    layoutKind,
    iterations,
    receiptRoot,
    logRoot,
    dryRun: hasFlag(argv, '--dry-run'),
    allowForceAcquire:
      hasFlag(argv, '--authorize-force-acquire') || env.RNGMA_E2E_FORCE_ACQUIRE === '1',
    ...(androidBackend != null ? { androidBackend } : {}),
    ...(temporary
      ? { temporaryShardIds: temporary.split(',') as ShardId[] }
      : {}),
  };
}

/** Env for a single shard WDIO child under the reliability worker. */
export function reliabilityShardEnv(
  options: Pick<ReliabilityWorkerOptions, 'platform' | 'slot'>,
  spec: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...reliabilityMetroEnv(options.slot, options.platform, baseEnv),
    RNGMA_WDIO_SPEC: spec,
    [RELIABILITY_RUNNER_BAIL_ENV]: '0',
  };
}

export type LiveAppiumShardSpawnRequest = {
  platform: ReliabilityPlatform;
  slot: number;
  spec: string;
  logPath: string;
  env: NodeJS.ProcessEnv;
};

export type LiveAppiumShardSpawnResult = {
  exitCode: number;
  /** Optional structured outcomes when the spawn wrapper can parse them. */
  startup?: ShardRunResult['startup'];
  preamble?: ShardRunResult['preamble'];
  tests?: ShardRunResult['tests'];
  detail?: string;
};

/**
 * Spawn a child and tee stdout/stderr into `logPath` (append; the worker pre-creates
 * the file with `wx`). Truncated text is returned as `detail` for receipts; full
 * output stays on disk for failure retention / pass sampling / disk ceiling.
 */
export function spawnProcessToLog(options: {
  bin: string;
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  logPath: string;
}): Promise<LiveAppiumShardSpawnResult> {
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(options.logPath), { recursive: true });
    const log = createWriteStream(options.logPath, { flags: 'a' });
    const child = spawn(options.bin, [...options.args], {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    const onChunk = (chunk: Buffer) => {
      chunks.push(chunk);
      log.write(chunk);
    };
    child.stdout?.on('data', onChunk);
    child.stderr?.on('data', onChunk);
    child.on('error', error => {
      log.end(() => reject(error));
    });
    child.on('close', code => {
      log.end(() => {
        const detail = Buffer.concat(chunks).toString('utf8').slice(-4000);
        resolve({
          exitCode: code ?? 1,
          detail:
            detail.length > 0
              ? detail
              : `process exited ${code ?? 1} (log ${options.logPath})`,
        });
      });
    });
  });
}

/**
 * Live Appium shard runner path for the reliability worker.
 * Inject `spawn` in tests; production wiring launches the platform WDIO conf.
 * Prefer `--dry-run` / mocked runners on product-edit checkouts — do not share
 * a checkout with live campaign Metros.
 */
export function createLiveAppiumShardRunner(deps: {
  platform: ReliabilityPlatform;
  slot: number;
  spawn: (request: LiveAppiumShardSpawnRequest) => Promise<LiveAppiumShardSpawnResult>;
}): ReliabilityRunner {
  return {
    async runShard(request) {
      const result = await deps.spawn({
        platform: deps.platform,
        slot: deps.slot,
        spec: request.spec,
        logPath: request.logPath,
        env: request.env,
      });
      const passed = result.exitCode === 0;
      const startup =
        result.startup ??
        ({
          'session-create': passed ? 'pass' : 'fail',
          'app-launch': passed ? 'pass' : 'skipped',
          'bundle-load': passed ? 'pass' : 'skipped',
          'gallery-ready': passed ? 'pass' : 'skipped',
        } as ShardRunResult['startup']);
      const preamble = result.preamble ?? (passed ? 'pass' : 'skipped');
      const tests =
        result.tests ??
        request.caseIds.map(caseId => ({
          caseId,
          outcome: (passed ? 'pass' : 'skipped') as 'pass' | 'skipped',
        }));
      return {
        outcome: passed ? 'pass' : 'fail',
        startup,
        preamble,
        tests,
        detail: result.detail ?? (passed ? 'live appium shard pass' : 'live appium shard fail'),
      };
    },
  };
}

function recordStartup(
  store: ReceiptStore,
  iteration: number,
  shardId: ShardId,
  startup: ShardRunResult['startup'],
  counted: boolean,
): Record<(typeof STARTUP_CELL_IDS)[number], string> {
  const receiptIds = {} as Record<(typeof STARTUP_CELL_IDS)[number], string>;
  for (const cellId of STARTUP_CELL_IDS) {
    const receipt = store.append({
      iteration,
      cellKind: 'startup',
      cellId,
      shardId,
      outcome: startup[cellId],
      counted: counted && startup[cellId] === 'pass',
    });
    receiptIds[cellId] = receipt.receiptId;
  }
  return receiptIds;
}

export async function runReliabilityWorker(
  options: ReliabilityWorkerOptions,
  deps: {
    runner: ReliabilityRunner;
    acquire?: SlotAcquireDeps;
    release?: (slot: number, platform: ReliabilityPlatform) => Promise<void>;
    logs?: LogManager;
    /** Optional adaptive flake reducer; defaults to a store under receiptRoot. */
    reducer?: FlakeReducer;
    /** Optional statistical evidence ledger; defaults to an in-memory ledger. */
    evidence?: EvidenceLedger;
  },
): Promise<ReliabilityWorkerSummary> {
  const policy = reliabilityModePolicy(options.mode);
  const layout =
    options.layout ??
    buildReliabilityLayout(options.layoutKind, undefined, {
      temporaryShardIds: options.temporaryShardIds,
    });
  const now = options.now ?? (() => new Date());
  const job: ReliabilityJobIdentity = {
    jobId: (options.createJobId ?? createJobId)(),
    mode: options.mode,
    platform: options.platform,
    slot: options.slot,
    layoutId: layout.id,
    layoutDigest: layout.digest,
    createdAt: now().toISOString(),
  };

  mkdirSync(options.receiptRoot, { recursive: true });
  mkdirSync(options.logRoot, { recursive: true });
  const store = openReceiptStore(job, options.receiptRoot, { now });
  const logs =
    deps.logs ??
    createLogManager(
      path.join(options.logRoot, job.jobId),
      options.logPolicy ?? DEFAULT_LOG_POLICY,
    );
  const reducer =
    deps.reducer ??
    createFlakeReducer({
      artifactRoot: path.join(options.receiptRoot, 'failure-artifacts'),
      now,
    });
  const evidence = deps.evidence ?? createEvidenceLedger({ now });
  const configuration = configurationForPlatformBackend(
    options.platform,
    options.platform === 'android' ? (options.androidBackend ?? 'nextgen') : undefined,
  );
  const qualifyingConfiguration = isQualifyingConfiguration(configuration)
    ? configuration
    : null;
  const statisticalCredits = policy.creditsReceipts && qualifyingConfiguration != null;

  const creditStatistical = (
    cellKind: 'startup' | 'preamble' | 'test',
    cellId: string,
    outcome: 'pass' | 'fail' | 'skipped' | 'cancelled',
    receiptId?: string,
  ): void => {
    if (!statisticalCredits || qualifyingConfiguration == null) return;
    if (outcome !== 'pass' && outcome !== 'fail') return;
    const cellKey = {
      configuration: qualifyingConfiguration,
      cellKind,
      cellId,
    };
    evidence.credit({
      cellKey,
      outcome,
      retainedInSample: outcome === 'fail',
      dependencyDigests: defaultCellDependencyDigests({
        cellKey,
        layoutDigest: layout.digest,
      }),
      ...(receiptId != null ? { receiptId } : {}),
    });
  };

  const ownership: SlotOwnership = createSlotOwnership(options.slot, options.platform);

  if (options.dryRun) {
    ownership.apply('request');
    ownership.apply('acquired');
  } else {
    if (deps.acquire == null) {
      throw new Error('Live reliability runs require acquire dependencies.');
    }
    await acquireSingleSlot(ownership, deps.acquire, {
      allowForceAcquire: options.allowForceAcquire,
    });
  }

  let iterationsCompleted = 0;
  let shardFailures = 0;
  let passIndex = 0;
  let failureArtifacts = 0;

  try {
    for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
      ownership.apply('start-work');
      let iterationShardFailures = 0;
      for (const entry of layout.entries) {
        const logPath = logs.shardLogPath(iteration, entry.shardId);
        mkdirSync(path.dirname(logPath), { recursive: true });
        writeFileSync(logPath, '', { flag: 'wx' });
        const result = await deps.runner.runShard({
          iteration,
          shardId: entry.shardId,
          spec: entry.spec,
          caseIds: entry.caseIds,
          logPath,
          env: reliabilityShardEnv(options, entry.spec),
        });

        const startupReceiptIds = recordStartup(
          store,
          iteration,
          entry.shardId,
          result.startup,
          policy.creditsReceipts,
        );
        for (const cellId of STARTUP_CELL_IDS) {
          creditStatistical(
            'startup',
            cellId,
            result.startup[cellId],
            startupReceiptIds[cellId],
          );
        }
        const preambleReceipt = store.append({
          iteration,
          cellKind: 'preamble',
          cellId: 'gallery-home',
          shardId: entry.shardId,
          outcome: result.preamble,
          counted: policy.creditsReceipts && result.preamble === 'pass',
        });
        creditStatistical(
          'preamble',
          'gallery-home',
          result.preamble,
          preambleReceipt.receiptId,
        );

        const expectedCases = [...entry.caseIds];
        const reported = new Map(result.tests.map(test => [test.caseId, test.outcome]));
        const failedCaseIds: string[] = [];
        for (const caseId of expectedCases) {
          const outcome = reported.get(caseId) ?? 'skipped';
          const testReceipt = store.append({
            iteration,
            cellKind: 'test',
            cellId: caseId,
            shardId: entry.shardId,
            outcome,
            counted: policy.creditsReceipts && outcome === 'pass',
          });
          creditStatistical('test', caseId, outcome, testReceipt.receiptId);
          if (outcome === 'pass') {
            const scope = greenScopeForWorkerPass({
              mode: options.mode,
              layoutKind: options.layoutKind,
              coRunCaseCount: expectedCases.length,
            });
            reducer.recordPass(caseId, options.platform, scope);
          } else if (outcome === 'fail') {
            failedCaseIds.push(caseId);
          }
          reported.delete(caseId);
        }
        for (const [caseId, outcome] of reported) {
          store.append({
            iteration,
            cellKind: 'test',
            cellId: caseId,
            shardId: entry.shardId,
            outcome,
            counted: false,
            detail: 'not in layout digest',
          });
        }

        for (const caseId of failedCaseIds) {
          reducer.reduceFailure({
            caseId,
            platform: options.platform,
            detail: result.detail,
            neighbors: expectedCases.filter(id => id !== caseId),
            shardId: entry.shardId,
            jobId: job.jobId,
            iteration,
            logPath,
          });
          failureArtifacts += 1;
        }

        if (result.outcome !== 'pass') {
          shardFailures += 1;
          iterationShardFailures += 1;
        }
        await logs.finalizeShardLog({
          iteration,
          shardId: entry.shardId,
          outcome: result.outcome,
          passIndex: result.outcome === 'pass' ? passIndex : -1,
        });
        if (result.outcome === 'pass') {
          passIndex += 1;
        }
        logs.enforceDiskCeiling();
        // Runner-level bail is off: continue to the next shard regardless.
      }
      if (qualifyingConfiguration != null && statisticalCredits && options.layoutKind === 'final') {
        // Suite signal is independent of per-cell confidence and never erases
        // earlier cell receipts when a later shard in another iteration fails.
        evidence.creditSuite({
          configuration: qualifyingConfiguration,
          outcome: iterationShardFailures === 0 ? 'pass' : 'fail',
        });
      }
      ownership.apply('finish-work');
      iterationsCompleted += 1;
    }
  } finally {
    if (options.dryRun) {
      if (ownership.state === 'owned-idle' || ownership.state === 'owned-running') {
        ownership.apply('begin-release');
        ownership.apply('release-ok');
      }
    } else if (deps.release != null) {
      if (ownership.state === 'owned-idle' || ownership.state === 'owned-running') {
        try {
          await releaseSingleSlot(ownership, deps.release);
        } catch {
          // release-failed already applied; surface via ownershipFinal.
        }
      }
    }
  }

  const statsProjection = evidence.projection();
  if (statsProjection.disclaimer !== STATS_PROJECTION_DISCLAIMER) {
    throw new Error('Statistical projection missing required non-authoritative disclaimer.');
  }

  const summary: ReliabilityWorkerSummary = {
    job,
    mode: options.mode,
    platform: options.platform,
    slot: options.slot,
    layout,
    iterationsPlanned: options.iterations,
    iterationsCompleted,
    runnerBail: false,
    mochaBailWithinShard: true,
    ownershipFinal: ownership.state,
    receiptsPath: store.path,
    credited: {
      startup: store.countCredits({ cellKind: 'startup', outcome: 'pass' }),
      preamble: store.countCredits({ cellKind: 'preamble', outcome: 'pass' }),
      test: store.countCredits({ cellKind: 'test', outcome: 'pass' }),
    },
    shardFailures,
    failureArtifacts,
    statsProjection,
    diskBytes: logs.measureDiskUsage(),
    diskCeilingBytes: logs.policy.diskCeilingBytes,
  };

  writeFileSync(
    path.join(options.receiptRoot, `${job.jobId}.summary.json`),
    `${JSON.stringify(
      {
        ...summary,
        layoutTestTotal: layoutTestTotal(layout),
      },
      null,
      2,
    )}\n`,
  );
  return summary;
}

/** Deterministic dry-run runner for unit/harness pilots (no devices). */
export function createDryRunReliabilityRunner(
  options: {
    failShardIds?: ReadonlySet<string>;
    /** Simulate mocha bail within a shard after this case fails. */
    failAfterCase?: { shardId: string; caseId: string };
  } = {},
): ReliabilityRunner {
  return {
    async runShard(request) {
      const failWhole = options.failShardIds?.has(request.shardId) ?? false;
      writeFileSync(
        request.logPath,
        [
          `[reliability-dry-run] shard=${request.shardId}`,
          `spec=${request.spec}`,
          `iteration=${request.iteration}`,
          `cases=${request.caseIds.join(',')}`,
          failWhole ? 'outcome=fail' : 'outcome=pass',
          '',
        ].join('\n'),
        { flag: 'a' },
      );
      if (failWhole) {
        return {
          outcome: 'fail',
          startup: {
            'session-create': 'pass',
            'app-launch': 'pass',
            'bundle-load': 'pass',
            'gallery-ready': 'fail',
          },
          preamble: 'skipped',
          tests: request.caseIds.map(caseId => ({ caseId, outcome: 'skipped' as const })),
          detail: 'dry-run forced shard failure',
        };
      }
      const bail = options.failAfterCase;
      const tests: ShardRunResult['tests'] = [];
      let failed = false;
      for (const caseId of request.caseIds) {
        if (failed) {
          tests.push({ caseId, outcome: 'skipped' });
          continue;
        }
        if (bail && bail.shardId === request.shardId && bail.caseId === caseId) {
          tests.push({ caseId, outcome: 'fail' });
          failed = true;
          continue;
        }
        tests.push({ caseId, outcome: 'pass' });
      }
      return {
        outcome: failed ? 'fail' : 'pass',
        startup: {
          'session-create': 'pass',
          'app-launch': 'pass',
          'bundle-load': 'pass',
          'gallery-ready': 'pass',
        },
        preamble: 'pass',
        tests,
        detail: failed ? 'dry-run mocha-bail within shard' : 'dry-run success',
      };
    },
  };
}
