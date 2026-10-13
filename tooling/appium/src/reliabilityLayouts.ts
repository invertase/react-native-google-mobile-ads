import { createHash } from 'node:crypto';
import {
  SESSION_PREAMBLE_TESTS,
  SMOKE_SHARDS,
  type ShardId,
  type SmokeShard,
} from './sessionShards.ts';
import { smokeSpecPath, type WdioSmokeSpec } from './wdioSpecs.ts';

export const LAYOUT_KINDS = ['temporary', 'final'] as const;
export type LayoutKind = (typeof LAYOUT_KINDS)[number];

/** One shard slot in a data-driven reliability layout. */
export type ReliabilityLayoutEntry = {
  shardId: ShardId;
  spec: WdioSmokeSpec;
  /** Stable case ids in execution order (excludes the gallery-home preamble). */
  caseIds: readonly string[];
  /** Gallery-home preamble tests owned by every shard. */
  preambleTests: number;
  testCount: number;
};

export type ReliabilityLayout = {
  kind: LayoutKind;
  id: string;
  entries: readonly ReliabilityLayoutEntry[];
  /** sha256 of the canonical layout payload; binds receipts to suite composition. */
  digest: string;
};

function entryFromShard(shard: SmokeShard): ReliabilityLayoutEntry {
  return {
    shardId: shard.id,
    spec: smokeSpecPath(shard.id),
    caseIds: shard.cases.map(item => item.id),
    preambleTests: SESSION_PREAMBLE_TESTS,
    testCount: shard.testCount,
  };
}

function canonicalPayload(kind: LayoutKind, id: string, entries: readonly ReliabilityLayoutEntry[]) {
  return {
    kind,
    id,
    entries: entries.map(entry => ({
      shardId: entry.shardId,
      spec: entry.spec,
      caseIds: [...entry.caseIds],
      preambleTests: entry.preambleTests,
      testCount: entry.testCount,
    })),
  };
}

export function layoutDigest(
  kind: LayoutKind,
  id: string,
  entries: readonly ReliabilityLayoutEntry[],
): string {
  const payload = JSON.stringify(canonicalPayload(kind, id, entries));
  return createHash('sha256').update(payload).digest('hex');
}

export function buildReliabilityLayout(
  kind: LayoutKind,
  shards: readonly SmokeShard[] = SMOKE_SHARDS,
  options: { temporaryShardIds?: readonly ShardId[]; id?: string } = {},
): ReliabilityLayout {
  let selected: SmokeShard[];
  if (kind === 'final') {
    selected = [...shards];
  } else {
    const ids = options.temporaryShardIds ?? [shards[0]!.id];
    selected = ids.map(id => {
      const shard = shards.find(candidate => candidate.id === id);
      if (!shard) {
        throw new Error(
          `temporary layout references unknown shard "${id}"; known: ${shards
            .map(candidate => candidate.id)
            .join(', ')}.`,
        );
      }
      return shard;
    });
  }
  if (selected.length === 0) {
    throw new Error(`${kind} reliability layout requires at least one shard.`);
  }
  const id =
    options.id ??
    (kind === 'final'
      ? 'final-smoke'
      : `temporary-${selected.map(shard => shard.id).join('+')}`);
  const entries = selected.map(entryFromShard);
  return {
    kind,
    id,
    entries,
    digest: layoutDigest(kind, id, entries),
  };
}

export function parseLayoutKind(value: string | undefined): LayoutKind {
  if (value == null || value === '') {
    return 'final';
  }
  if (!(LAYOUT_KINDS as readonly string[]).includes(value)) {
    throw new Error(
      `layout must be one of ${LAYOUT_KINDS.join(', ')}; received "${value}".`,
    );
  }
  return value as LayoutKind;
}

/** Total semantic tests including each shard preamble. */
export function layoutTestTotal(layout: ReliabilityLayout): number {
  return layout.entries.reduce((total, entry) => total + entry.testCount, 0);
}
