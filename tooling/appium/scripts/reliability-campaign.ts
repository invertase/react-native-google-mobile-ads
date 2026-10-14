#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertCampaignDryRun,
  createCampaignController,
  parseReliabilityCampaignArgv,
  runAllCapacityPilots,
  runCapacityPilot,
  runRiskPilot,
  runStatsPilot,
} from '../src/reliabilityCampaign.ts';
import { laneCount } from '../src/reliabilityCapacity.ts';
import {
  DASHBOARD_NON_AUTHORITATIVE_BANNER,
  defaultDashboardReportRoot,
  refreshReliabilityDashboard,
  resolveRefreshDashboardLedgerSource,
  runDashboardPilot,
} from '../src/reliabilityDashboard.ts';
import { STATS_PROJECTION_DISCLAIMER } from '../src/reliabilityStats.ts';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

function flagValue(argv: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  for (const argument of argv) {
    if (argument.startsWith(prefix)) {
      return argument.slice(prefix.length);
    }
  }
  const index = argv.indexOf(name);
  if (index >= 0) {
    return argv[index + 1];
  }
  return undefined;
}

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
      '[reliability-campaign] device-free risk scheduler / flake reducer / circuit breaker / burn-in gate pilot',
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
      `[reliability-campaign] riskPilot isolated=${result.scheduledIsolated} affinity=${result.scheduledAffinity} artifacts=${result.artifactsWritten} circuitTripped=${result.circuitTripped} circuit=${result.circuitState} probabilisticNeighbors=${result.probabilisticNeighbors} dispatchBlocked=${result.dispatchBlockedWhileOpen} resumed=${result.resumedAcceptingWork} burnInGateClosed=${result.burnInGateClosed} burnInGateCells=${result.burnInGateCellCount} burnInGateReady=${result.burnInGateQualificationReady} hostLoadRejected=${result.hostLoadClaimRejected}`,
    );
    if (
      !result.circuitTripped ||
      !result.dispatchBlockedWhileOpen ||
      !result.resumedAcceptingWork ||
      result.scheduledIsolated < 1 ||
      result.scheduledAffinity < 1 ||
      result.artifactsWritten < 1 ||
      !result.burnInGateClosed ||
      result.burnInGateQualificationReady < 1 ||
      !result.hostLoadClaimRejected
    ) {
      throw new Error('Risk pilot failed adaptive flake-reducer / burn-in gate checks.');
    }
    return;
  }

  if (argv.includes('--run-stats-pilot')) {
    console.log(
      '[reliability-campaign] device-free statistical qualification / scoped invalidation pilot',
    );
    const result = await runStatsPilot();
    console.log(
      `[reliability-campaign] statsPilot zeroFailureTarget=${result.zeroFailureTarget} checkpoints=${result.checkpointsLocked} creditedPasses=${result.creditedPasses} retainedFailures=${result.retainedFailures} unaffectedValid=${result.unaffectedCellStillValid} invalidated=${result.invalidatedCredits} epoch=${result.epochAfterInvalidation} suiteIndependent=${result.suiteIndependent} scheduleRemaining=${result.scheduleRemaining} authoritative=${result.projectionAuthoritative} disclaimer=${JSON.stringify(result.projectionDisclaimer)}`,
    );
    if (
      result.zeroFailureTarget !== 2995 ||
      result.checkpointsLocked < 1 ||
      !result.unaffectedCellStillValid ||
      result.invalidatedCredits < 1 ||
      !result.suiteIndependent ||
      result.projectionAuthoritative !== false ||
      result.projectionDisclaimer !== STATS_PROJECTION_DISCLAIMER
    ) {
      throw new Error('Stats pilot failed statistical qualification checks.');
    }
    return;
  }

  if (argv.includes('--run-dashboard-pilot')) {
    console.log(
      '[reliability-campaign] device-free ledger-derived dashboard / integrity / ETA pilot',
    );
    const reportRoot = flagValue(argv, '--dashboard-root');
    const result = await runDashboardPilot(
      reportRoot != null ? { reportRoot } : {},
    );
    console.log(
      `[reliability-campaign] dashboardPilot authoritativeEmpty=${result.authoritativeEmpty} authoritativePilot=${result.authoritativePilot} integrityOk=${result.integrityOk} snapshotWritten=${result.snapshotWritten} etaBaseMs=${result.etaBaseMs} canvasDeferred=${result.canvasDeferred} disclaimerEmpty=${JSON.stringify(result.disclaimerEmpty)} disclaimerPilot=${JSON.stringify(result.disclaimerPilot)}`,
    );
    if (
      result.authoritativeEmpty !== false ||
      result.authoritativePilot !== true ||
      !result.integrityOk ||
      !result.snapshotWritten ||
      result.etaBaseMs == null ||
      result.disclaimerEmpty !== DASHBOARD_NON_AUTHORITATIVE_BANNER ||
      result.disclaimerPilot != null
    ) {
      throw new Error('Dashboard pilot failed ledger-derived dashboard checks.');
    }
    return;
  }

  if (argv.includes('--refresh-dashboard')) {
    // Formats: --dashboard-ledger=EvidenceLedgerSnapshot (kind evidence-ledger-snapshot;
    // typically ledger-snapshot.json). snapshots/epoch-<n>.json is DashboardDocument
    // and is rejected. Omitted --dashboard-source with a ledger file defaults to
    // fixture (non-authoritative); pass pilot|live explicitly to promote credits.
    const reportRoot =
      flagValue(argv, '--dashboard-root') ??
      defaultDashboardReportRoot(repositoryRoot);
    const ledgerSnapshotPath = flagValue(argv, '--dashboard-ledger');
    const campaignMetaPath = flagValue(argv, '--dashboard-meta');
    const ledgerSource = resolveRefreshDashboardLedgerSource({
      explicitSource: flagValue(argv, '--dashboard-source'),
      ledgerSnapshotPresent: ledgerSnapshotPath != null,
    });
    const written = refreshReliabilityDashboard({
      reportRoot,
      ...(ledgerSnapshotPath != null ? { ledgerSnapshotPath } : {}),
      ...(campaignMetaPath != null ? { campaignMetaPath } : {}),
      ledgerSource,
    });
    console.log(
      `[reliability-campaign] refreshed dashboard root=${reportRoot} json=${written.jsonPath} md=${written.markdownPath} epochSnapshot=${written.snapshotPath} ledgerSnapshot=${written.ledgerSnapshotPath ?? 'n/a'} source=${ledgerSource} authoritative=${written.document.authoritative} integrityOk=${written.document.integrity.ok} epoch=${written.document.epoch}`,
    );
    if (!written.document.integrity.ok) {
      throw new Error('Dashboard refresh failed integrity checks.');
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
