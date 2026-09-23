import {
  NATIVE_RNGMA_TESTING_PROBE,
  NAVIGATION_SMOKE_CASES,
  REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS,
  SDK_UTILITY_SURFACE_CONTRACTS,
  type NavigationSmokeCase,
  type RepresentativeRequestOutcomeContract,
  type SdkUtilitySurfaceContract,
} from './formats.ts';

/**
 * Android UiAutomator2 destabilizes beyond this many tests in one session.
 * Growth adds waves of positional shards; it never lengthens a session.
 */
export const SESSION_TEST_CAP = 15;

/** Every session asserts gallery home once before running its own shard cases. */
export const SESSION_PREAMBLE_TESTS = 1;

/** One wave is three positional sessions; parallel slot pairing is positional over these. */
export const SHARD_POSITIONS = ['a-primary', 'b-secondary', 'c-tertiary'] as const;

export type ShardPosition = (typeof SHARD_POSITIONS)[number];

/** Generated id: the first wave keeps the bare position, later waves carry their wave number. */
export type ShardId = ShardPosition | `${ShardPosition}-w${number}`;

function shardId(wave: number, position: ShardPosition): ShardId {
  return wave === 0 ? position : `${position}-w${wave + 1}`;
}

export type SmokeShardCase =
  | {
      kind: 'navigation';
      id: string;
      testTitle: string;
      navigation: NavigationSmokeCase;
    }
  | {
      kind: 'request-outcome';
      id: string;
      testTitle: string;
      contract: RepresentativeRequestOutcomeContract;
    }
  | {
      kind: 'probe';
      id: string;
      testTitle: string;
      probe: typeof NATIVE_RNGMA_TESTING_PROBE;
    }
  | {
      kind: 'utility-surface';
      id: string;
      testTitle: string;
      utility: SdkUtilitySurfaceContract;
    };

export type SmokeShard = {
  id: ShardId;
  wave: number;
  position: ShardPosition;
  cases: SmokeShardCase[];
  testCount: number;
};

/**
 * Every device case the smoke suite owns, in packing order. The bounded-retry
 * request-outcome contracts are ordered first so they stay inside the first
 * positional shard instead of spreading across every configured slot.
 */
export const SMOKE_CASES: readonly SmokeShardCase[] = [
  ...REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.map(
    (contract): SmokeShardCase => ({
      kind: 'request-outcome',
      id: contract.id,
      testTitle: `proves ${contract.title}`,
      contract,
    }),
  ),
  ...NAVIGATION_SMOKE_CASES.map(
    (navigation): SmokeShardCase => ({
      kind: 'navigation',
      id: navigation.id,
      testTitle: `opens ${navigation.title}`,
      navigation,
    }),
  ),
  ...SDK_UTILITY_SURFACE_CONTRACTS.map(
    (utility): SmokeShardCase => ({
      kind: 'utility-surface',
      id: utility.id,
      testTitle: `proves ${utility.title}`,
      utility,
    }),
  ),
  {
    kind: 'probe',
    id: NATIVE_RNGMA_TESTING_PROBE.id,
    testTitle: 'preserves NativeRNGMATesting loaded/status probe behavior',
    probe: NATIVE_RNGMA_TESTING_PROBE,
  },
];

/**
 * Pack cases into the fewest whole waves of positional shards that keep every
 * session at or below `cap`, then spread the cases evenly so no shard is empty.
 */
export function deriveSmokeShards(
  cases: readonly SmokeShardCase[],
  cap: number = SESSION_TEST_CAP,
): SmokeShard[] {
  const caseCapacity = cap - SESSION_PREAMBLE_TESTS;
  if (caseCapacity < 1) {
    throw new Error(
      `Session cap ${cap} leaves no room for a shard case after the gallery-home preamble.`,
    );
  }
  const waves = Math.ceil(cases.length / (caseCapacity * SHARD_POSITIONS.length));
  const shardCount = Math.max(waves, 1) * SHARD_POSITIONS.length;
  if (cases.length < shardCount) {
    throw new Error(
      `Smoke sharding needs at least ${shardCount} cases to fill ${shardCount / SHARD_POSITIONS.length} wave(s) of ${SHARD_POSITIONS.length} positional shards; received ${cases.length}.`,
    );
  }
  const evenSize = Math.floor(cases.length / shardCount);
  const remainder = cases.length % shardCount;
  const shards: SmokeShard[] = [];
  let cursor = 0;
  for (let index = 0; index < shardCount; index += 1) {
    const size = evenSize + (index < remainder ? 1 : 0);
    const shardCases = cases.slice(cursor, cursor + size);
    cursor += size;
    const wave = Math.floor(index / SHARD_POSITIONS.length);
    const position = SHARD_POSITIONS[index % SHARD_POSITIONS.length]!;
    shards.push({
      id: shardId(wave, position),
      wave,
      position,
      cases: shardCases,
      testCount: SESSION_PREAMBLE_TESTS + shardCases.length,
    });
  }
  const overCap = shards.filter(shard => shard.testCount > SESSION_TEST_CAP);
  if (overCap.length > 0) {
    throw new Error(
      `Derived shard testCount exceeds SESSION_TEST_CAP ${SESSION_TEST_CAP}: ${overCap
        .map(shard => `${shard.id}=${shard.testCount}`)
        .join(', ')}.`,
    );
  }
  return shards;
}

export const SMOKE_SHARDS: readonly SmokeShard[] = deriveSmokeShards(SMOKE_CASES);

export const SMOKE_SHARD_TEST_TOTAL = SMOKE_SHARDS.reduce(
  (total, shard) => total + shard.testCount,
  0,
);

export function smokeShard(id: ShardId): SmokeShard {
  const shard = SMOKE_SHARDS.find(candidate => candidate.id === id);
  if (!shard) {
    throw new Error(
      `Unknown smoke shard "${id}"; derived shards are ${SMOKE_SHARDS.map(candidate => candidate.id).join(', ')}.`,
    );
  }
  return shard;
}
