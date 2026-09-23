import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEVICE_NATIVE_COVERAGE_GAPS,
  EXECUTABLE_E2E_CONTRACT_IDS,
  nativeCoverageCheckpointSummary,
  NATIVE_COVERAGE_CHECKPOINTS,
  validateNativeCoverageCheckpoints,
} from '../src/nativeCoverageCheckpoints.ts';

test('every executable Appium contract has a Jacoco checkpoint with existing native sources', () => {
  assert.deepEqual(validateNativeCoverageCheckpoints(), []);
  assert.equal(NATIVE_COVERAGE_CHECKPOINTS.length, EXECUTABLE_E2E_CONTRACT_IDS.length);
  const summary = nativeCoverageCheckpointSummary();
  assert.equal(summary.checkpointCount, EXECUTABLE_E2E_CONTRACT_IDS.length);
  assert.deepEqual(summary.contractIds, EXECUTABLE_E2E_CONTRACT_IDS);
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
