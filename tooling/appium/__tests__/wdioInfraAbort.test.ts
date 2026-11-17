import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  consumeIosSessionCreateInfraAbort,
  markIosSessionCreateInfraAbort,
  resetIosSessionCreateInfraAbortForTests,
  RNGMA_INFRA_ABORT_PREFIX,
} from '../src/wdioInfraAbort.ts';

describe('wdioInfraAbort', () => {
  test('consumeIosSessionCreateInfraAbort is read-once', () => {
    resetIosSessionCreateInfraAbortForTests();
    assert.equal(consumeIosSessionCreateInfraAbort(), false);
    markIosSessionCreateInfraAbort();
    assert.equal(consumeIosSessionCreateInfraAbort(), true);
    assert.equal(consumeIosSessionCreateInfraAbort(), false);
  });

  test('RNGMA_INFRA_ABORT_PREFIX is stable', () => {
    assert.equal(RNGMA_INFRA_ABORT_PREFIX, 'RNGMA_INFRA_ABORT:');
  });
});