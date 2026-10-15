import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { join } from 'node:path';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';
import {
  classifyWdaBundleInstallProbe,
  clearXcodebuildExitState,
  collectIosSessionCreateDiagnosticSnapshot,
  emitIosSessionCreateDiagnostics,
  formatIosSessionDiagnosticLine,
  hangRecoverArtifactSnapshotDir,
  hostPidsIndicateLiveBuild,
  installXcodebuildExitLogTap,
  IOS_SESSION_HOST_PGREP_TIMEOUT_MS,
  listWdaDerivedDataLogPaths,
  listWdaRelatedHostProcesses,
  parseXcodebuildExitCodeFromLine,
  readXcodebuildExitState,
  resolveLastXcodebuildExit,
  shouldDeferHangRecoverForLiveHostBuild,
  snapshotWdaDerivedDataForHangRecover,
  xcodebuildExitStatePath,
  type SessionExecCapture,
} from '../src/iosSessionDiagnostics.ts';
import { IOS_BOOTSTATUS_PROBE_TIMEOUT_MS } from '../src/iosBootDiagnostics.ts';

describe('iosSessionDiagnostics', () => {
  test('formatIosSessionDiagnosticLine uses stable prefix', () => {
    const line = formatIosSessionDiagnosticLine(
      { phase: 'hang-probe', udid: 'u1', listState: 'Booted' },
      () => new Date('2026-10-15T12:00:00.000Z'),
    );
    assert.equal(
      line,
      '[e2e-ios-session] ts=2026-10-15T12:00:00.000Z phase=hang-probe udid=u1 listState=Booted',
    );
  });

  test('parseXcodebuildExitCodeFromLine reads Appium Xcode logger forms', () => {
    assert.equal(
      parseXcodebuildExitCodeFromLine(
        "[Xcode] xcodebuild exited with code '65' and signal 'null'",
      ),
      65,
    );
    assert.equal(
      parseXcodebuildExitCodeFromLine('xcodebuild failed with code 65. This usually'),
      65,
    );
    assert.equal(parseXcodebuildExitCodeFromLine('unrelated'), null);
  });

  test('classifyWdaBundleInstallProbe emits timedOut/unknown instead of installed=no', () => {
    assert.equal(
      classifyWdaBundleInstallProbe({
        stdout: '',
        stderr: '',
        status: null,
        timedOut: true,
        error: 'spawnSync ETIMEDOUT',
      }),
      'timedOut',
    );
    assert.equal(
      classifyWdaBundleInstallProbe({
        stdout: '',
        stderr: '',
        status: null,
        error: 'spawn ENOENT',
      }),
      'unknown',
    );
    assert.equal(
      classifyWdaBundleInstallProbe({ stdout: '/apps/wda\n', stderr: '', status: 0 }),
      'yes',
    );
    assert.equal(
      classifyWdaBundleInstallProbe({ stdout: '', stderr: 'not found', status: 1 }),
      'no',
    );
  });

  test('listWdaRelatedHostProcesses parses pgrep -fl and hard-caps timeout', () => {
    const timeouts: number[] = [];
    const execCapture: SessionExecCapture = (_bin, args, options) => {
      timeouts.push(options?.timeoutMs ?? -1);
      const marker = args[1]!;
      if (marker === 'xcodebuild') {
        return { stdout: '111 /usr/bin/xcodebuild test\n222 other\n', stderr: '', status: 0 };
      }
      return { stdout: '', stderr: '', status: 1 };
    };
    const snaps = listWdaRelatedHostProcesses(execCapture, ['xcodebuild', 'WebDriverAgent']);
    assert.deepEqual(
      snaps.find(s => s.marker === 'xcodebuild')?.pids,
      [111, 222],
    );
    assert.deepEqual(snaps.find(s => s.marker === 'WebDriverAgent')?.pids, []);
    assert.ok(timeouts.every(ms => ms === IOS_SESSION_HOST_PGREP_TIMEOUT_MS));
    assert.ok(IOS_SESSION_HOST_PGREP_TIMEOUT_MS < 5_000);
  });

  test('listWdaRelatedHostProcesses surfaces pgrep timedOut', () => {
    const snaps = listWdaRelatedHostProcesses(() => ({
      stdout: '',
      stderr: '',
      status: null,
      timedOut: true,
      error: 'spawnSync ETIMEDOUT',
    }), ['xcodebuild']);
    assert.equal(snaps[0]!.timedOut, true);
    assert.deepEqual(snaps[0]!.pids, []);
  });

  test('listWdaDerivedDataLogPaths returns newest matching files', () => {
    const root = '/tmp/fake-wda-derived';
    const buildLog = join(root, 'Logs', 'Build', 'build.xcactivitylog');
    const textLog = join(root, 'Logs', 'Test', 'run.log');
    const files = new Map<string, { size: number; mtimeMs: number; dir?: boolean }>([
      [root, { size: 0, mtimeMs: 1, dir: true }],
      [join(root, 'Logs'), { size: 0, mtimeMs: 1, dir: true }],
      [join(root, 'Logs', 'Build'), { size: 0, mtimeMs: 1, dir: true }],
      [join(root, 'Logs', 'Test'), { size: 0, mtimeMs: 1, dir: true }],
      [buildLog, { size: 100, mtimeMs: 50 }],
      [textLog, { size: 20, mtimeMs: 90 }],
    ]);
    const children = new Map<string, string[]>([
      [join(root, 'Logs'), ['Build', 'Test']],
      [join(root, 'Logs', 'Build'), ['build.xcactivitylog']],
      [join(root, 'Logs', 'Test'), ['run.log']],
    ]);
    const listed = listWdaDerivedDataLogPaths(root, {
      existsSyncFn: path => files.has(path) || children.has(path),
      readdirSyncFn: path => children.get(path) ?? [],
      statSyncFn: path => {
        const info = files.get(path);
        if (!info) {
          throw new Error(`missing ${path}`);
        }
        return {
          isFile: () => !info.dir,
          isDirectory: () => info.dir === true,
          size: info.size,
          mtimeMs: info.mtimeMs,
        } as ReturnType<typeof import('node:fs').statSync>;
      },
    });
    assert.equal(listed[0]!.path, textLog);
    assert.equal(listed[1]!.path, buildLog);
  });

  test('hang-path snapshot uses host pgrep + filesystem only (no simctl)', () => {
    const lines: string[] = [];
    const bins: string[] = [];
    const execCapture: SessionExecCapture = (bin, args) => {
      bins.push(bin);
      assert.notEqual(bin, 'xcrun');
      assert.ok(!args.includes('get_app_container'));
      if (bin === 'pgrep') {
        const marker = args[1] ?? '';
        if (marker === 'xcodebuild') {
          return { stdout: '42 /usr/bin/xcodebuild\n', stderr: '', status: 0 };
        }
        return { stdout: '', stderr: '', status: 1 };
      }
      return { stdout: '', stderr: '', status: 1 };
    };
    const snapshot = emitIosSessionCreateDiagnostics(
      'target-udid',
      {
        phase: 'serial:session-create:hang-recover',
        listState: 'Booted',
        bootstatusTimedOut: true,
        bootstatusProbeTimeoutMs: IOS_BOOTSTATUS_PROBE_TIMEOUT_MS,
        lastXcodebuildExit: 65,
        derivedDataPath: '/tmp/missing-derived',
        wdaRunnerAppPath: '/tmp/missing-runner.app',
        execCapture,
        existsSyncFn: () => false,
        listLogPaths: () => [
          { path: '/tmp/missing-derived/Logs/Build/a.xcactivitylog', bytes: 10, mtimeMs: 1 },
        ],
        now: () => new Date('2026-10-15T13:00:00.000Z'),
      },
      line => lines.push(line),
    );
    assert.equal(snapshot.lastXcodebuildExit, '65');
    assert.equal(snapshot.hostXcodebuildPids, '42');
    assert.equal(snapshot.hostPgrepTimedOut, false);
    assert.equal(snapshot.bootstatusProbeTimeoutMs, IOS_BOOTSTATUS_PROBE_TIMEOUT_MS);
    assert.ok(bins.every(bin => bin === 'pgrep'));
    assert.match(lines[0]!, /\[e2e-ios-session\]/);
    assert.match(lines[0]!, /phase=serial:session-create:hang-recover/);
    assert.match(lines[0]!, /listState=Booted/);
    assert.match(lines[0]!, /bootstatusTimedOut=true/);
    assert.match(lines[0]!, new RegExp(`bootstatusProbeTimeoutMs=${IOS_BOOTSTATUS_PROBE_TIMEOUT_MS}`));
    assert.match(lines[0]!, /lastXcodebuildExit=65/);
    assert.match(lines[0]!, /hostXcodebuildPids=42/);
    assert.match(lines[0]!, /hostPgrepTimedOut=false/);
    assert.match(lines[0]!, /wdaLogPathCount=1/);
    assert.doesNotMatch(lines[0]!, /wdaBundlesInstalled/);

    const collected = collectIosSessionCreateDiagnosticSnapshot('target-udid', {
      phase: 'x',
      bootstatusProbeTimeoutMs: 5_000,
      derivedDataPath: '/tmp/missing-derived',
      wdaRunnerAppPath: '/tmp/missing-runner.app',
      execCapture,
      existsSyncFn: () => true,
      listLogPaths: () => [],
    });
    assert.equal(collected.wdaRunnerAppPresent, true);
    assert.equal(collected.derivedDataExists, true);
  });

  test('installXcodebuildExitLogTap persists launcher exit codes to the sidecar file', () => {
    const root = mkdtempSync(pathJoin(tmpdir(), 'rngma-xcodebuild-exit-'));
    try {
      const statePath = xcodebuildExitStatePath(4725, root);
      clearXcodebuildExitState(statePath);
      const ref = { value: null as number | null };
      const writes: string[] = [];
      const fakeStream = {
        write(...args: unknown[]) {
          writes.push(String(args[0] ?? ''));
          return true;
        },
      };
      const uninstall = installXcodebuildExitLogTap(ref, {
        stdout: fakeStream,
        stderr: fakeStream,
        statePath,
      });
      fakeStream.write("[Xcode] xcodebuild exited with code '65' and signal 'null'\n");
      assert.equal(ref.value, 65);
      assert.equal(readXcodebuildExitState(statePath), 65);
      assert.equal(readFileSync(statePath, 'utf8').trim(), '65');
      assert.ok(writes.some(chunk => /xcodebuild exited with code '65'/.test(chunk)));
      uninstall();
      fakeStream.write("[Xcode] xcodebuild exited with code '70'\n");
      assert.equal(ref.value, 65, 'uninstall must stop updating the ref');
      assert.equal(readXcodebuildExitState(statePath), 65);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('resolveLastXcodebuildExit prefers ref then sidecar (worker reads launcher file)', () => {
    assert.equal(resolveLastXcodebuildExit({}), undefined);
    assert.equal(
      resolveLastXcodebuildExit({ lastXcodebuildExitRef: { value: null } }),
      null,
    );
    assert.equal(
      resolveLastXcodebuildExit({ lastXcodebuildExitRef: { value: 65 } }),
      65,
    );
    assert.equal(
      resolveLastXcodebuildExit({
        lastXcodebuildExitRef: { value: null },
        lastXcodebuildExitStatePath: '/tmp/missing-exit',
        readState: () => 70,
      }),
      70,
    );
    assert.equal(
      resolveLastXcodebuildExit({
        lastXcodebuildExitRef: { value: 65 },
        lastXcodebuildExitStatePath: '/tmp/x',
        readState: () => 70,
      }),
      65,
    );
  });

  test('shouldDeferHangRecoverForLiveHostBuild gates kill while PIDs live and exit unknown', () => {
    assert.equal(hostPidsIndicateLiveBuild('(none)'), false);
    assert.equal(hostPidsIndicateLiveBuild('42'), true);
    assert.equal(hostPidsIndicateLiveBuild('timedOut'), true);
    const deferred = shouldDeferHangRecoverForLiveHostBuild({
      hostXcodebuildPids: '99',
      hostWdaPids: '(none)',
      lastXcodebuildExit: '(none)',
    });
    assert.equal(deferred.defer, true);
    assert.match(deferred.reason ?? '', /host build still live/);
    assert.equal(
      shouldDeferHangRecoverForLiveHostBuild({
        hostXcodebuildPids: '99',
        hostWdaPids: '(none)',
        lastXcodebuildExit: '65',
      }).defer,
      false,
    );
    assert.equal(
      shouldDeferHangRecoverForLiveHostBuild({
        hostXcodebuildPids: '(none)',
        hostWdaPids: '(none)',
        lastXcodebuildExit: '(none)',
      }).defer,
      false,
    );
  });

  test('snapshotWdaDerivedDataForHangRecover copies xcresult and log files', () => {
    const root = mkdtempSync(pathJoin(tmpdir(), 'rngma-wda-snap-'));
    try {
      const logsDir = pathJoin(root, 'Logs', 'Test');
      mkdirSync(logsDir, { recursive: true });
      const xcresult = pathJoin(logsDir, 'Run.xcresult');
      mkdirSync(xcresult, { recursive: true });
      writeFileSync(pathJoin(xcresult, 'Info.plist'), 'plist');
      const logFile = pathJoin(logsDir, 'run.log');
      writeFileSync(logFile, 'hello');
      const dest = hangRecoverArtifactSnapshotDir(root);
      const result = snapshotWdaDerivedDataForHangRecover(root, dest);
      assert.ok(result.copiedPaths.length >= 2);
      assert.ok(result.copiedPaths.some(p => p.endsWith('Run.xcresult')));
      assert.ok(result.copiedPaths.some(p => p.endsWith('run.log')));
      assert.equal(result.errors.length, 0);
      assert.equal(readFileSync(pathJoin(dest, 'run.log'), 'utf8'), 'hello');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
