#!/usr/bin/env node
import {
  assertCampaignDryRun,
  createCampaignController,
  parseReliabilityCampaignArgv,
  runAllCapacityPilots,
  runCapacityPilot,
  runRiskPilot,
} from '../src/reliabilityCampaign.ts';
import { laneCount } from '../src/reliabilityCapacity.ts';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--run-capacity-pilots')) {
    console.log('[reliability-campaign] device-free capacity pilots for lanes 2/4/6/8/10');
    const results = await runAllCapacityPilots();
    for (const result of results) {
      console.log(
        `[reliability-campaign] lanes=${result.lanes} acquired=${result.acquired} heartbeats=${result.heartbeats} steals=${result.steals} released=${result.released} restartedLanes=${result.restartedLanes} pauseResumeOk=${result.pauseResumeOk} metroDistinct=${result.metroDistinct}`,
      );
    }
    const failed = results.filter(
      result =>
        !result.pauseResumeOk ||
        !result.metroDistinct ||
        result.failed > 0 ||
        result.acquired !== result.lanes,
    );
    if (failed.length > 0) {
      throw new Error(
        `Capacity pilots failed for lanes: ${failed.map(result => result.lanes).join(', ')}.`,
      );
    }
    return;
  }

  if (argv.includes('--run-risk-pilot')) {
    console.log(
      '[reliability-campaign] device-free risk scheduler / flake reducer / circuit breaker pilot',
    );
    // Parse shared flags (including --artifact-root) before the pilot; mode is
    // unused by runRiskPilot but required by the campaign argv parser.
    const pilotArgv = argv.some(
      argument =>
        argument === '--mode' ||
        argument.startsWith('--mode=') ||
        (!argument.startsWith('-') &&
          (argument === 'diagnose' || argument === 'burn-in' || argument === 'qualify')),
    )
      ? argv
      : ['diagnose', ...argv];
    const pilotOptions = parseReliabilityCampaignArgv(pilotArgv, process.env);
    const result = await runRiskPilot(
      pilotOptions.artifactRoot != null
        ? { artifactRoot: pilotOptions.artifactRoot }
        : {},
    );
    console.log(
      `[reliability-campaign] riskPilot isolated=${result.scheduledIsolated} affinity=${result.scheduledAffinity} artifacts=${result.artifactsWritten} circuitTripped=${result.circuitTripped} circuit=${result.circuitState} probabilisticNeighbors=${result.probabilisticNeighbors} dispatchBlocked=${result.dispatchBlockedWhileOpen} resumed=${result.resumedAcceptingWork}`,
    );
    if (
      !result.circuitTripped ||
      !result.dispatchBlockedWhileOpen ||
      !result.resumedAcceptingWork ||
      result.scheduledIsolated < 1 ||
      result.scheduledAffinity < 1 ||
      result.artifactsWritten < 1
    ) {
      throw new Error('Risk pilot failed adaptive flake-reducer checks.');
    }
    return;
  }

  const options = parseReliabilityCampaignArgv(argv, process.env);
  assertCampaignDryRun(options);

  const controller = createCampaignController(options);
  console.log(
    `[reliability-campaign] mode=${options.mode} layout=${options.layoutKind} lanes=${laneCount(options.slotSet)} android=[${options.slotSet.android.join(',')}] ios=[${options.slotSet.ios.join(',')}] dryRun=${options.dryRun}`,
  );

  if (options.pilotLanes != null) {
    const pilot = await runCapacityPilot(options.pilotLanes);
    console.log(
      `[reliability-campaign] pilot lanes=${pilot.lanes} acquired=${pilot.acquired} steals=${pilot.steals} released=${pilot.released} restartedLanes=${pilot.restartedLanes}`,
    );
    return;
  }

  await controller.leases.acquireAll({ dryRun: true, async checkClear() { return true; } });
  for (const lease of controller.leases.list()) {
    controller.heartbeat(lease.leaseId, `bootstrap-${lease.leaseId}`);
    console.log(
      `[reliability-campaign] lease=${lease.leaseId} state=${lease.state} metro=${lease.metro.metroPort} cache=${lease.metro.roots.cache}`,
    );
  }

  const drained = await controller.drainAndRelease(async () => undefined);
  console.log(
    `[reliability-campaign] drained released=${drained.released} failed=${drained.failed}`,
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
