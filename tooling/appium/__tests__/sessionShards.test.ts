import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PUBLIC_API_CONTRACTS } from '../src/contracts.ts';
import {
  NAVIGATION_SMOKE_CASES,
  NATIVE_RNGMA_TESTING_PROBE,
  REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS,
} from '../src/formats.ts';
import { PARALLEL_ASSIGNMENTS } from '../src/parallelPlan.ts';
import {
  deriveSmokeShards,
  SESSION_PREAMBLE_TESTS,
  SESSION_TEST_CAP,
  SHARD_POSITIONS,
  SMOKE_CASES,
  SMOKE_SHARDS,
  SMOKE_SHARD_TEST_TOTAL,
  smokeShard,
  type SmokeShardCase,
} from '../src/sessionShards.ts';
import { smokeSpecPath, WDIO_SMOKE_SPECS } from '../src/wdioSpecs.ts';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function syntheticCases(count: number): SmokeShardCase[] {
  return Array.from({ length: count }, (_unused, index) => ({
    kind: 'navigation' as const,
    id: `gma.format.synthetic-${index}`,
    testTitle: `opens synthetic ${index}`,
    navigation: {
      id: `gma.format.synthetic-${index}`,
      title: `synthetic ${index}`,
      containerId: `gma.format.synthetic-${index}`,
      contract: 'navigation' as const,
    },
  }));
}

function requestOutcomeCaseIds(): string[] {
  return SMOKE_CASES.flatMap(smokeCase =>
    smokeCase.kind === 'request-outcome' ? [smokeCase.id] : [],
  );
}

test('every smoke case comes from the contract inventories, once', () => {
  assert.equal(
    SMOKE_CASES.length,
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.length + NAVIGATION_SMOKE_CASES.length + 1,
  );
  assert.deepEqual(
    requestOutcomeCaseIds(),
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.map(contract => contract.id),
  );
  assert.deepEqual(
    SMOKE_CASES.flatMap(smokeCase =>
      smokeCase.kind === 'navigation' ? [smokeCase.navigation] : [],
    ),
    [...NAVIGATION_SMOKE_CASES],
  );
  assert.deepEqual(
    SMOKE_CASES.flatMap(smokeCase => (smokeCase.kind === 'probe' ? [smokeCase.probe] : [])),
    [NATIVE_RNGMA_TESTING_PROBE],
  );
  assert.ok(SMOKE_CASES.every(smokeCase => smokeCase.testTitle.trim().length > 0));
});

test('request-outcome shard cases cover every contracts.ts e2e-outcome behavior', () => {
  const dispositioned = new Set(
    PUBLIC_API_CONTRACTS.flatMap(contract =>
      contract.disposition === 'e2e-outcome' ? [contract.contractId] : [],
    ),
  );
  for (const contractId of dispositioned) {
    assert.ok(
      requestOutcomeCaseIds().includes(contractId),
      `missing request-outcome smoke case for ${contractId}`,
    );
  }
});

test('request-outcome contracts are packed before navigation smoke cases', () => {
  const firstNavigationIndex = SMOKE_CASES.findIndex(smokeCase => smokeCase.kind === 'navigation');
  assert.equal(firstNavigationIndex, REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.length);
});

test('derived shards partition every case in order without empties', () => {
  assert.deepEqual(
    SMOKE_SHARDS.flatMap(shard => shard.cases),
    [...SMOKE_CASES],
  );
  assert.ok(SMOKE_SHARDS.every(shard => shard.cases.length > 0));
  assert.ok(
    SMOKE_SHARDS.every(shard => shard.testCount === SESSION_PREAMBLE_TESTS + shard.cases.length),
  );
  assert.equal(
    SMOKE_SHARD_TEST_TOTAL,
    SMOKE_CASES.length + SMOKE_SHARDS.length * SESSION_PREAMBLE_TESTS,
  );
  // Sizes are balanced, so no positional session becomes the long pole.
  const sizes = SMOKE_SHARDS.map(shard => shard.cases.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  console.log(
    `[smoke-shards] ${JSON.stringify({
      cap: SESSION_TEST_CAP,
      total: SMOKE_SHARD_TEST_TOTAL,
      shards: SMOKE_SHARDS.map(shard => ({ id: shard.id, tests: shard.testCount })),
    })}`,
  );
});

test('no derived session exceeds the UiAutomator2 cap', () => {
  assert.ok(SMOKE_SHARDS.every(shard => shard.testCount <= SESSION_TEST_CAP));
  assert.ok(PARALLEL_ASSIGNMENTS.every(entry => entry.testCount <= SESSION_TEST_CAP));
  for (const count of [3, 12, SMOKE_CASES.length, 42, 43, 200]) {
    const shards = deriveSmokeShards(syntheticCases(count));
    assert.ok(
      shards.every(shard => shard.testCount <= SESSION_TEST_CAP),
      `case count ${count} produced an over-cap session`,
    );
    assert.ok(shards.every(shard => shard.cases.length > 0));
    assert.equal(shards.length % SHARD_POSITIONS.length, 0);
    // Fewest whole waves that still respect the cap.
    assert.equal(
      shards.length / SHARD_POSITIONS.length,
      Math.ceil(count / ((SESSION_TEST_CAP - SESSION_PREAMBLE_TESTS) * SHARD_POSITIONS.length)),
    );
    assert.equal(
      shards.reduce((total, shard) => total + shard.cases.length, 0),
      count,
    );
  }
  // The cap, not a fixed layout, decides how many sessions the same cases need.
  const overflowing = (SESSION_TEST_CAP - SESSION_PREAMBLE_TESTS) * SHARD_POSITIONS.length + 1;
  assert.equal(deriveSmokeShards(syntheticCases(overflowing)).length, SHARD_POSITIONS.length * 2);
  assert.throws(
    () => deriveSmokeShards(syntheticCases(overflowing), overflowing + SESSION_PREAMBLE_TESTS),
    /SESSION_TEST_CAP/,
  );
});

test('growth beyond one wave generates further positional shard ids', () => {
  const capacity = (SESSION_TEST_CAP - SESSION_PREAMBLE_TESTS) * SHARD_POSITIONS.length;
  const shards = deriveSmokeShards(syntheticCases(capacity + 1));
  assert.deepEqual(
    shards.map(shard => shard.id),
    [
      ...SHARD_POSITIONS,
      ...SHARD_POSITIONS.map(position => `${position}-w2`),
    ],
  );
  assert.deepEqual(
    shards.map(shard => shard.wave),
    [0, 0, 0, 1, 1, 1],
  );
  assert.equal(new Set(shards.map(shard => shard.id)).size, shards.length);
});

test('sharding rejects inputs that cannot fill whole waves', () => {
  for (const count of [0, 1, SHARD_POSITIONS.length - 1]) {
    assert.throws(() => deriveSmokeShards(syntheticCases(count)), /at least/);
  }
  // A cap this small needs more shards than there are cases to place in them.
  assert.throws(
    () => deriveSmokeShards(syntheticCases(10), SESSION_PREAMBLE_TESTS + 1),
    /at least/,
  );
  assert.throws(
    () => deriveSmokeShards(syntheticCases(10), SESSION_PREAMBLE_TESTS),
    /no room for a shard case/,
  );
});

test('bounded-retry request-outcome contracts may span positional shards when the inventory grows', () => {
  const outcomeShards = SMOKE_SHARDS.filter(shard =>
    shard.cases.some(smokeCase => smokeCase.kind === 'request-outcome'),
  );
  assert.ok(outcomeShards.length >= 1);
  assert.deepEqual(
    SMOKE_SHARDS.flatMap(shard =>
      shard.cases.flatMap(smokeCase =>
        smokeCase.kind === 'request-outcome' ? [smokeCase.id] : [],
      ),
    ),
    requestOutcomeCaseIds(),
  );
});

test('exactly one wave is assignable today, and unknown shards are rejected', () => {
  // Parallel pairing is one wave of positional slots; a second derived wave has
  // no orchestrator support yet and must fail loudly here first.
  assert.equal(SMOKE_SHARDS.length, SHARD_POSITIONS.length);
  assert.deepEqual(
    SMOKE_SHARDS.map(shard => shard.id),
    [...SHARD_POSITIONS],
  );
  assert.throws(() => smokeShard('a-primary-w2'), /Unknown smoke shard/);
});

test('each derived shard has its own spec file that runs that shard', () => {
  assert.deepEqual(WDIO_SMOKE_SPECS, SMOKE_SHARDS.map(shard => smokeSpecPath(shard.id)));
  for (const shard of SMOKE_SHARDS) {
    const specPath = path.join(packageRoot, smokeSpecPath(shard.id));
    assert.ok(existsSync(specPath), `missing spec file for shard ${shard.id}`);
    assert.match(
      readFileSync(specPath, 'utf8'),
      new RegExp(`describeSmokeShard\\('${shard.id}'\\)`),
    );
  }
});

test('the parallel assignment source carries no literal session sizes', () => {
  const planSource = readFileSync(path.join(packageRoot, 'src/parallelPlan.ts'), 'utf8');
  assert.doesNotMatch(planSource, /testCount:\s*\d/);
  assert.deepEqual(
    PARALLEL_ASSIGNMENTS.map(entry => entry.testCount),
    SMOKE_SHARDS.map(shard => shard.testCount),
  );
  assert.deepEqual(
    PARALLEL_ASSIGNMENTS.map(entry => entry.label),
    SMOKE_SHARDS.map(shard => shard.id),
  );
});
