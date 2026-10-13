import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { createEvidenceLedger } from '../src/reliabilityEvidence.ts';
import {
  DASHBOARD_CANVAS_DEFERRED_REASON,
  DASHBOARD_NON_AUTHORITATIVE_BANNER,
  EVIDENCE_LEDGER_SNAPSHOT_KIND,
  buildDashboardDocument,
  checkDashboardIntegrity,
  computeDashboardEta,
  createEvidenceLedgerFromSnapshot,
  exportEvidenceLedgerSnapshot,
  readEvidenceLedgerSnapshot,
  refreshReliabilityDashboard,
  renderDashboardMarkdown,
  resolveDashboardAuthority,
  resolveRefreshDashboardLedgerSource,
  runDashboardPilot,
  writeDashboardArtifacts,
} from '../src/reliabilityDashboard.ts';

describe('dashboard authority and ETA', () => {
  test('authority requires real source with credits; fixture/empty stay non-authoritative', () => {
    assert.deepEqual(resolveDashboardAuthority({ ledgerSource: 'fixture', creditCount: 3 }), {
      authoritative: false,
      disclaimer: DASHBOARD_NON_AUTHORITATIVE_BANNER,
      statisticalCountsAllowed: false,
    });
    assert.deepEqual(resolveDashboardAuthority({ ledgerSource: 'live', creditCount: 0 }), {
      authoritative: false,
      disclaimer: DASHBOARD_NON_AUTHORITATIVE_BANNER,
      statisticalCountsAllowed: false,
    });
    assert.deepEqual(resolveDashboardAuthority({ ledgerSource: 'pilot', creditCount: 2 }), {
      authoritative: true,
      disclaimer: null,
      statisticalCountsAllowed: true,
    });
  });

  test('refresh source omits to fixture when a ledger file is present', () => {
    assert.equal(
      resolveRefreshDashboardLedgerSource({ ledgerSnapshotPresent: true }),
      'fixture',
    );
    assert.equal(
      resolveRefreshDashboardLedgerSource({ ledgerSnapshotPresent: false }),
      'live',
    );
    assert.equal(
      resolveRefreshDashboardLedgerSource({
        explicitSource: 'pilot',
        ledgerSnapshotPresent: true,
      }),
      'pilot',
    );
    assert.throws(
      () =>
        resolveRefreshDashboardLedgerSource({
          explicitSource: 'prod',
          ledgerSnapshotPresent: true,
        }),
      /dashboard-source must be fixture\|pilot\|live/,
    );
  });

  test('ETA math uses optimistic/base/pessimistic throughput; empty samples stay unavailable', () => {
    const empty = computeDashboardEta({ remainingObservations: 100, samples: [] });
    assert.equal(empty.etaMs.base, null);
    assert.match(empty.reason ?? '', /unavailable until measured/);

    const eta = computeDashboardEta({
      remainingObservations: 100,
      activeLanes: 2,
      samples: [
        { durationMs: 50_000, observationsCompleted: 10 },
        { durationMs: 100_000, observationsCompleted: 10 },
        { durationMs: 200_000, observationsCompleted: 10 },
      ],
    });
    assert.equal(eta.sampleCount, 3);
    assert.ok(eta.etaMs.optimistic != null && eta.etaMs.base != null && eta.etaMs.pessimistic != null);
    assert.ok(eta.etaMs.optimistic! < eta.etaMs.base!);
    assert.ok(eta.etaMs.base! < eta.etaMs.pessimistic!);
    assert.ok(eta.durationMs != null && eta.durationMs.p50 <= eta.durationMs.p95);
  });
});

describe('dashboard render and integrity', () => {
  test('empty live dashboard keeps banner, defers Canvas, and writes snapshot', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-dash-empty-'));
    const evidence = createEvidenceLedger();
    const document = buildDashboardDocument({
      evidence,
      ledgerSource: 'live',
      campaign: { status: 'awaiting-pilot-ledger' },
    });
    assert.equal(document.projection, 'ledger-derived');
    assert.equal(document.authoritative, false);
    assert.equal(document.disclaimer, DASHBOARD_NON_AUTHORITATIVE_BANNER);
    assert.equal(document.statisticalCounts, null);
    assert.equal(document.canvas.status, 'deferred');
    assert.equal(document.canvas.reason, DASHBOARD_CANVAS_DEFERRED_REASON);
    assert.equal(document.integrity.ok, true);

    const written = writeDashboardArtifacts(root, document, {
      ledgerSnapshot: exportEvidenceLedgerSnapshot(evidence),
    });
    assert.equal(existsSync(written.jsonPath), true);
    assert.equal(existsSync(written.markdownPath), true);
    assert.equal(existsSync(written.snapshotPath), true);
    assert.ok(written.ledgerSnapshotPath != null);
    assert.equal(existsSync(written.ledgerSnapshotPath), true);
    const md = readFileSync(written.markdownPath, 'utf8');
    assert.match(md, /manual\/untested projection — no statistical counts/);
    assert.match(md, /Canvas: deferred/);
    assert.match(renderDashboardMarkdown(document), /Statistical counts intentionally empty/);
  });

  test('fixture ledger with matching receipt pairs without promoting counts', () => {
    const evidence = createEvidenceLedger();
    evidence.creditPass({
      cellKey: {
        configuration: 'ios',
        cellKind: 'startup',
        cellId: 'session-create',
      },
      dependencyDigests: {
        layout: 'abc',
        policy: 'def',
        'cell:ios:startup:session-create': 'digest-cell',
      },
      receiptId: 'rcpt_test_1',
    });
    const document = buildDashboardDocument({
      evidence,
      ledgerSource: 'fixture',
      receipts: [
        {
          receiptId: 'rcpt_test_1',
          jobId: 'job_1',
          sequence: 1,
          recordedAt: '2026-10-13T00:00:00.000Z',
          iteration: 1,
          cellKind: 'startup',
          cellId: 'session-create',
          outcome: 'pass',
          counted: true,
        },
      ],
      resources: {
        slots: [
          {
            slot: 2,
            platform: 'ios',
            state: 'owned-running',
            metroPort: 13107,
            metroRssBytes: 64_000_000,
            bundleP95Ms: 3100,
            deviceAgeDays: 7,
          },
        ],
        diskBytes: 2048,
        diskCeilingBytes: 1024 * 1024 * 1024,
        watchdogs: [{ name: 'lease', status: 'ok', detail: 'heartbeat' }],
      },
      timingSamples: [
        { durationMs: 40_000, observationsCompleted: 8 },
        { durationMs: 80_000, observationsCompleted: 8 },
        { durationMs: 160_000, observationsCompleted: 8 },
      ],
      activeLanes: 1,
      riskStates: [
        {
          caseId: 'session-create',
          platform: 'ios',
          color: 'amber',
          consecutiveIndividualGreens: 10,
          consecutiveCandidateShardGreens: 0,
          consecutiveFinalLayoutGreens: 0,
          unresolvedFailure: false,
          lastFailureSignature: null,
        },
      ],
    });
    assert.equal(document.authoritative, false);
    assert.equal(document.statisticalCountsAllowed, false);
    assert.equal(document.statisticalCounts, null);
    assert.equal(document.cells.length, 1);
    assert.equal(document.cells[0]!.risk, 'amber');
    assert.equal(document.integrity.ok, true);
    assert.equal(
      document.integrity.findings.some(finding => finding.code === 'missing-receipt'),
      false,
    );
    const md = renderDashboardMarkdown(document);
    assert.match(md, /Non-authoritative ledger preview/);
    assert.match(md, /metroRssBytes=64000000/);
    assert.match(md, /bundleP95Ms=3100/);
    assert.match(md, /deviceAgeDays=7/);
    assert.match(md, /Disk: 2048 \/ ceiling 1073741824/);
    assert.match(md, /Watchdog lease: ok \(heartbeat\)/);
    assert.match(md, /ETA optimistic:/);
    assert.match(md, /ETA base:/);
    assert.match(md, /ETA pessimistic:/);
  });

  test('integrity warns on missing-receipt without failing the report', () => {
    const evidence = createEvidenceLedger();
    evidence.creditPass({
      cellKey: {
        configuration: 'ios',
        cellKind: 'startup',
        cellId: 'session-create',
      },
      dependencyDigests: { layout: 'abc', policy: 'def' },
      receiptId: 'rcpt_missing',
    });
    const report = checkDashboardIntegrity({
      evidence,
      receipts: [
        {
          receiptId: 'rcpt_other',
          jobId: 'job_1',
          sequence: 1,
          recordedAt: '2026-10-13T00:00:00.000Z',
          iteration: 1,
          cellKind: 'startup',
          cellId: 'session-create',
          outcome: 'pass',
          counted: true,
        },
      ],
    });
    assert.equal(report.ok, true);
    assert.equal(
      report.findings.some(
        finding =>
          finding.code === 'missing-receipt' && finding.severity === 'warning',
      ),
      true,
    );
  });

  test('pilot ledger promotes statistical counts and passes integrity', () => {
    const evidence = createEvidenceLedger();
    evidence.creditPass({
      cellKey: {
        configuration: 'android-nextgen',
        cellKind: 'test',
        cellId: 'banner',
      },
      dependencyDigests: { layout: 'L', policy: 'P' },
      receiptId: 'rcpt_pilot_1',
    });
    evidence.creditSuite({ configuration: 'android-nextgen', outcome: 'pass' });
    const document = buildDashboardDocument({
      evidence,
      ledgerSource: 'pilot',
      timingSamples: [{ durationMs: 30_000, observationsCompleted: 5 }],
      activeLanes: 1,
    });
    assert.equal(document.authoritative, true);
    assert.equal(document.disclaimer, null);
    assert.ok(document.statisticalCounts != null);
    assert.equal(document.statisticalCounts!.totalValidCredits, 1);
    assert.equal(document.integrity.ok, true);
    const md = renderDashboardMarkdown(document);
    assert.match(md, /statistical counts authoritative/);
    assert.match(md, /ETA optimistic:/);
    assert.match(md, /ETA base:/);
    assert.match(md, /ETA pessimistic:/);
  });

  test('integrity detects receipt cell mismatch and projection epoch drift', () => {
    const evidence = createEvidenceLedger();
    evidence.creditPass({
      cellKey: {
        configuration: 'android-nextgen',
        cellKind: 'test',
        cellId: 'banner',
      },
      dependencyDigests: { layout: 'L' },
      receiptId: 'rcpt_bad',
    });
    const report = checkDashboardIntegrity({
      evidence,
      receipts: [
        {
          receiptId: 'rcpt_bad',
          jobId: 'job_1',
          sequence: 1,
          recordedAt: '2026-10-13T00:00:00.000Z',
          iteration: 1,
          cellKind: 'test',
          cellId: 'native',
          outcome: 'pass',
          counted: true,
        },
      ],
      document: {
        epoch: evidence.epoch() + 1,
        cells: [],
        suites: [],
        statisticalCounts: null,
        authoritative: false,
      },
    });
    assert.equal(report.ok, false);
    assert.equal(
      report.findings.some(finding => finding.code === 'receipt-cell-mismatch'),
      true,
    );
    assert.equal(
      report.findings.some(finding => finding.code === 'epoch-mismatch'),
      true,
    );
  });

  test('snapshot export/import round-trips credits and refresh writes artifacts', () => {
    const evidence = createEvidenceLedger();
    evidence.creditPass({
      cellKey: {
        configuration: 'ios',
        cellKind: 'preamble',
        cellId: 'shard-ready',
      },
      dependencyDigests: { layout: 'L', policy: 'P' },
      receiptId: 'rcpt_roundtrip',
    });
    evidence.creditSuite({ configuration: 'ios', outcome: 'fail' });
    const snapshot = exportEvidenceLedgerSnapshot(evidence);
    assert.equal(snapshot.kind, EVIDENCE_LEDGER_SNAPSHOT_KIND);
    const restored = createEvidenceLedgerFromSnapshot(snapshot);
    assert.equal(restored.epoch(), evidence.epoch());
    assert.equal(restored.listCredits({ validOnly: true }).length, 1);
    assert.equal(restored.suiteSignal('ios').suiteFailures, 1);

    const root = mkdtempSync(path.join(tmpdir(), 'rngma-dash-refresh-'));
    const snapshotPath = path.join(root, 'ledger.json');
    writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

    const written = refreshReliabilityDashboard({
      reportRoot: path.join(root, 'out'),
      ledgerSnapshotPath: snapshotPath,
      ledgerSource: 'pilot',
    });
    assert.equal(written.document.authoritative, true);
    assert.equal(existsSync(written.snapshotPath), true);
    assert.ok(written.ledgerSnapshotPath != null);
    assert.equal(existsSync(written.ledgerSnapshotPath), true);
    const parsed = JSON.parse(readFileSync(written.jsonPath, 'utf8'));
    assert.equal(parsed.projection, 'ledger-derived');
    assert.equal(parsed.cells[0].cellId, 'shard-ready');
    const reloaded = readEvidenceLedgerSnapshot(written.ledgerSnapshotPath);
    assert.equal(reloaded.kind, EVIDENCE_LEDGER_SNAPSHOT_KIND);
    assert.equal(reloaded.credits.length, 1);
  });

  test('refresh with ledger credits stays non-authoritative without explicit pilot/live', () => {
    const evidence = createEvidenceLedger();
    evidence.creditPass({
      cellKey: {
        configuration: 'android-nextgen',
        cellKind: 'test',
        cellId: 'banner',
      },
      dependencyDigests: { layout: 'L', policy: 'P' },
      receiptId: 'rcpt_fixture_default',
    });
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-dash-auth-default-'));
    const ledgerPath = path.join(root, 'ledger.json');
    writeFileSync(
      ledgerPath,
      `${JSON.stringify(exportEvidenceLedgerSnapshot(evidence), null, 2)}\n`,
    );

    const written = refreshReliabilityDashboard({
      reportRoot: path.join(root, 'out'),
      ledgerSnapshotPath: ledgerPath,
      // intentionally omit ledgerSource — must default to fixture
    });
    assert.equal(written.document.ledgerSource, 'fixture');
    assert.equal(written.document.authoritative, false);
    assert.equal(written.document.statisticalCounts, null);
    assert.equal(written.document.disclaimer, DASHBOARD_NON_AUTHORITATIVE_BANNER);
    assert.equal(written.document.cells.length, 1);
  });

  test('readEvidenceLedgerSnapshot rejects DashboardDocument epoch snapshots', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-dash-format-'));
    const evidence = createEvidenceLedger();
    const document = buildDashboardDocument({
      evidence,
      ledgerSource: 'live',
    });
    const written = writeDashboardArtifacts(root, document, {
      ledgerSnapshot: exportEvidenceLedgerSnapshot(evidence),
    });
    assert.throws(
      () => readEvidenceLedgerSnapshot(written.snapshotPath),
      /DashboardDocument \(dashboard\/epoch snapshot\)/,
    );
    const ok = readEvidenceLedgerSnapshot(written.ledgerSnapshotPath!);
    assert.equal(ok.kind, EVIDENCE_LEDGER_SNAPSHOT_KIND);
  });
});

describe('dashboard pilot', () => {
  test('runDashboardPilot proves empty banner, pilot authority, ETA, and snapshot', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rngma-dash-pilot-'));
    const result = await runDashboardPilot({ reportRoot: root });
    assert.equal(result.authoritativeEmpty, false);
    assert.equal(result.authoritativePilot, true);
    assert.equal(result.integrityOk, true);
    assert.equal(result.snapshotWritten, true);
    assert.ok(result.etaBaseMs != null && result.etaBaseMs > 0);
    assert.equal(result.disclaimerEmpty, DASHBOARD_NON_AUTHORITATIVE_BANNER);
    assert.equal(result.disclaimerPilot, null);
    assert.equal(result.canvasDeferred, true);

    const pilotMd = readFileSync(path.join(root, 'pilot', 'dashboard.md'), 'utf8');
    assert.match(pilotMd, /metroRssBytes=128000000/);
    assert.match(pilotMd, /bundleP95Ms=4200/);
    assert.match(pilotMd, /deviceAgeDays=3/);
    assert.match(pilotMd, /ETA optimistic:/);
    assert.match(pilotMd, /ETA base:/);
    assert.match(pilotMd, /ETA pessimistic:/);
    assert.equal(
      existsSync(path.join(root, 'pilot', 'ledger-snapshot.json')),
      true,
    );
  });
});
