import assert from 'node:assert/strict';
import test from 'node:test';
import { REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS } from '../src/formats.ts';
import {
  DEVICE_NATIVE_COVERAGE_GAPS,
  nativeCoverageCheckpointSummary,
  NATIVE_COVERAGE_CHECKPOINTS,
  validateNativeCoverageCheckpoints,
} from '../src/nativeCoverageCheckpoints.ts';

test('every request-outcome contract has a Jacoco checkpoint with existing native sources', () => {
  assert.deepEqual(validateNativeCoverageCheckpoints(), []);
  assert.equal(
    NATIVE_COVERAGE_CHECKPOINTS.length,
    REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.length,
  );
  const summary = nativeCoverageCheckpointSummary();
  assert.equal(summary.checkpointCount, REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.length);
  assert.deepEqual(summary.contractIds, REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.map(c => c.id));
  console.log(
    `[native-coverage-checkpoints] ${JSON.stringify({
      checkpoints: summary.checkpointCount,
      deviceGaps: summary.deviceGapCount,
    })}`,
  );
});

test('device native coverage gaps stay documented for slot-6 closure', () => {
  assert.ok(DEVICE_NATIVE_COVERAGE_GAPS.length >= 5);
  assert.ok(
    DEVICE_NATIVE_COVERAGE_GAPS.every(
      gap => gap.summary.trim().split(/\s+/).length >= 8 && gap.deviceProof.trim().length > 0,
    ),
  );
});
