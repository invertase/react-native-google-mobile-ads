import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  assertCampaignDryRun,
  createCampaignController,
  parseReliabilityCampaignArgv,
  runAllCapacityPilots,
  runCapacityPilot,
} from '../src/reliabilityCampaign.ts';
import {
  CAPACITY_PILOT_LANES,
  createCapacityController,
  laneCount,
  parseElasticSlotList,
  resolveElasticSlotSet,
  slotSetForLanePilot,
} from '../src/reliabilityCapacity.ts';
import { createLeaseController } from '../src/reliabilityLeases.ts';
import {
  assertDistinctPlatformMetro,
  metroOwnershipForSlotPlatform,
  reliabilityMetroEnv,
} from '../src/reliabilityMetro.ts';
import {
  createLiveAppiumShardRunner,
  reliabilityShardEnv,
  spawnProcessToLog,
} from '../src/reliabilityWorker.ts';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

describe('elastic capacity parsing', () => {
  test('parses --slots for both platforms and platform-specific overrides', () => {
    assert.deepEqual(parseElasticSlotList('1,2,4', '--slots'), [1, 2, 4]);
    assert.deepEqual(
      resolveElasticSlotSet({ slots: '1,2,4' }),
      { android: [1, 2, 4], ios: [1, 2, 4] },
    );
    assert.deepEqual(
      resolveElasticSlotSet({
        slots: '1,2,4',
        androidSlots: '1,5',
        iosSlots: '2,4',
      }),
      { android: [1, 5], ios: [2, 4] },
    );
    assert.throws(
      () => resolveElasticSlotSet({}),
      /Elastic capacity requires/,
    );
    assert.throws(() => parseElasticSlotList('1,1', '--slots'), /duplicate/);
    assert.throws(() => parseElasticSlotList('0', '--slots'), /--slots.*not an operational/);
    assert.throws(
      () => parseElasticSlotList('abc', '--android-slots'),
      /--android-slots must be an integer/,
    );
    assert.throws(
      () => parseElasticSlotList('9', '--ios-slots'),
      /--ios-slots must be an integer/,
    );
  });

  test('campaign argv accepts elastic flags and pilot lanes', () => {
    const options = parseReliabilityCampaignArgv(
      [
        'diagnose',
        '--slots=1,2',
        '--dry-run',
        '--layout=temporary',
      ],
      {},
    );
    assert.equal(options.mode, 'diagnose');
    assert.deepEqual(options.slotSet.android, [1, 2]);
    assert.deepEqual(options.slotSet.ios, [1, 2]);
    assert.equal(options.dryRun, true);

    const androidOnly = parseReliabilityCampaignArgv(
      ['burn-in', '--android-slots=1,4', '--dry-run'],
      {},
    );
    assert.deepEqual(androidOnly.slotSet.android, [1, 4]);
    assert.deepEqual(androidOnly.slotSet.ios, []);

    const pilot = parseReliabilityCampaignArgv(
      ['qualify', '--pilot-lanes=4', '--dry-run'],
      {},
    );
    assert.equal(pilot.pilotLanes, 4);
    assert.equal(laneCount(pilot.slotSet), 4);

    const withArtifacts = parseReliabilityCampaignArgv(
      [
        'diagnose',
        '--slots=1',
        '--dry-run',
        '--run-risk-pilot',
        '--artifact-root=/tmp/rngma-risk-artifacts',
      ],
      {},
    );
    assert.equal(withArtifacts.artifactRoot, '/tmp/rngma-risk-artifacts');
  });

  test('campaign CLI refuses non-dry-run except capacity pilots entry', () => {
    const live = parseReliabilityCampaignArgv(['diagnose', '--slots=1'], {});
    assert.equal(live.dryRun, false);
    assert.throws(() => assertCampaignDryRun(live), /executes device-free with --dry-run/);

    const dry = parseReliabilityCampaignArgv(['diagnose', '--slots=1', '--dry-run'], {});
    assert.doesNotThrow(() => assertCampaignDryRun(dry));
  });

  test('wires named campaign script at root and workspace', () => {
    const root = JSON.parse(
      readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const workspace = JSON.parse(
      readFileSync(
        path.join(repositoryRoot, 'tooling/appium/package.json'),
        'utf8',
      ),
    ) as { scripts: Record<string, string> };
    assert.equal(
      root.scripts['tests:appium:reliability:campaign'],
      'yarn workspace @invertase/rngma-appium reliability:campaign',
    );
    assert.equal(
      workspace.scripts['reliability:campaign'],
      'tsx ./scripts/reliability-campaign.ts',
    );
  });
});

describe('leases heartbeats steal drain', () => {
  test('acquires multi-slot leases, heartbeats, steals, drains, and releases', async () => {
    let clock = 1000;
    const leases = createLeaseController({
      slotSet: { android: [1, 2], ios: [1] },
      heartbeatTimeoutMs: 50,
      now: () => clock,
    });

    await leases.acquireAll({ dryRun: true, async checkClear() { return true; } });
    const all = leases.list();
    assert.equal(all.length, 3);
    assert.equal(all.every(lease => lease.state === 'owned-idle'), true);

    const first = all[0]!;
    leases.heartbeat(first.leaseId, 'w1');
    const running = leases.assignWork({ workItemId: 'job-a' }, 'w1');
    assert.equal(running?.state, 'owned-running');
    assert.equal(running?.workItemId, 'job-a');

    clock += 51;
    const stolen = leases.stealExpired({ workerId: 'w2' });
    assert.equal(stolen.stolen?.leaseId, first.leaseId);
    assert.equal(stolen.reassignedTo?.workItemId, 'job-a');
    assert.notEqual(stolen.reassignedTo?.leaseId, first.leaseId);

    const busy = leases.list().find(lease => lease.state === 'owned-running')!;
    const stolenBusy = leases.stealWorkFromBusy(
      {
        workItemId: 'job-b',
        preferred: { slot: busy.slot, platform: busy.platform },
      },
      'w3',
    );
    assert.equal(stolenBusy?.workItemId, 'job-b');
    assert.notEqual(
      `${stolenBusy?.platform}:${stolenBusy?.slot}`,
      `${busy.platform}:${busy.slot}`,
    );

    for (const lease of leases.list()) {
      if (lease.state === 'owned-running') {
        leases.finishWork(lease.leaseId);
      }
    }
    await leases.beginDrain();
    assert.equal(
      leases.list().every(lease => lease.state === 'draining'),
      true,
    );
    const released = await leases.releaseAll(async () => undefined);
    assert.equal(released.released, 3);
    assert.equal(released.failed, 0);
    assert.equal(leases.list().every(lease => lease.state === 'released'), true);
  });

  test('one-lane and all-busy steal dequeue via queue drain', async () => {
    let clock = 1000;
    const oneLane = createLeaseController({
      slotSet: { android: [1], ios: [] },
      heartbeatTimeoutMs: 50,
      now: () => clock,
    });
    await oneLane.acquireAll({ dryRun: true, async checkClear() { return true; } });
    const only = oneLane.list()[0]!;
    oneLane.heartbeat(only.leaseId, 'w1');
    assert.equal(oneLane.assignWork({ workItemId: 'solo' }, 'w1')?.state, 'owned-running');
    clock += 51;
    const stolenOne = oneLane.stealExpired({ workerId: 'w2' });
    assert.equal(stolenOne.stolen?.leaseId, only.leaseId);
    assert.equal(stolenOne.reassignedTo?.workItemId, 'solo');
    assert.equal(stolenOne.reassignedTo?.leaseId, only.leaseId);
    assert.equal(oneLane.queueDepth(), 0);

    clock = 1000;
    const twoLane = createLeaseController({
      slotSet: { android: [1, 2], ios: [] },
      heartbeatTimeoutMs: 50,
      now: () => clock,
    });
    await twoLane.acquireAll({ dryRun: true, async checkClear() { return true; } });
    const [a, b] = twoLane.list();
    assert.ok(a && b);
    twoLane.heartbeat(a.leaseId, 'w1');
    twoLane.heartbeat(b.leaseId, 'w1');
    assert.equal(twoLane.assignWork({ workItemId: 'job-1' }, 'w1')?.workItemId, 'job-1');
    assert.equal(twoLane.assignWork({ workItemId: 'job-2' }, 'w1')?.workItemId, 'job-2');
    assert.equal(twoLane.list().every(lease => lease.state === 'owned-running'), true);
    clock += 51;
    // First expired lease is reclaimed; the other remains busy, so stolen work
    // goes through the queue and drainOnto the reclaimed idle lane.
    const stolenBusy = twoLane.stealExpired({ workerId: 'stealer' });
    assert.ok(stolenBusy.stolen);
    // Snapshot clears workItemId on the stolen lease; reassigned work comes from the queue.
    assert.equal(stolenBusy.stolen.workItemId, null);
    assert.equal(stolenBusy.reassignedTo?.workItemId, 'job-1');
    assert.equal(stolenBusy.reassignedTo?.leaseId, stolenBusy.stolen.leaseId);
    assert.equal(twoLane.queueDepth(), 0);

    // Idle-path: queued work must dispatch when a running lease finishes.
    twoLane.enqueue({ workItemId: 'after-finish' });
    const stillRunning = twoLane.list().find(lease => lease.state === 'owned-running');
    assert.ok(stillRunning);
    twoLane.finishWork(stillRunning.leaseId);
    const afterFinish = twoLane.list().find(lease => lease.workItemId === 'after-finish');
    assert.ok(afterFinish);
    assert.equal(afterFinish.state, 'owned-running');
    assert.equal(twoLane.queueDepth(), 0);
  });

  test('beginDrain refuses owned-running and uses owned-idle begin-release', async () => {
    const leases = createLeaseController({
      slotSet: { android: [1], ios: [] },
    });
    await leases.acquireAll({ dryRun: true, async checkClear() { return true; } });
    const running = leases.assignWork({ workItemId: 'blocking' }, 'w');
    assert.equal(running?.state, 'owned-running');
    await assert.rejects(leases.beginDrain(), /owned-running/);
    leases.finishWork(running!.leaseId);
    await leases.beginDrain();
    assert.equal(leases.list()[0]!.state, 'draining');
  });

  test('capacity pause/resume and restart with different capacity', async () => {
    const capacity = createCapacityController({ android: [1], ios: [1] });
    assert.equal(capacity.state, 'running');
    capacity.pause();
    assert.equal(capacity.state, 'paused');
    capacity.resume();
    capacity.beginDrain();
    capacity.markStopped();
    const next = capacity.restartWithCapacity({ android: [1, 2], ios: [4] });
    assert.deepEqual(next.android, [1, 2]);
    assert.deepEqual(next.ios, [4]);
    assert.equal(capacity.state, 'running');

    const controller = createCampaignController({
      mode: 'diagnose',
      layoutKind: 'temporary',
      slotSet: { android: [1], ios: [2] },
      dryRun: true,
      allowForceAcquire: false,
      receiptRoot: '/tmp/rngma-e2e-reliability/test-receipts',
      logRoot: '/tmp/rngma-e2e-reliability/test-logs',
    });
    await controller.leases.acquireAll({ dryRun: true, async checkClear() { return true; } });
    controller.pause();
    assert.equal(controller.dispatch({ workItemId: 'x' }, 'w'), null);
    controller.resume();
    const assigned = controller.dispatch({ workItemId: 'y' }, 'w');
    assert.equal(assigned?.workItemId, 'y');
    controller.finish(assigned!.leaseId);
    await controller.drainAndRelease(async () => undefined);
    const restarted = await controller.restartWithCapacity({ android: [4, 5], ios: [] });
    assert.equal(restarted.length, 2);
    assert.equal(restarted.every(lease => lease.state === 'owned-idle'), true);
  });

  test('release-failed can retry begin-release', async () => {
    const leases = createLeaseController({
      slotSet: { android: [1], ios: [] },
    });
    await leases.acquireAll({ dryRun: true, async checkClear() { return true; } });
    await leases.beginDrain();
    let attempts = 0;
    const first = await leases.releaseAll(async () => {
      attempts += 1;
      throw new Error('boom');
    });
    assert.equal(first.failed, 1);
    assert.equal(leases.list()[0]!.state, 'release-failed');
    const second = await leases.releaseAll(async () => {
      attempts += 1;
    });
    assert.equal(second.released, 1);
    assert.equal(attempts, 2);
    assert.equal(leases.list()[0]!.state, 'released');
  });

  test('restartWithCapacity fails closed on release-failed', async () => {
    const controller = createCampaignController({
      mode: 'diagnose',
      layoutKind: 'temporary',
      slotSet: { android: [1], ios: [] },
      dryRun: true,
      allowForceAcquire: false,
      receiptRoot: '/tmp/rngma-e2e-reliability/test-receipts',
      logRoot: '/tmp/rngma-e2e-reliability/test-logs',
    });
    await controller.leases.acquireAll({ dryRun: true, async checkClear() { return true; } });
    await controller.drainAndRelease(async () => {
      throw new Error('release boom');
    });
    assert.equal(controller.leases.list()[0]!.state, 'release-failed');
    await assert.rejects(
      controller.restartWithCapacity({ android: [2], ios: [] }),
      /release-failed/,
    );
    assert.throws(
      () => controller.leases.replaceCapacity({ android: [2], ios: [] }),
      /release-failed/,
    );
  });
});

describe('dual-platform Metro ownership', () => {
  test('same slot Android and iOS use distinct ports and cache roots', () => {
    const pair = assertDistinctPlatformMetro(1);
    assert.equal(pair.android.metroPort, 13007);
    assert.equal(pair.ios.metroPort, 13107);
    assert.notEqual(pair.android.roots.cache, pair.ios.roots.cache);

    const envAndroid = reliabilityMetroEnv(1, 'android', {});
    const envIos = reliabilityMetroEnv(1, 'ios', {});
    assert.equal(envAndroid.RNGMA_METRO_PORT, '13007');
    assert.equal(envIos.RNGMA_METRO_PORT, '13107');
    assert.notEqual(envAndroid.RNGMA_METRO_CACHE_ROOT, envIos.RNGMA_METRO_CACHE_ROOT);

    const shardEnv = reliabilityShardEnv(
      { platform: 'ios', slot: 2 },
      './test/specs/formats.smoke.a-primary.spec.ts',
      {},
    );
    assert.equal(shardEnv.RNGMA_E2E_METRO_SLOT, '2');
    assert.equal(
      shardEnv.RNGMA_METRO_PORT,
      String(metroOwnershipForSlotPlatform(2, 'ios').metroPort),
    );
  });
});

describe('live Appium shard runner attach', () => {
  test('maps spawn exit codes into shard outcomes without dry-run', async () => {
    const runner = createLiveAppiumShardRunner({
      platform: 'android',
      slot: 1,
      async spawn(request) {
        assert.equal(request.slot, 1);
        assert.equal(request.platform, 'android');
        assert.equal(request.env.RNGMA_WDIO_SPEC, request.spec);
        return { exitCode: 0 };
      },
    });
    const pass = await runner.runShard({
      iteration: 1,
      shardId: 'a-primary',
      spec: './test/specs/formats.smoke.a-primary.spec.ts',
      caseIds: ['banner', 'interstitial'],
      logPath: '/tmp/rngma-live-test.log',
      env: reliabilityShardEnv(
        { platform: 'android', slot: 1 },
        './test/specs/formats.smoke.a-primary.spec.ts',
        {},
      ),
    });
    assert.equal(pass.outcome, 'pass');
    assert.equal(pass.tests.every(testCase => testCase.outcome === 'pass'), true);

    const failRunner = createLiveAppiumShardRunner({
      platform: 'ios',
      slot: 2,
      async spawn() {
        return { exitCode: 1, detail: 'forced fail' };
      },
    });
    const fail = await failRunner.runShard({
      iteration: 1,
      shardId: 'a-primary',
      spec: './test/specs/formats.smoke.a-primary.spec.ts',
      caseIds: ['banner'],
      logPath: '/tmp/rngma-live-fail.log',
      env: {},
    });
    assert.equal(fail.outcome, 'fail');
    assert.equal(fail.detail, 'forced fail');
  });

  test('spawnProcessToLog tees full child output onto precreated logPath', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'rngma-live-log-'));
    const logPath = path.join(dir, 'shard.log');
    writeFileSync(logPath, '', { flag: 'wx' });
    const result = await spawnProcessToLog({
      bin: process.execPath,
      args: ['-e', "console.log('live-log-line'); console.error('live-err-line');"],
      cwd: dir,
      env: process.env,
      logPath,
    });
    assert.equal(result.exitCode, 0);
    const body = readFileSync(logPath, 'utf8');
    assert.match(body, /live-log-line/);
    assert.match(body, /live-err-line/);
    assert.match(result.detail ?? '', /live-log-line|live-err-line/);
  });
});

describe('capacity pilots', () => {
  test('measures 2/4/6/8/10-lane device-free pilots with steal drain restart', async () => {
    for (const lanes of CAPACITY_PILOT_LANES) {
      const set = slotSetForLanePilot(lanes);
      assert.equal(laneCount(set), lanes);
    }
    const results = await runAllCapacityPilots();
    assert.deepEqual(
      results.map(result => result.lanes),
      [...CAPACITY_PILOT_LANES],
    );
    for (const result of results) {
      assert.equal(result.acquired, result.lanes);
      assert.equal(result.heartbeats, result.lanes);
      assert.equal(result.pauseResumeOk, true);
      assert.equal(result.metroDistinct, true);
      assert.equal(result.failed, 0);
      assert.equal(result.released, result.lanes);
      assert.equal(result.restartedLanes >= 2, true);
      if (result.lanes >= 2) {
        assert.equal(result.steals, 1);
      }
    }

    const single = await runCapacityPilot(2, { restartLanes: 4 });
    assert.equal(single.restartedLanes, 4);
  });
});
