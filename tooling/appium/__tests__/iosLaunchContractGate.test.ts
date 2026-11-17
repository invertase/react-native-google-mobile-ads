import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  formatSimLaunchWedgedAbort,
  isAcceptableSimctlTerminateStatus,
  LAUNCH_GATE_LAUNCH_TIMEOUT_MS,
  LAUNCH_GATE_MAX_ATTEMPTS,
  LAUNCH_GATE_TERMINATE_TIMEOUT_MS,
  resolveRunnerImageVersion,
  shouldRetryLaunchGateAfterFailure,
} from '../src/iosLaunchContractGate.ts';

describe('iosLaunchContractGate', () => {
  test('timeouts match T29 nested launch-contract spec', () => {
    assert.equal(LAUNCH_GATE_LAUNCH_TIMEOUT_MS, 60_000);
    assert.equal(LAUNCH_GATE_TERMINATE_TIMEOUT_MS, 20_000);
    assert.equal(LAUNCH_GATE_MAX_ATTEMPTS, 2);
  });

  test('simctl terminate status 0 and 3 are acceptable', () => {
    assert.ok(isAcceptableSimctlTerminateStatus(0));
    assert.ok(isAcceptableSimctlTerminateStatus(3));
    assert.ok(!isAcceptableSimctlTerminateStatus(1));
  });

  test('shouldRetryLaunchGateAfterFailure allows one reset', () => {
    assert.ok(shouldRetryLaunchGateAfterFailure(1));
    assert.ok(!shouldRetryLaunchGateAfterFailure(2));
  });

  test('formatSimLaunchWedgedAbort includes runner image', () => {
    assert.equal(
      formatSimLaunchWedgedAbort('20261112.0539.3'),
      'RNGMA_INFRA_ABORT: sim-launch-wedged image=20261112.0539.3',
    );
    assert.match(
      formatSimLaunchWedgedAbort(),
      /^RNGMA_INFRA_ABORT: sim-launch-wedged image=/,
    );
  });

  test('resolveRunnerImageVersion prefers ImageVersion', () => {
    assert.equal(
      resolveRunnerImageVersion({ ImageVersion: '20261104.0514.1' }),
      '20261104.0514.1',
    );
  });
});