/**
 * Frozen executable / layout / policy candidate for statistical qualification.
 *
 * Digests bind receipts to suite composition and qualification policy. Accepted
 * coverage exceptions are only the four GMA-AD-6 external outcomes — never
 * invent additional EX-* labels here without explicit user acceptance.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { dependencyDigest } from './reliabilityEvidence.ts';
import { buildReliabilityLayout, type ReliabilityLayout } from './reliabilityLayouts.ts';
import {
  CANARY_CONFIGURATIONS,
  QUALIFICATION_POLICY,
  QUALIFYING_CONFIGURATIONS,
  type QualificationPolicy,
} from './reliabilityStats.ts';
import { SMOKE_CASES, SMOKE_SHARDS } from './sessionShards.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Commit-able freeze snapshot path (repo-relative from tooling/appium). */
export const FREEZE_MANIFEST_PATH = path.join(here, '..', 'freeze-manifest.json');

/**
 * Durable accepted exception ledger. Labels are GMA-AD-6 outcome names — not
 * campaign item IDs and not broad PAID/CLICK/IMPRESSION/REWARD exclusions.
 */
export const ACCEPTED_COVERAGE_EXCEPTIONS = [
  'GMA-AD-6:UMP-consent-outcome',
  'GMA-AD-6:GAM-app-event-inventory',
  'GMA-AD-6:vendor-SDK-internal',
  'GMA-AD-6:mediation-network-fill',
] as const;

export type AcceptedCoverageException = (typeof ACCEPTED_COVERAGE_EXCEPTIONS)[number];

/**
 * Explicitly rejected exception proposals (do not restore without new evidence
 * and user acceptance). Broad inventory/callback gaps stay owned integration.
 */
export const REJECTED_EXCEPTION_PROPOSALS = [
  'broad-PAID-EVENT',
  'broad-CREATIVE-CLICK',
  'broad-IMPRESSION-ACK',
  'broad-REWARD-EARNED',
  'IOS-LCOV-EXPORT',
  'broad-NEXTGEN-JACOCO-VALIDITY',
] as const;

export type FreezeManifest = {
  schemaVersion: 1;
  /** Content-bound freeze; commit SHA is recorded by operators after commit. */
  freezeId: 'final-smoke-qualification-candidate';
  layout: {
    kind: 'final';
    id: string;
    digest: string;
    shardCount: number;
    caseCount: number;
    testTotal: number;
    shards: ReadonlyArray<{
      shardId: string;
      caseIds: readonly string[];
      testCount: number;
    }>;
  };
  policy: {
    digest: string;
    body: QualificationPolicy;
    qualifyingConfigurations: readonly string[];
    canaryConfigurations: readonly string[];
  };
  executable: {
    digest: string;
    caseIds: readonly string[];
  };
  acceptedExceptions: readonly AcceptedCoverageException[];
  rejectedExceptionProposals: readonly string[];
  /**
   * Parent commit identity before the freeze package lands. Workers pin the
   * freeze commit SHA after it is committed — never push from product-edit
   * checkouts to fast-forward remote workers.
   */
  sourceAnchorCommit: string;
  notes: readonly string[];
};

export function executableSuiteDigest(
  caseIds: readonly string[] = SMOKE_CASES.map(item => item.id),
  shards: typeof SMOKE_SHARDS = SMOKE_SHARDS,
): string {
  const payload = {
    caseIds: [...caseIds],
    shards: shards.map(shard => ({
      id: shard.id,
      caseIds: shard.cases.map(item => item.id),
      testCount: shard.testCount,
    })),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function policyDependencyDigest(
  policy: QualificationPolicy = QUALIFICATION_POLICY,
): string {
  return dependencyDigest('policy', policy).digest;
}

export function buildFreezeCandidate(options?: {
  layout?: ReliabilityLayout;
  sourceAnchorCommit?: string;
}): FreezeManifest {
  const layout = options?.layout ?? buildReliabilityLayout('final');
  const caseIds = SMOKE_CASES.map(item => item.id);
  return {
    schemaVersion: 1,
    freezeId: 'final-smoke-qualification-candidate',
    layout: {
      kind: 'final',
      id: layout.id,
      digest: layout.digest,
      shardCount: layout.entries.length,
      caseCount: caseIds.length,
      testTotal: layout.entries.reduce((total, entry) => total + entry.testCount, 0),
      shards: layout.entries.map(entry => ({
        shardId: entry.shardId,
        caseIds: [...entry.caseIds],
        testCount: entry.testCount,
      })),
    },
    policy: {
      digest: policyDependencyDigest(),
      body: QUALIFICATION_POLICY,
      qualifyingConfigurations: [...QUALIFYING_CONFIGURATIONS],
      canaryConfigurations: [...CANARY_CONFIGURATIONS],
    },
    executable: {
      digest: executableSuiteDigest(),
      caseIds,
    },
    acceptedExceptions: [...ACCEPTED_COVERAGE_EXCEPTIONS],
    rejectedExceptionProposals: [...REJECTED_EXCEPTION_PROPOSALS],
    sourceAnchorCommit:
      options?.sourceAnchorCommit ?? '53d6d3eb8224cb858766b32e11e805ef7a28d0ac',
    notes: [
      'Accepted exceptions are only the four GMA-AD-6 external outcomes.',
      'Reward-earned (earned=true) remains Appium-owned and blocking.',
      'IOS-LCOV-EXPORT rejected: react-native-coverage@0.2.2 proves universal export.',
      'NEXTGEN-JACOCO: only app-wide :app dependency instrumentation is known unsafe; owned-library Jacoco remains.',
      'Type-proof deferred rows and adapter plugin-fixture-pending remain open work, not accepted exceptions.',
      'Workers sync by checking out the freeze commit and verifying digests; do not push from product-edit checkouts.',
    ],
  };
}

export function readFreezeManifest(
  manifestPath: string = FREEZE_MANIFEST_PATH,
): FreezeManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as FreezeManifest;
}

/**
 * Durable snapshot fields operators read from `freeze-manifest.json`. Digests
 * are included inside `layout` / `policy` / `executable`; they must still match
 * `buildFreezeCandidate()` via deep-equal of these bodies.
 */
const DURABLE_FREEZE_FIELDS = [
  'schemaVersion',
  'freezeId',
  'layout',
  'policy',
  'executable',
  'acceptedExceptions',
  'rejectedExceptionProposals',
  'notes',
] as const satisfies ReadonlyArray<keyof FreezeManifest>;

/** Fail-closed checks that the checked-in manifest matches the live candidate. */
export function validateFreezeManifest(
  manifest: FreezeManifest = readFreezeManifest(),
  live: FreezeManifest = buildFreezeCandidate({
    sourceAnchorCommit: manifest.sourceAnchorCommit,
  }),
): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== 1) {
    errors.push(`unexpected freeze schemaVersion ${manifest.schemaVersion}`);
  }
  if (manifest.freezeId !== live.freezeId) {
    errors.push(`freezeId drift: manifest=${manifest.freezeId} live=${live.freezeId}`);
  }
  if (manifest.layout.digest !== live.layout.digest) {
    errors.push(
      `layout digest drift: manifest=${manifest.layout.digest} live=${live.layout.digest}`,
    );
  }
  if (manifest.policy.digest !== live.policy.digest) {
    errors.push(
      `policy digest drift: manifest=${manifest.policy.digest} live=${live.policy.digest}`,
    );
  }
  if (manifest.executable.digest !== live.executable.digest) {
    errors.push(
      `executable digest drift: manifest=${manifest.executable.digest} live=${live.executable.digest}`,
    );
  }
  for (const field of DURABLE_FREEZE_FIELDS) {
    if (!isDeepStrictEqual(manifest[field], live[field])) {
      errors.push(`${field} drift from buildFreezeCandidate()`);
    }
  }
  if (manifest.acceptedExceptions.length !== ACCEPTED_COVERAGE_EXCEPTIONS.length) {
    errors.push(
      `acceptedExceptions length ${manifest.acceptedExceptions.length} !== ${ACCEPTED_COVERAGE_EXCEPTIONS.length}`,
    );
  }
  for (const label of ACCEPTED_COVERAGE_EXCEPTIONS) {
    if (!manifest.acceptedExceptions.includes(label)) {
      errors.push(`acceptedExceptions missing ${label}`);
    }
  }
  for (const label of REJECTED_EXCEPTION_PROPOSALS) {
    if (!manifest.rejectedExceptionProposals.includes(label)) {
      errors.push(`rejectedExceptionProposals missing ${label}`);
    }
  }
  for (const banned of [
    'EX-PAID-EVENT',
    'EX-CREATIVE-CLICK',
    'EX-IMPRESSION-ACK',
    'EX-REWARD-EARNED',
    'EX-IOS-LCOV-EXPORT',
    'EX-NEXTGEN-JACOCO-VALIDITY',
  ]) {
    if (manifest.acceptedExceptions.some(item => item.includes(banned))) {
      errors.push(`acceptedExceptions must not include rejected proposal ${banned}`);
    }
  }
  return errors;
}
