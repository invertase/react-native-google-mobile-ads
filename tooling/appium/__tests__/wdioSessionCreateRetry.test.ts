import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  IOS_SESSION_CREATE_RESTART_STOP_EXIT_CODE,
  IOS_SESSION_CREATE_RESTART_STOP_SIGTERM_EXIT_CODE,
  IOS_SESSION_CREATE_RETRY_EXIT_CODE,
  isIosSessionCreateRetryProcessExitCode,
  isIosSessionCreateSupervisedRestartStopExitCode,
} from '../src/wdioSessionCreateRetry.ts';

describe('wdioSessionCreateRetry', () => {
  test('IOS_SESSION_CREATE_RETRY_EXIT_CODE is stable', () => {
    assert.equal(IOS_SESSION_CREATE_RETRY_EXIT_CODE, 86);
  });

  test('supervised wdio.stop maps to exit 130 or 143', () => {
    assert.equal(IOS_SESSION_CREATE_RESTART_STOP_EXIT_CODE, 130);
    assert.equal(IOS_SESSION_CREATE_RESTART_STOP_SIGTERM_EXIT_CODE, 143);
    assert.ok(isIosSessionCreateSupervisedRestartStopExitCode(130));
    assert.ok(isIosSessionCreateSupervisedRestartStopExitCode(143));
    assert.ok(isIosSessionCreateRetryProcessExitCode(86));
    assert.ok(!isIosSessionCreateRetryProcessExitCode(130));
    assert.ok(!isIosSessionCreateSupervisedRestartStopExitCode(86));
  });
});