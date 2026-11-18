import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  formatSimLaunchWedgedAbort,
  isAcceptableSimctlTerminateStatus,
  isAcceptableSimctlShutdownOutcome,
  LAUNCH_GATE_ERASE_TIMEOUT_MS,
  LAUNCH_GATE_LAUNCH_TIMEOUT_MS,
  LAUNCH_GATE_LAUNCH_TIMEOUT_MS_CI,
  LAUNCH_GATE_MAX_ATTEMPTS,
  LAUNCH_GATE_RESET_MODE,
  LAUNCH_GATE_RESET_SEQUENCE,
  LAUNCH_GATE_SHUTDOWN_TIMEOUT_MS,
  LAUNCH_GATE_TERMINATE_TIMEOUT_MS,
  LAUNCH_SERVICES_SETTLE_POLL_MS,
  LAUNCH_SERVICES_SETTLE_TIMEOUT_MS,
  resolveLaunchGateLaunchTimeoutMs,
  resolveLaunchGateResetMode,
  resolveRunnerImageVersion,
  shouldEraseSimulatorOnLaunchGateReset,
  shouldRetryLaunchGateAfterFailure,
} from '../src/iosLaunchContractGate.ts';

describe('iosLaunchContractGate', () => {
  test('timeouts match nested launch-contract ceilings', () => {
    assert.equal(LAUNCH_GATE_LAUNCH_TIMEOUT_MS, 90_000);
    assert.equal(LAUNCH_GATE_LAUNCH_TIMEOUT_MS_CI, 120_000);
    assert.equal(LAUNCH_GATE_TERMINATE_TIMEOUT_MS, 20_000);
    assert.equal(LAUNCH_GATE_MAX_ATTEMPTS, 2);
    assert.equal(LAUNCH_SERVICES_SETTLE_POLL_MS, 1_000);
    assert.equal(LAUNCH_SERVICES_SETTLE_TIMEOUT_MS, 30_000);
    assert.equal(LAUNCH_GATE_SHUTDOWN_TIMEOUT_MS, 60_000);
    assert.equal(LAUNCH_GATE_ERASE_TIMEOUT_MS, 120_000);
  });

  test('gate reset runs shutdown before erase then boot', () => {
    assert.deepEqual(LAUNCH_GATE_RESET_SEQUENCE, ['shutdown', 'erase', 'boot']);
  });

  test('simctl shutdown accepts exit 0 or already Shutdown', () => {
    assert.ok(isAcceptableSimctlShutdownOutcome(0));
    assert.ok(
      isAcceptableSimctlShutdownOutcome(
        149,
        'Unable to shutdown device in current state: Shutdown',
      ),
    );
    assert.ok(!isAcceptableSimctlShutdownOutcome(1, 'permission denied'));
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

  test('erase reset applies only when a retry remains', () => {
    assert.equal(LAUNCH_GATE_RESET_MODE, 'erase');
    assert.ok(shouldEraseSimulatorOnLaunchGateReset(1));
    assert.ok(!shouldEraseSimulatorOnLaunchGateReset(2));
    assert.equal(resolveLaunchGateResetMode(1), 'erase');
    assert.equal(resolveLaunchGateResetMode(2), 'shutdown');
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

  test('resolveLaunchGateLaunchTimeoutMs uses 120s on GitHub Actions only', () => {
    assert.equal(resolveLaunchGateLaunchTimeoutMs({}), 90_000);
    assert.equal(resolveLaunchGateLaunchTimeoutMs({ GITHUB_ACTIONS: 'true' }), 120_000);
    assert.equal(resolveLaunchGateLaunchTimeoutMs({ CI: 'true' }), 90_000);
  });

  test('resolveRunnerImageVersion prefers ImageVersion', () => {
    assert.equal(
      resolveRunnerImageVersion({ ImageVersion: '20261104.0514.1' }),
      '20261104.0514.1',
    );
  });
});