import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PUBLIC_API_CONTRACTS } from '../src/contracts.ts';
import {
  ACCEPTED_COVERAGE_EXCEPTIONS,
  buildFreezeCandidate,
  FREEZE_MANIFEST_PATH,
  readFreezeManifest,
  REJECTED_EXCEPTION_PROPOSALS,
  validateFreezeManifest,
} from '../src/reliabilityFreeze.ts';
import { buildReliabilityLayout } from '../src/reliabilityLayouts.ts';

test('freeze manifest matches live digests and durable snapshot bodies', () => {
  const errors = validateFreezeManifest();
  assert.deepEqual(errors, []);
  const manifest = readFreezeManifest();
  const live = buildFreezeCandidate({
    sourceAnchorCommit: manifest.sourceAnchorCommit,
  });
  assert.deepEqual(manifest.policy.body, live.policy.body);
  assert.deepEqual(manifest.layout.shards, live.layout.shards);
  assert.deepEqual(manifest.executable.caseIds, live.executable.caseIds);
  assert.deepEqual(manifest.notes, live.notes);
  assert.equal(manifest.policy.body.alpha, 0.05);
});

test('freeze candidate uses final-smoke layout and GMA-AD-6 ledger only', () => {
  const candidate = buildFreezeCandidate();
  const layout = buildReliabilityLayout('final');
  assert.equal(candidate.layout.id, 'final-smoke');
  assert.equal(candidate.layout.kind, 'final');
  assert.equal(candidate.layout.digest, layout.digest);
  assert.deepEqual(candidate.acceptedExceptions, [...ACCEPTED_COVERAGE_EXCEPTIONS]);
  assert.deepEqual(candidate.rejectedExceptionProposals, [...REJECTED_EXCEPTION_PROPOSALS]);
  assert.equal(candidate.acceptedExceptions.length, 4);
});

test('checked-in freeze-manifest.json is parseable and byte-stable for digests', () => {
  const raw = readFileSync(FREEZE_MANIFEST_PATH, 'utf8');
  const manifest = readFreezeManifest();
  assert.match(raw, /"schemaVersion": 1/);
  assert.match(raw, /"alpha": 0\.05/);
  assert.equal(manifest.layout.digest.length, 64);
  assert.equal(manifest.policy.digest.length, 64);
  assert.equal(manifest.executable.digest.length, 64);
});

test('public API contracts do not propose stale EX-* exception labels', () => {
  const banned = [
    'proposed EX-',
    'EX-CREATIVE-CLICK',
    'EX-PAID-EVENT',
    'EX-IMPRESSION-ACK',
    'EX-REWARD-EARNED',
    'EX-IOS-LCOV-EXPORT',
    'EX-NEXTGEN-JACOCO-VALIDITY',
  ];
  for (const contract of PUBLIC_API_CONTRACTS) {
    const reason = 'reason' in contract ? contract.reason : '';
    const assertion = 'assertion' in contract ? contract.assertion : '';
    const haystack = `${reason}\n${assertion}`;
    for (const token of banned) {
      assert.equal(
        haystack.includes(token),
        false,
        `${contract.api} still mentions ${token}`,
      );
    }
  }
});
