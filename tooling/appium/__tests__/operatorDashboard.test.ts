import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  aggregateSlots,
  renderOperatorDashboardMarkdown,
  type OperatorSlotStatus,
} from '../src/operatorDashboard.ts';

describe('operatorDashboard', () => {
  test('aggregateSlots sums active-job counters', () => {
    const slots: OperatorSlotStatus[] = [
      {
        platform: 'android',
        slot: 1,
        root: '/tmp/a',
        alive: true,
        activeJob: {
          jobId: 'job_a',
          events: 10,
          maxIteration: 3,
          pass: 8,
          fail: 2,
          skip: 0,
          startupPass: 1,
          startupFail: 0,
          preamblePass: 1,
          preambleFail: 0,
          testPass: 6,
          testFail: 2,
          topFails: [['gallery-ready', 2]],
          hasSummary: false,
        },
        jobs: [],
        infraAborts: [],
        recovers: 0,
        anrDismiss: 0,
        runTail: [],
      },
      {
        platform: 'android',
        slot: 2,
        root: '/tmp/b',
        alive: false,
        activeJob: {
          jobId: 'job_b',
          events: 4,
          maxIteration: 1,
          pass: 3,
          fail: 1,
          skip: 0,
          startupPass: 0,
          startupFail: 1,
          preamblePass: 0,
          preambleFail: 0,
          testPass: 3,
          testFail: 0,
          topFails: [['session-create', 1]],
          hasSummary: true,
        },
        jobs: [],
        infraAborts: [],
        recovers: 1,
        anrDismiss: 0,
        runTail: [],
      },
    ];
    const agg = aggregateSlots(slots);
    assert.equal(agg.liveWorkers, 1);
    assert.equal(agg.maxIterationAcrossActive, 3);
    assert.equal(agg.activePass, 11);
    assert.equal(agg.activeFail, 3);
    assert.deepEqual(agg.topFails, [
      ['gallery-ready', 2],
      ['session-create', 1],
    ]);
  });

  test('renderOperatorDashboardMarkdown states goal and burn-in phase', () => {
    const md = renderOperatorDashboardMarkdown({
      refreshedAt: '2026-10-14T00:00:00.000Z',
      tip: 'abc1234 test tip',
      tipFull: 'abc1234',
      recentCommits: ['abc1234 test tip'],
      deviceHub: 0,
      adbDevices: ['emulator-5558\tdevice'],
      bootedSims: ['RN E2E iOS slot-1 (UDID) (Booted)'],
      android: {
        liveWorkers: 1,
        slots: 5,
        jobsSeen: 1,
        jobsCompleted: 0,
        activePass: 8,
        activeFail: 2,
        activeSkip: 0,
        activeEvents: 10,
        maxIterationAcrossActive: 3,
        topFails: [['gallery-ready', 2]],
      },
      ios: {
        liveWorkers: 0,
        slots: 5,
        jobsSeen: 0,
        jobsCompleted: 0,
        activePass: 0,
        activeFail: 0,
        activeSkip: 0,
        activeEvents: 0,
        maxIterationAcrossActive: 0,
        topFails: [],
      },
      slots: [],
    });
    assert.match(md, /## Goal/);
    assert.match(md, /IN PROGRESS/);
    assert.match(md, /2,995/);
    assert.match(md, /Amendment history/);
    assert.match(md, /Currently running/);
    assert.match(md, /Statistical qualification \(not yet live\)/);
  });
});
