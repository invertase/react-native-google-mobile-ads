import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { IOS_SESSION_CREATE_RETRY_EXIT_CODE } from '../src/wdioSessionCreateRetry.ts';

describe('wdioSessionCreateRetry', () => {
  test('IOS_SESSION_CREATE_RETRY_EXIT_CODE is stable', () => {
    assert.equal(IOS_SESSION_CREATE_RETRY_EXIT_CODE, 86);
  });
});