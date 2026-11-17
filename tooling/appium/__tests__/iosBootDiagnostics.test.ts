import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import {
  assertSimulatorReadyForPersist,
  collectIosBootDiagnosticLines,
  confirmSimulatorReadyForPersist,
  decideSessionCreateHangAction,
  findSimulatorDeviceInListJson,
  formatIosBootDiagnosticLine,
  formatIosIsHeadlessCapResolveLine,
  formatSessionCreateAbortSummary,
  formatSessionCreateHangAbortError,
  IOS_SESSION_CREATE_HANG_ABORT_AFTER_TICKS,
  IOS_SESSION_CREATE_HANG_RECOVER_AFTER_TICKS,
  IOS_SESSION_CREATE_HANG_WDA_PORT_DOWN_ESCALATE_TICKS,
  IOS_SESSION_CREATE_HANG_HINT,
  IOS_SESSION_CREATE_HANG_LIVE_PID_DEFER_MAX_TICKS,
  IOS_HANG_PROBE_BOOTSTATUS_TIMEOUT_MS,
  IOS_HANG_SIMCTL_ETIMEDOUT_RETRY_BASE_MS,
  execSimctlHangPathWithOptionalRetry,
  formatSimctlEtimedoutDiagnosticLine,
  isXcrunTimedOutError,
  noteXcodebuildExitFromLine,
  simctlExecResultTimedOut,
  recoverIosSessionCreateHang,
  resolveIosIsHeadless,
  resolveIosIsHeadlessResolution,
  sessionCreateHangEvidenceFromProbeLine,
  startIosSessionCreateHangWatchdog,
  summarizeBootstatusProbe,
  XCUITest_DEFAULT_SIMULATOR_STARTUP_TIMEOUT_MS,
  type ExecCapture,
} from '../src/iosBootDiagnostics.ts';
import { SIMULATOR_STARTUP_TIMEOUT_MS } from '../src/hostPreflight.ts';
import {
  hangRecoverArtifactSnapshotDir,
  stageIosSessionHangArtifacts,
} from '../src/iosSessionDiagnostics.ts';
import { StartupSupervisor } from '../src/startupSupervisor.ts';

const SAMPLE_LIST_JSON = JSON.stringify({
  devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-26-2': [
      {
        name: 'iPhone 17',
        udid: 'target-udid',
        state: 'Booted',
        isAvailable: true,
      },
      {
        name: 'iPhone 16',
        udid: 'other-udid',
        state: 'Shutdown',
        isAvailable: true,
      },
    ],
  },
});

describe('iosBootDiagnostics', () => {
  test('findSimulatorDeviceInListJson returns the target row', () => {
    const row = findSimulatorDeviceInListJson(SAMPLE_LIST_JSON, 'target-udid');
    assert.deepEqual(row, {
      udid: 'target-udid',
      name: 'iPhone 17',
      state: 'Booted',
      isAvailable: true,
      runtimeIdentifier: 'com.apple.CoreSimulator.SimRuntime.iOS-26-2',
    });
    assert.equal(findSimulatorDeviceInListJson(SAMPLE_LIST_JSON, 'missing'), null);
  });

  test('summarizeBootstatusProbe keeps empty status diagnosable', () => {
    assert.match(
      summarizeBootstatusProbe({ stdout: '', stderr: '', status: null, timedOut: true }),
      /timedOut=true.*lines=0.*tail="\(empty\)"/,
    );
    assert.match(
      summarizeBootstatusProbe({
        stdout: 'Monitoring boot\nBooted\n',
        stderr: '',
        status: 0,
      }),
      /exit=0.*lines=2.*Booted/,
    );
  });

  test('formatIosBootDiagnosticLine is timestamped and prefix-stable', () => {
    const line = formatIosBootDiagnosticLine(
      { phase: 'test', udid: 'u1', state: 'Booted' },
      () => new Date('2026-10-14T12:00:00.000Z'),
    );
    assert.equal(
      line,
      '[e2e-ios-boot] ts=2026-10-14T12:00:00.000Z phase=test udid=u1 state=Booted',
    );
  });

  test('collectIosBootDiagnosticLines uses injectable exec and records timeout + DeviceHub', () => {
    const calls: string[][] = [];
    const execCapture: ExecCapture = (_bin, args) => {
      calls.push(args);
      if (args.includes('list')) {
        return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
      }
      return {
        stdout: '',
        stderr: '',
        status: null,
        timedOut: true,
        error: 'spawnSync ETIMEDOUT',
      };
    };
    const [line] = collectIosBootDiagnosticLines('target-udid', {
      phase: 'wdio:beforeSession',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      execCapture,
      deviceHubMode: 'suppress',
      deviceHubPids: [11, 22],
      simulatorUiPids: [],
      now: () => new Date('2026-10-14T12:34:56.000Z'),
    });
    assert.ok(line);
    assert.match(line!, /\[e2e-ios-boot\] ts=2026-10-14T12:34:56\.000Z/);
    assert.match(line!, /phase=wdio:beforeSession/);
    assert.match(line!, /udid=target-udid/);
    assert.match(line!, /state=Booted/);
    assert.match(line!, /name=iPhone 17/);
    assert.match(line!, /bootstatus=timedOut=true lines=0 tail="\(empty\)"/);
    assert.match(line!, /bootstatusTimedOut=true/);
    assert.match(line!, /bootstatusProbeTimeoutMs=5000/);
    assert.match(line!, /listState=Booted/);
    assert.match(line!, /bootstatusTail=/);
    assert.match(line!, /simulatorUiPids=\(none\)/);
    assert.match(
      line!,
      new RegExp(`appium:simulatorStartupTimeout=${SIMULATOR_STARTUP_TIMEOUT_MS}`),
    );
    assert.match(line!, /deviceHubMode=suppress/);
    assert.match(line!, /deviceHubPids=11,22/);
    assert.deepEqual(calls[0], ['simctl', 'list', 'devices', '--json']);
    assert.deepEqual(calls[1], ['simctl', 'bootstatus', 'target-udid']);
  });

  test('resolveIosIsHeadless defaults true on CI and respects RNGMA_IOS_HEADLESS', () => {
    assert.equal(resolveIosIsHeadless({ CI: 'true' }), true);
    assert.equal(resolveIosIsHeadless({ GITHUB_ACTIONS: 'true' }), true);
    assert.equal(resolveIosIsHeadless({}), false);
    assert.equal(resolveIosIsHeadless({ CI: 'true', RNGMA_IOS_HEADLESS: 'false' }), false);
    assert.equal(resolveIosIsHeadless({ RNGMA_IOS_HEADLESS: 'true' }), true);
    assert.deepEqual(resolveIosIsHeadlessResolution({ CI: 'true' }), {
      isHeadless: true,
      source: 'CI',
    });
    assert.deepEqual(resolveIosIsHeadlessResolution({ RNGMA_IOS_HEADLESS: '0' }), {
      isHeadless: false,
      source: 'RNGMA_IOS_HEADLESS',
    });
    assert.deepEqual(resolveIosIsHeadlessResolution({}), {
      isHeadless: false,
      source: 'default',
    });
    assert.match(
      formatIosIsHeadlessCapResolveLine(
        { isHeadless: true, source: 'CI' },
        () => new Date('2026-10-14T18:00:00.000Z'),
      ),
      /phase=cap-resolve.*appium:isHeadless=true.*source=CI/,
    );
  });

  test('collect labels unset simulatorStartupTimeout with XCUITest default', () => {
    const execCapture: ExecCapture = (_bin, args) => {
      if (args.includes('list')) {
        return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
      }
      return { stdout: 'ok\n', stderr: '', status: 0 };
    };
    const [line] = collectIosBootDiagnosticLines('target-udid', {
      phase: 'select-and-boot:before',
      simulatorStartupTimeoutMs: null,
      execCapture,
      deviceHubMode: 'off',
      deviceHubPids: [],
      now: () => new Date('2026-10-14T00:00:00.000Z'),
    });
    assert.match(
      line!,
      new RegExp(
        `appium:simulatorStartupTimeout=unset\\(default=${XCUITest_DEFAULT_SIMULATOR_STARTUP_TIMEOUT_MS}\\)`,
      ),
    );
    assert.match(line!, /deviceHubPids=\(none\)/);
  });

  test('SIMULATOR_STARTUP_TIMEOUT_MS exceeds the XCUITest 120s default', () => {
    assert.equal(SIMULATOR_STARTUP_TIMEOUT_MS, 180_000);
    assert.ok(SIMULATOR_STARTUP_TIMEOUT_MS > XCUITest_DEFAULT_SIMULATOR_STARTUP_TIMEOUT_MS);
  });

  test('isXcrunTimedOutError detects code and message forms', () => {
    assert.equal(isXcrunTimedOutError(Object.assign(new Error('x'), { code: 'ETIMEDOUT' })), true);
    assert.equal(isXcrunTimedOutError(new Error('spawnSync ETIMEDOUT')), true);
    assert.equal(isXcrunTimedOutError(new Error('other')), false);
  });

  test('formatSimctlEtimedoutDiagnosticLine emits stable grep token', () => {
    const line = formatSimctlEtimedoutDiagnosticLine('list', 15_000, () =>
      new Date('2026-11-17T12:00:00.000Z'),
    );
    assert.match(line, /\[e2e-ios-boot\].*phase=simctl:ETIMEDOUT/);
    assert.match(line, /subcommand=list timeoutMs=15000/);
    assert.doesNotMatch(line, /loadavg/);
  });

  test('hang-path simctl retry: successful retry omits ETIMEDOUT from probe evidence', () => {
    let listCalls = 0;
    const sleeps: number[] = [];
    const lines = collectIosBootDiagnosticLines('target-udid', {
      phase: 'wdio:session-create:hang-probe',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      hangPathReadRetry: true,
      hangPathRetrySleep: ms => sleeps.push(ms),
      hangPathRetryJitterMs: () => 0,
      execCapture: (_bin, args) => {
        if (args.includes('list')) {
          listCalls += 1;
          if (listCalls === 1) {
            return {
              stdout: '',
              stderr: '',
              status: null,
              timedOut: true,
              error: 'spawnSync ETIMEDOUT',
            };
          }
          return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
        }
        return { stdout: 'Booted\n', stderr: '', status: 0 };
      },
      deviceHubMode: 'off',
      deviceHubPids: [],
      simulatorUiPids: [],
    });
    assert.equal(listCalls, 2);
    assert.equal(sleeps[0], IOS_HANG_SIMCTL_ETIMEDOUT_RETRY_BASE_MS);
    assert.ok(lines.some(line => /phase=simctl:ETIMEDOUT.*subcommand=list/.test(line)));
    const probeLine = lines.find(line => /hang-probe\b/.test(line));
    assert.ok(probeLine);
    const evidence = sessionCreateHangEvidenceFromProbeLine(probeLine!);
    assert.equal(evidence.xcrunEtimedout, false);
    assert.equal(evidence.state, 'Booted');
    assert.equal(
      sessionCreateHangEvidenceFromProbeLine(lines.find(l => /simctl:ETIMEDOUT/.test(l))!)
        .xcrunEtimedout,
      false,
    );
  });

  test('hang-path simctl retry: double ETIMEDOUT keeps probe ETIMEDOUT evidence', () => {
    const lines = collectIosBootDiagnosticLines('target-udid', {
      phase: 'wdio:session-create:hang-probe',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      hangPathReadRetry: true,
      hangPathRetrySleep: () => {},
      hangPathRetryJitterMs: () => 0,
      bootstatusTimeoutMs: IOS_HANG_PROBE_BOOTSTATUS_TIMEOUT_MS,
      execCapture: (_bin, args) => {
        if (args.includes('list')) {
          return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
        }
        return {
          stdout: '',
          stderr: '',
          status: null,
          timedOut: true,
          error: 'spawnSync ETIMEDOUT',
        };
      },
      deviceHubMode: 'off',
      deviceHubPids: [],
      simulatorUiPids: [],
    });
    assert.equal(
      lines.filter(line => /phase=simctl:ETIMEDOUT.*subcommand=bootstatus/.test(line)).length,
      2,
    );
    const probeLine = lines.find(line => /hang-probe\b/.test(line));
    assert.ok(probeLine);
    assert.match(probeLine!, /bootstatusProbeTimeoutMs=8000/);
    assert.equal(sessionCreateHangEvidenceFromProbeLine(probeLine!).xcrunEtimedout, true);
  });

  test('execSimctlHangPathWithOptionalRetry skips retry when hangPathReadRetry is false', () => {
    let calls = 0;
    const { result, etimedoutLines } = execSimctlHangPathWithOptionalRetry(
      () => {
        calls += 1;
        return {
          stdout: '',
          stderr: '',
          status: null,
          timedOut: true,
          error: 'spawnSync ETIMEDOUT',
        };
      },
      ['simctl', 'list', 'devices', '--json'],
      15_000,
      'list',
      { hangPathReadRetry: false },
    );
    assert.equal(calls, 1);
    assert.equal(etimedoutLines.length, 0);
    assert.equal(simctlExecResultTimedOut(result), true);
  });

  test('confirmSimulatorReadyForPersist requires Booted list + non-timeout bootstatus', () => {
    const ok = confirmSimulatorReadyForPersist('target-udid', (_bin, args) => {
      if (args.includes('list')) {
        return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
      }
      return { stdout: 'Booted\n', stderr: '', status: 0 };
    });
    assert.deepEqual(ok, { ok: true, state: 'Booted', name: 'iPhone 17' });

    const timedOut = confirmSimulatorReadyForPersist('target-udid', () => ({
      stdout: '',
      stderr: '',
      status: null,
      timedOut: true,
      error: 'spawnSync ETIMEDOUT',
    }));
    assert.equal(timedOut.ok, false);
    if (!timedOut.ok) {
      assert.match(timedOut.reason, /list timed out/);
    }

    assert.throws(
      () =>
        assertSimulatorReadyForPersist('missing', (_bin, args) => {
          if (args.includes('list')) {
            return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
          }
          return { stdout: '', stderr: '', status: 0 };
        }),
      /missing from simctl list.*retryable abort/,
    );
  });

  test('session-create hang watchdog emits start then hang probes until stopped', () => {
    const lines: string[] = [];
    const callbacks: Array<() => void> = [];
    const watchdog = startIosSessionCreateHangWatchdog('target-udid', {
      phase: 'wdio:session-create',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      intervalMs: 1000,
      write: line => lines.push(line),
      execCapture: (_bin, args) => {
        if (args.includes('list')) {
          return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
        }
        return { stdout: 'Booted\n', stderr: '', status: 0 };
      },
      deviceHubMode: 'suppress',
      deviceHubPids: [],
      now: () => new Date('2026-10-14T15:00:00.000Z'),
      clock: {
        setInterval(callback) {
          callbacks.push(callback);
          return 1;
        },
        clearInterval() {},
      },
    });
    assert.match(lines[0]!, /phase=wdio:session-create:start/);
    assert.match(lines[0]!, /POST \/session beginning/);
    assert.equal(callbacks.length, 1);
    callbacks[0]!();
    assert.ok(lines.some(line => /phase=wdio:session-create:hang\b/.test(line)));
    assert.ok(lines.some(line => line.includes(IOS_SESSION_CREATE_HANG_HINT)));
    assert.ok(lines.some(line => /phase=wdio:session-create:hang-probe/.test(line)));
    watchdog.stop();
    const count = lines.length;
    callbacks[0]!();
    assert.equal(lines.length, count);
  });

  test('decideSessionCreateHangAction recovers then aborts on prolonged ETIMEDOUT', () => {
    assert.deepEqual(
      decideSessionCreateHangAction({
        hangTick: 1,
        consecutiveXcrunEtimedout: 1,
        simState: 'Booted',
        recoveredOnce: false,
      }),
      { action: 'continue' },
    );
    const recover = decideSessionCreateHangAction({
      hangTick: 2,
      consecutiveXcrunEtimedout: 1,
      simState: 'Booted',
      recoveredOnce: false,
    });
    assert.equal(recover.action, 'recover');
    const abort = decideSessionCreateHangAction({
      hangTick: 3,
      consecutiveXcrunEtimedout: 2,
      simState: 'Booted',
      recoveredOnce: true,
    });
    assert.equal(abort.action, 'abort');
    if (abort.action === 'abort') {
      assert.match(abort.reason, /prolonged xcrun ETIMEDOUT/);
    }
  });

  test('decideSessionCreateHangAction recovers then aborts on Booted hang without ETIMEDOUT', () => {
    assert.deepEqual(
      decideSessionCreateHangAction({
        hangTick: 1,
        consecutiveXcrunEtimedout: 0,
        consecutiveBootedHangProbes: 1,
        simState: 'Booted',
        recoveredOnce: false,
      }),
      { action: 'continue' },
    );
    const recover = decideSessionCreateHangAction({
      hangTick: 2,
      consecutiveXcrunEtimedout: 0,
      consecutiveBootedHangProbes: 2,
      simState: 'Booted',
      recoveredOnce: false,
      hostXcodebuildPids: '(none)',
      hostWdaPids: '(none)',
      lastXcodebuildExitLabel: '(none)',
    });
    assert.equal(recover.action, 'recover');
    if (recover.action === 'recover') {
      assert.match(recover.reason, /Booted hang-probe streak/);
    }
    const deferred = decideSessionCreateHangAction({
      hangTick: 2,
      consecutiveXcrunEtimedout: 0,
      consecutiveBootedHangProbes: 2,
      simState: 'Booted',
      recoveredOnce: false,
      hostXcodebuildPids: '66564',
      hostWdaPids: '(none)',
      lastXcodebuildExitLabel: '(none)',
    });
    assert.equal(deferred.action, 'skip-recover');
    if (deferred.action === 'skip-recover') {
      assert.equal(deferred.consumeRecoveryOpportunity, false);
    }
    // Booted-without-ETIMEDOUT: live WDA PIDs defer recover even when exit is 0.
    const deferredDespiteExit0 = decideSessionCreateHangAction({
      hangTick: 2,
      consecutiveXcrunEtimedout: 0,
      consecutiveBootedHangProbes: 2,
      simState: 'Booted',
      recoveredOnce: false,
      hostXcodebuildPids: '(none)',
      hostWdaPids: '77888',
      lastXcodebuildExitLabel: '0',
    });
    assert.equal(deferredDespiteExit0.action, 'skip-recover');
    if (deferredDespiteExit0.action === 'skip-recover') {
      assert.match(deferredDespiteExit0.reason, /host build still live/);
      assert.match(deferredDespiteExit0.reason, /ignores exit label/);
      assert.equal(deferredDespiteExit0.consumeRecoveryOpportunity, false);
    }
    // Abort only when host PIDs are clear (live-PID gate runs before abort).
    const abort = decideSessionCreateHangAction({
      hangTick: 3,
      consecutiveXcrunEtimedout: 0,
      consecutiveBootedHangProbes: 3,
      simState: 'Booted',
      recoveredOnce: true,
      hostXcodebuildPids: '(none)',
      hostWdaPids: '(none)',
      lastXcodebuildExitLabel: '(none)',
    });
    assert.equal(abort.action, 'abort');
    if (abort.action === 'abort') {
      assert.match(abort.reason, /Booted hang-probe streak/);
      assert.match(abort.reason, /bootstatusTimedOut=false/);
    }
  });

  test('production-default abort tick defers while host PIDs are live', () => {
    // Defaults: recoverAfter=2, abortAfter=3. Live PIDs must win over abortReady.
    const atAbortTick = decideSessionCreateHangAction({
      hangTick: 3,
      consecutiveXcrunEtimedout: 0,
      consecutiveBootedHangProbes: 3,
      simState: 'Booted',
      recoveredOnce: true,
      hostXcodebuildPids: '4242',
      hostWdaPids: '(none)',
      lastXcodebuildExitLabel: '65',
    });
    assert.equal(atAbortTick.action, 'skip-recover');
    if (atAbortTick.action === 'skip-recover') {
      assert.match(atAbortTick.reason, /abortDeferred:/);
      assert.match(atAbortTick.reason, /host build still live/);
      assert.equal(atAbortTick.consumeRecoveryOpportunity, false);
    }
    const etimedoutAbortTick = decideSessionCreateHangAction({
      hangTick: 3,
      consecutiveXcrunEtimedout: 2,
      consecutiveBootedHangProbes: 3,
      simState: 'Booted',
      recoveredOnce: true,
      hostXcodebuildPids: '(none)',
      hostWdaPids: '99',
      lastXcodebuildExitLabel: '0',
    });
    assert.equal(etimedoutAbortTick.action, 'skip-recover');
    if (etimedoutAbortTick.action === 'skip-recover') {
      assert.match(etimedoutAbortTick.reason, /abortDeferred:/);
    }
  });

  test('decideSessionCreateHangAction never recovers after session id exists', () => {
    assert.deepEqual(
      decideSessionCreateHangAction({
        hangTick: 2,
        consecutiveXcrunEtimedout: 2,
        simState: 'Booted',
        recoveredOnce: false,
        postSessionInFlight: false,
      }),
      { action: 'continue' },
    );
    assert.deepEqual(
      decideSessionCreateHangAction({
        hangTick: 3,
        consecutiveXcrunEtimedout: 5,
        simState: '(missing)',
        recoveredOnce: true,
        postSessionInFlight: false,
      }),
      { action: 'continue' },
    );
  });

  test('decideSessionCreateHangAction skips WDA recover while Shutdown/Booting', () => {
    const skipShutdown = decideSessionCreateHangAction({
      hangTick: 2,
      consecutiveXcrunEtimedout: 1,
      simState: 'Shutdown',
      recoveredOnce: false,
    });
    assert.equal(skipShutdown.action, 'skip-recover');
    if (skipShutdown.action === 'skip-recover') {
      assert.match(skipShutdown.reason, /recoverSkipped/);
      assert.equal(skipShutdown.consumeRecoveryOpportunity, true);
    }
    const skipBooting = decideSessionCreateHangAction({
      hangTick: 2,
      consecutiveXcrunEtimedout: 1,
      simState: 'Booting',
      recoveredOnce: false,
    });
    assert.equal(skipBooting.action, 'skip-recover');
    const abortTransition = decideSessionCreateHangAction({
      hangTick: 3,
      consecutiveXcrunEtimedout: 2,
      simState: 'Shutdown',
      recoveredOnce: true,
    });
    assert.equal(abortTransition.action, 'abort');
    if (abortTransition.action === 'abort') {
      assert.match(abortTransition.reason, /interrupting Appium boot monitor/);
    }
  });

  test('decideSessionCreateHangAction defers recover while host build PIDs live', () => {
    const deferred = decideSessionCreateHangAction({
      hangTick: 2,
      consecutiveXcrunEtimedout: 1,
      simState: 'Booted',
      recoveredOnce: false,
      hostXcodebuildPids: '4242',
      hostWdaPids: '(none)',
      lastXcodebuildExitLabel: '(none)',
    });
    assert.equal(deferred.action, 'skip-recover');
    if (deferred.action === 'skip-recover') {
      assert.match(deferred.reason, /host build still live/);
      assert.equal(deferred.consumeRecoveryOpportunity, false);
    }
    const afterExit = decideSessionCreateHangAction({
      hangTick: 2,
      consecutiveXcrunEtimedout: 1,
      simState: 'Booted',
      recoveredOnce: false,
      hostXcodebuildPids: '4242',
      hostWdaPids: '(none)',
      lastXcodebuildExitLabel: '65',
    });
    assert.equal(afterExit.action, 'recover');
    const afterPidsClear = decideSessionCreateHangAction({
      hangTick: 2,
      consecutiveXcrunEtimedout: 1,
      simState: 'Booted',
      recoveredOnce: false,
      hostXcodebuildPids: '(none)',
      hostWdaPids: '(none)',
      lastXcodebuildExitLabel: '(none)',
    });
    assert.equal(afterPidsClear.action, 'recover');
  });

  test('sessionCreateHangEvidenceFromProbeLine detects ETIMEDOUT while Booted', () => {
    const evidence = sessionCreateHangEvidenceFromProbeLine(
      '[e2e-ios-boot] phase=wdio:session-create:hang-probe state=Booted bootstatus=timedOut=true error="spawnSync xcrun ETIMEDOUT"',
    );
    assert.equal(evidence.xcrunEtimedout, true);
    assert.equal(evidence.state, 'Booted');
  });

  test('recoverIosSessionCreateHang terminates WDA bundles via injectable exec', () => {
    const calls: string[][] = [];
    const sleeps: number[] = [];
    recoverIosSessionCreateHang('target-udid', {
      execCapture: (_bin, args) => {
        calls.push(args);
        return { stdout: '', stderr: '', status: 0 };
      },
      sleep: ms => sleeps.push(ms),
      settleMs: 100,
    });
    assert.ok(calls.some(args => args.includes('terminate') && args.includes('target-udid')));
    assert.deepEqual(sleeps, [100]);
  });

  test('hang watchdog recovers once then aborts via callbacks', () => {
    const lines: string[] = [];
    const callbacks: Array<() => void> = [];
    const recovers: string[] = [];
    const aborts: Error[] = [];
    const lastXcodebuildExitRef = { value: null as number | null };
    startIosSessionCreateHangWatchdog('target-udid', {
      phase: 'serial:session-create',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      intervalMs: 1000,
      recoverAfterTicks: 2,
      abortAfterTicks: 3,
      // Generic (non-prebuilt) hang-recover path — pin explicitly so this
      // test stays hermetic regardless of whether a real `.wda-derived`
      // artifact happens to exist on the machine running it (FLAKE-005c's
      // prebuilt-mode recover gate only applies when this is true).
      prebuiltWdaArtifactPresent: false,
      lastXcodebuildExitRef,
      write: line => lines.push(line),
      // Host pgrep must report clear PIDs — timedOut pgrep counts as live and
      // correctly defers abort; simctl probes still ETIMEDOUT for the hang path.
      execCapture: (bin, _args) => {
        if (bin === 'pgrep') {
          return { stdout: '', stderr: '', status: 1 };
        }
        return {
          stdout: '',
          stderr: '',
          status: null,
          timedOut: true,
          error: 'spawnSync ETIMEDOUT',
        };
      },
      deviceHubMode: 'off',
      deviceHubPids: [],
      now: () => new Date('2026-10-14T16:00:00.000Z'),
      clock: {
        setInterval(callback) {
          callbacks.push(callback);
          return 1;
        },
        clearInterval() {},
      },
      onRecover: (udid, reason) => {
        recovers.push(`${udid}:${reason}`);
      },
      onAbort: error => {
        aborts.push(error);
      },
    });
    callbacks[0]!(); // tick 1 — continue
    assert.equal(recovers.length, 0);
    assert.equal(aborts.length, 0);
    assert.ok(lines.some(line => /\[e2e-ios-session\].*hang-probe/.test(line)));
    lastXcodebuildExitRef.value = 65;
    callbacks[0]!(); // tick 2 — recover
    assert.equal(recovers.length, 1);
    assert.ok(lines.some(line => /phase=serial:session-create:hang-recover\b/.test(line)));
    // Session snapshot must land before recover callback (capture-before-kill).
    const recoverBootIdx = lines.findIndex(line =>
      /\[e2e-ios-boot\].*phase=serial:session-create:hang-recover\b/.test(line),
    );
    const recoverSessionIdx = lines.findIndex(line =>
      /\[e2e-ios-session\].*phase=serial:session-create:hang-recover\b/.test(line),
    );
    assert.ok(recoverBootIdx >= 0 && recoverSessionIdx > recoverBootIdx);
    assert.match(lines[recoverSessionIdx]!, /lastXcodebuildExit=65/);
    callbacks[0]!(); // tick 3 — abort
    assert.equal(aborts.length, 1);
    assert.match(aborts[0]!.message, /\[e2e-ios-boot\] session-create abort/);
    assert.ok(lines.some(line => /phase=serial:session-create:hang-abort\b/.test(line)));
    assert.ok(
      lines.some(line => /\[e2e-ios-session\].*phase=serial:session-create:hang-abort/.test(line)),
    );
  });

  test('hang watchdog restarts session-create after recover instead of immediate abort', () => {
    const lines: string[] = [];
    const callbacks: Array<() => void> = [];
    const restarts: string[] = [];
    const aborts: Error[] = [];
    startIosSessionCreateHangWatchdog('target-udid', {
      phase: 'serial:session-create',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      intervalMs: 1000,
      recoverAfterTicks: 2,
      abortAfterTicks: 3,
      prebuiltWdaArtifactPresent: false,
      wdaPortProbeEnabled: false,
      lastXcodebuildExitRef: { value: null },
      write: line => lines.push(line),
      execCapture: (bin, _args) => {
        if (bin === 'pgrep') {
          return { stdout: '', stderr: '', status: 1 };
        }
        return {
          stdout: '',
          stderr: '',
          status: null,
          timedOut: true,
          error: 'spawnSync ETIMEDOUT',
        };
      },
      deviceHubMode: 'off',
      deviceHubPids: [],
      now: () => new Date('2026-10-14T16:00:00.000Z'),
      clock: {
        setInterval(callback) {
          callbacks.push(callback);
          return 1;
        },
        clearInterval() {},
      },
      onRecover: () => {},
      onSessionCreateRestart: () => {
        restarts.push('issued');
      },
      onAbort: error => aborts.push(error),
    });
    callbacks[0]!(); // tick 1
    callbacks[0]!(); // tick 2 — recover + restart
    assert.equal(restarts.length, 1);
    assert.ok(lines.some(line => /phase=serial:session-create:hang-retry\b/.test(line)));
    callbacks[0]!(); // tick 1 of post-restart window — must not abort yet
    callbacks[0]!(); // tick 2
    assert.equal(aborts.length, 0);
    callbacks[0]!(); // tick 3 — abort on second attempt
    assert.equal(aborts.length, 1);
    assert.ok(
      lines.some(line => /sessionCreateRestartIssued=true/.test(line)),
    );
  });

  test('hang watchdog defers recover while host xcodebuild PIDs live and exit unknown', () => {
    const lines: string[] = [];
    const callbacks: Array<() => void> = [];
    const recovers: string[] = [];
    const aborts: Error[] = [];
    startIosSessionCreateHangWatchdog('target-udid', {
      phase: 'serial:session-create',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      intervalMs: 1000,
      recoverAfterTicks: 2,
      abortAfterTicks: 4,
      lastXcodebuildExitRef: { value: null },
      write: line => lines.push(line),
      execCapture: (bin, args) => {
        if (bin === 'pgrep' && (args[1] === 'xcodebuild' || args.includes('xcodebuild'))) {
          return { stdout: '4242 /usr/bin/xcodebuild test\n', stderr: '', status: 0 };
        }
        if (bin === 'pgrep') {
          return { stdout: '', stderr: '', status: 1 };
        }
        return {
          stdout: '',
          stderr: '',
          status: null,
          timedOut: true,
          error: 'spawnSync ETIMEDOUT',
        };
      },
      deviceHubMode: 'off',
      deviceHubPids: [],
      now: () => new Date('2026-10-15T14:00:00.000Z'),
      clock: {
        setInterval(callback) {
          callbacks.push(callback);
          return 1;
        },
        clearInterval() {},
      },
      onRecover: (udid, reason) => {
        recovers.push(`${udid}:${reason}`);
      },
      onAbort: error => {
        aborts.push(error);
      },
    });
    callbacks[0]!(); // tick 1
    callbacks[0]!(); // tick 2 — defer (live PIDs, exit none)
    assert.equal(recovers.length, 0);
    assert.ok(lines.some(line => /hang-recoverSkipped/.test(line)));
    assert.ok(
      lines.some(
        line =>
          /\[e2e-ios-session\].*hang-recoverSkipped/.test(line) &&
          /host build still live/.test(line),
      ),
    );
    // skip-recover under live PIDs must still stage hang-recover snapshots.
    assert.ok(lines.some(line => /hang-recoverSkipped-artifacts/.test(line)));
    callbacks[0]!(); // tick 3 — still deferred
    assert.equal(recovers.length, 0);
    assert.equal(aborts.length, 0);
  });

  test('hang watchdog markSessionCreated disarms recover before mid-suite ETIMEDOUT', () => {
    const lines: string[] = [];
    const callbacks: Array<() => void> = [];
    const recovers: string[] = [];
    const aborts: Error[] = [];
    const watchdog = startIosSessionCreateHangWatchdog('target-udid', {
      phase: 'wdio:session-create',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      intervalMs: 1000,
      recoverAfterTicks: 2,
      abortAfterTicks: 3,
      write: line => lines.push(line),
      execCapture: () => ({
        stdout: '',
        stderr: '',
        status: null,
        timedOut: true,
        error: 'spawnSync ETIMEDOUT',
      }),
      deviceHubMode: 'off',
      deviceHubPids: [],
      now: () => new Date('2026-10-14T18:30:00.000Z'),
      clock: {
        setInterval(callback) {
          callbacks.push(callback);
          return 1;
        },
        clearInterval() {},
      },
      onRecover: (udid, reason) => {
        recovers.push(`${udid}:${reason}`);
      },
      onAbort: error => {
        aborts.push(error);
      },
    });
    callbacks[0]!(); // tick 1 — continue
    watchdog.markSessionCreated('session-abc');
    assert.ok(lines.some(line => /phase=wdio:session-create:complete/.test(line)));
    assert.ok(lines.some(line => /sessionId=session-abc/.test(line)));
    const count = lines.length;
    callbacks[0]!(); // would have been recover — must stay disarmed
    callbacks[0]!(); // would have been abort
    assert.equal(lines.length, count);
    assert.equal(recovers.length, 0);
    assert.equal(aborts.length, 0);
  });

  test('hang watchdog skips WDA recover while Shutdown and notes boot monitor on abort', () => {
    const lines: string[] = [];
    const callbacks: Array<() => void> = [];
    const recovers: string[] = [];
    const aborts: Error[] = [];
    const shutdownList = JSON.stringify({
      devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-26-2': [
          {
            name: 'iPhone 17',
            udid: 'target-udid',
            state: 'Shutdown',
            isAvailable: true,
          },
        ],
      },
    });
    startIosSessionCreateHangWatchdog('target-udid', {
      phase: 'wdio:session-create',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      intervalMs: 1000,
      recoverAfterTicks: 2,
      abortAfterTicks: 3,
      write: line => lines.push(line),
      execCapture: (bin, args) => {
        if (bin === 'pgrep') {
          return { stdout: '', stderr: '', status: 1 };
        }
        if (args.includes('list')) {
          return { stdout: shutdownList, stderr: '', status: 0 };
        }
        return {
          stdout: '',
          stderr: '',
          status: null,
          timedOut: true,
          error: 'spawnSync ETIMEDOUT',
        };
      },
      deviceHubMode: 'off',
      deviceHubPids: [],
      wdaPortProbeEnabled: false,
      simulatorUiPids: [],
      now: () => new Date('2026-10-14T17:00:00.000Z'),
      clock: {
        setInterval(callback) {
          callbacks.push(callback);
          return 1;
        },
        clearInterval() {},
      },
      onRecover: (udid, reason) => {
        recovers.push(`${udid}:${reason}`);
      },
      onAbort: error => {
        aborts.push(error);
      },
    });
    callbacks[0]!();
    callbacks[0]!(); // tick 2 — skip-recover
    assert.equal(recovers.length, 0);
    assert.ok(lines.some(line => /hang-recoverSkipped/.test(line)));
    callbacks[0]!(); // tick 3 — abort
    assert.equal(aborts.length, 1);
    assert.match(aborts[0]!.message, /interrupting Appium boot monitor/);
  });

  test('FLAKE-005: watchdog aborts after live-PID defer cap (synthetic stuck xcodebuild)', () => {
    const lines: string[] = [];
    const callbacks: Array<() => void> = [];
    const aborts: Error[] = [];
    startIosSessionCreateHangWatchdog('target-udid', {
      phase: 'serial:session-create',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      intervalMs: 1000,
      recoverAfterTicks: 2,
      abortAfterTicks: 3,
      livePidDeferMaxTicks: 2,
      prebuiltWdaArtifactPresent: false,
      lastXcodebuildExitRef: { value: 0 },
      write: line => lines.push(line),
      execCapture: (bin, args) => {
        if (bin === 'pgrep' && (args[1] === 'xcodebuild' || args.includes('xcodebuild'))) {
          return { stdout: '66564 /usr/bin/xcodebuild test\n', stderr: '', status: 0 };
        }
        if (bin === 'pgrep') {
          return { stdout: '', stderr: '', status: 1 };
        }
        if (args.includes('list')) {
          return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
        }
        return { stdout: 'Monitoring boot\nBooted\n', stderr: '', status: 0 };
      },
      deviceHubMode: 'off',
      deviceHubPids: [],
      now: () => new Date('2026-10-15T17:30:00.000Z'),
      clock: {
        setInterval(callback) {
          callbacks.push(callback);
          return 1;
        },
        clearInterval() {},
      },
      onAbort: error => aborts.push(error),
    });
    callbacks[0]!(); // tick 1
    callbacks[0]!(); // tick 2 — recover deferred
    assert.equal(aborts.length, 0);
    assert.ok(lines.some(line => /hang-recoverSkipped/.test(line)));
    callbacks[0]!(); // tick 3 — abortDeferred (deferrals=1)
    assert.equal(aborts.length, 0);
    callbacks[0]!(); // tick 4 — abort after cap (deferrals=2)
    assert.equal(aborts.length, 1);
    assert.match(aborts[0]!.message, /\[e2e-ios-boot\] session-create abort/);
    assert.ok(lines.some(line => /hang-abort\b/.test(line)));
  });

  test('FLAKE-005: watchdog fail-fast abort when prebuilt WDA + genuinely rebuilding xcodebuild', () => {
    // A genuine `build` / `build-for-testing` action while prebuilt mode is
    // selected means Appium ignored `usePrebuiltWDA` (or the caps never
    // applied) and is rebuilding from scratch — still a real anomaly that
    // must fail fast rather than wait out the supervisor ceiling.
    const lines: string[] = [];
    const callbacks: Array<() => void> = [];
    const aborts: Error[] = [];
    startIosSessionCreateHangWatchdog('target-udid', {
      phase: 'serial:session-create',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      intervalMs: 1000,
      recoverAfterTicks: 2,
      abortAfterTicks: 3,
      prebuiltWdaArtifactPresent: true,
      lastXcodebuildExitRef: { value: 0 },
      write: line => lines.push(line),
      execCapture: (bin, args) => {
        if (bin === 'pgrep' && (args[1] === 'xcodebuild' || args.includes('xcodebuild'))) {
          return {
            stdout: '66564 /usr/bin/xcodebuild build-for-testing -scheme WebDriverAgentRunner\n',
            stderr: '',
            status: 0,
          };
        }
        if (bin === 'pgrep') {
          return { stdout: '', stderr: '', status: 1 };
        }
        if (args.includes('list')) {
          return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
        }
        return { stdout: 'Monitoring boot\nBooted\n', stderr: '', status: 0 };
      },
      deviceHubMode: 'off',
      deviceHubPids: [],
      now: () => new Date('2026-10-15T17:45:00.000Z'),
      clock: {
        setInterval(callback) {
          callbacks.push(callback);
          return 1;
        },
        clearInterval() {},
      },
      onAbort: error => aborts.push(error),
    });
    callbacks[0]!();
    callbacks[0]!();
    callbacks[0]!(); // tick 3 — must not loop abortDeferred until supervisor
    assert.equal(aborts.length, 1);
    assert.doesNotMatch(lines.join('\n'), /abortDeferred:.*host build still live/);
  });

  test('FLAKE-005c: prebuilt WDA launch-only xcodebuild (test-without-building) must defer, not abort/recover', () => {
    // #939 evidence (run 43937945153): hostWdaPids=(none), POST /session
    // hangs, hang-abort fires at tick 3 — while hostXcodebuildPids is live.
    // `usePrebuiltWDA` only ever runs the launch-only `test` /
    // `test-without-building` action (never `build`/`build-for-testing`,
    // appium-webdriveragent `xcodebuild.js` `getCommand`) to start the
    // already-built WDA, so a live xcodebuild PID here is the *expected*,
    // still-in-progress launch — not evidence Appium ignored the prebuilt
    // artifact. Before the fix this watchdog fail-fast-aborted every such
    // launch that happened to still be running past the abort tick; it must
    // now defer to the supervisor's 180s ceiling (and to the pre-existing
    // live-PID defer-cap escalation for a genuinely stuck launch) instead.
    const lines: string[] = [];
    const callbacks: Array<() => void> = [];
    const recovers: string[] = [];
    const aborts: Error[] = [];
    startIosSessionCreateHangWatchdog('target-udid', {
      phase: 'serial:session-create',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      intervalMs: 1000,
      recoverAfterTicks: 2,
      abortAfterTicks: 3,
      prebuiltWdaArtifactPresent: true,
      lastXcodebuildExitRef: { value: null },
      write: line => lines.push(line),
      execCapture: (bin, args) => {
        if (bin === 'pgrep' && (args[1] === 'xcodebuild' || args.includes('xcodebuild'))) {
          return {
            stdout:
              '2362 /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild ' +
              'test-without-building -scheme WebDriverAgentRunner\n',
            stderr: '',
            status: 0,
          };
        }
        if (bin === 'pgrep') {
          // hostWdaPids=(none) — WDA has not finished launching yet (#939 evidence).
          return { stdout: '', stderr: '', status: 1 };
        }
        if (args.includes('list')) {
          return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
        }
        return { stdout: 'Monitoring boot\nBooted\n', stderr: '', status: 0 };
      },
      deviceHubMode: 'off',
      deviceHubPids: [],
      now: () => new Date('2026-11-16T21:00:00.000Z'),
      clock: {
        setInterval(callback) {
          callbacks.push(callback);
          return 1;
        },
        clearInterval() {},
      },
      onRecover: (udid, reason) => recovers.push(`${udid}:${reason}`),
      onAbort: error => aborts.push(error),
    });
    callbacks[0]!(); // tick 1
    callbacks[0]!(); // tick 2 — must defer, not WDA-terminate mid-launch
    assert.equal(recovers.length, 0);
    assert.equal(aborts.length, 0);
    callbacks[0]!(); // tick 3 — must defer, not abort (the #939 regression)
    assert.equal(recovers.length, 0);
    assert.equal(aborts.length, 0, 'must not fail-fast abort a live prebuilt WDA launch');
    assert.ok(lines.some(line => /abortDeferred:.*host build still live/.test(line)));
  });

  test('FLAKE-005b/c: a single transient simctl-list ETIMEDOUT must not reset the Booted-hang streak, but a live launch-only xcodebuild now defers to the live-PID cap instead of fail-fasting at tick 3', () => {
    // Reproduces PR #939 post-#940 CI run (43897188379): prebuilt WDA present,
    // Booted throughout. Tick 2 sees no host PID yet for either xcodebuild or
    // WDA (launch-only xcodebuild has startup overhead before anything execs
    // visibly) — the harness must not WDA-terminate here (FLAKE-005c
    // residual: run 43961818325 showed a tick-2 blind terminate racing a
    // slow-but-healthy launch, producing hostWdaPids briefly appearing then
    // clearing and an eventual hang-abort). The launch-only xcodebuild
    // finally becomes visible to pgrep from tick 3 onward, independent of
    // any harness action. Tick 3 also hits a single transient `xcrun simctl
    // list` ETIMEDOUT while `simctl bootstatus` still reports Booted. The
    // simulator never left Booted — only the probe round-tripped a timeout —
    // so this single glitch must not erase the already-accumulated
    // Booted-hang evidence (asserted via the abort eventually firing below
    // rather than silently resetting to tick 1).
    //
    // FLAKE-005c correction: that xcodebuild PID is the launch-only `test`
    // action (`usePrebuiltWDA` never runs a `build` action — see
    // `hostXcodebuildBuilding`), i.e. the expected, still-in-progress WDA
    // launch — not evidence Appium ignored prebuilt WDA. #940's
    // `unexpectedPrebuiltXcodebuild` gate used to bypass the live-PID defer
    // and fail-fast abort at tick 3 for exactly this case (self-inflicting
    // the hostWdaPids=(none) + hang-abort-at-tick-3 pattern #939 reported).
    // It must now defer like any other live host build, backstopped by the
    // pre-existing live-PID defer-cap escalation (tick 6 / 180s here).
    let listAttempts = 0;
    const lines: string[] = [];
    const callbacks: Array<() => void> = [];
    const recovers: string[] = [];
    const aborts: Error[] = [];
    const execCapture: ExecCapture = (bin, args) => {
      if (bin === 'xcrun' && args.includes('list')) {
        listAttempts += 1;
        // Tick 3's first simctl list attempt ETIMEDOUTs; hang-path retry succeeds.
        if (listAttempts === 3) {
          return {
            stdout: '',
            stderr: '',
            status: null,
            timedOut: true,
            error: 'spawnSync ETIMEDOUT',
          };
        }
        return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
      }
      if (bin === 'xcrun' && args.includes('bootstatus')) {
        // bootstatus keeps succeeding even on tick 3 (matches the real CI log:
        // listError=...ETIMEDOUT alongside bootstatus=exit=0 Booted).
        return { stdout: 'Monitoring boot\nBooted\n', stderr: '', status: 0 };
      }
      if (bin === 'pgrep' && (args[1] === 'xcodebuild' || args.includes('xcodebuild'))) {
        // Host xcodebuild becomes visible to pgrep from tick 3 onward — the
        // already-launching prebuilt WDA, not a recover-triggered relaunch
        // (FLAKE-005c residual fix: the harness never WDA-terminates here).
        return listAttempts >= 3
          ? { stdout: '57975 /usr/bin/xcodebuild test\n', stderr: '', status: 0 }
          : { stdout: '', stderr: '', status: 1 };
      }
      if (bin === 'pgrep') {
        return { stdout: '', stderr: '', status: 1 };
      }
      return { stdout: '', stderr: '', status: 0 };
    };
    startIosSessionCreateHangWatchdog('target-udid', {
      phase: 'serial:session-create',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      intervalMs: 30_000,
      // Production defaults — do not loosen the thresholds for this repro.
      prebuiltWdaArtifactPresent: true,
      lastXcodebuildExitRef: { value: null },
      write: line => lines.push(line),
      execCapture,
      deviceHubMode: 'off',
      deviceHubPids: [],
      wdaPortProbeEnabled: false,
      simulatorUiPids: [],
      now: () => new Date('2026-11-16T17:10:41.000Z'),
      clock: {
        setInterval(callback) {
          callbacks.push(callback);
          return 1;
        },
        clearInterval() {},
      },
      onRecover: (udid, reason) => recovers.push(`${udid}:${reason}`),
      onAbort: error => aborts.push(error),
    });
    callbacks[0]!(); // tick 1 (30s) — Booted, continue
    assert.equal(recovers.length, 0);
    assert.equal(aborts.length, 0);
    callbacks[0]!(); // tick 2 (60s) — Booted streak reaches 2, recover tick —
    // but no host PID is visible yet for either xcodebuild or WDA, so the
    // harness must defer rather than blind-WDA-terminate (FLAKE-005c residual).
    assert.equal(
      recovers.length,
      0,
      'prebuilt WDA must never be WDA-terminated while no host PID is visible yet',
    );
    assert.equal(aborts.length, 0);
    assert.ok(lines.some(line => /hang-recoverSkipped.*prebuilt WDA artifact present/.test(line)));
    callbacks[0]!(); // tick 3 (90s) — transient simctl-list ETIMEDOUT retried to Booted
    assert.ok(lines.some(line => /phase=simctl:ETIMEDOUT.*subcommand=list/.test(line)));
    // xcodebuild is launch-only (test-without-building): must defer, not
    // fail-fast abort (the #939 regression this harness self-inflicted).
    assert.equal(aborts.length, 0, 'a live launch-only xcodebuild must defer, not abort, at tick 3');
    assert.ok(lines.some(line => /abortDeferred:.*host build still live/.test(line)));
    callbacks[0]!(); // tick 4 (120s) — simctl list recovers (Booted); still deferring
    callbacks[0]!(); // tick 5 (150s) — still deferring
    assert.equal(aborts.length, 0);
    callbacks[0]!(); // tick 6 (180s) — live-PID defer-cap escalation fires
    // The accumulated Booted-hang evidence (never reset by tick 3's transient
    // ETIMEDOUT) still backstops a genuinely-stuck launch via the
    // pre-existing defer-cap escalation, aligned with the 180s supervisor
    // ceiling — not via the removed unexpectedPrebuiltXcodebuild shortcut.
    assert.equal(aborts.length, 1, 'a genuinely stuck live xcodebuild must still abort via the defer cap');
    assert.match(aborts[0]!.message, /\[e2e-ios-boot\] session-create abort/);
    assert.match(aborts[0]!.message, /live-PID deferral cap reached/);
    assert.ok(lines.some(line => /phase=serial:session-create:hang-abort\b/.test(line)));
  });

  test('live PIDs abortDeferred then supervisor abort still stages non-empty snapshot', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rngma-booted-supervisor-'));
    try {
      const derived = join(root, '.wda-derived');
      mkdirSync(join(derived, 'Logs'), { recursive: true });
      writeFileSync(join(derived, 'Logs', 'build.log'), 'xcodebuild tail');
      const appiumHome = join(root, '.appium-home');
      mkdirSync(join(appiumHome, 'logs', 'port-4725'), { recursive: true });
      writeFileSync(join(appiumHome, 'logs', 'port-4725', 'appium.log'), 'appium stdio');
      const childLog = join(root, 'ios-serial.log');
      writeFileSync(childLog, 'POST /session still open');

      const lines: string[] = [];
      const callbacks: Array<() => void> = [];
      const recovers: string[] = [];
      const aborts: Error[] = [];
      startIosSessionCreateHangWatchdog('target-udid', {
        phase: 'serial:session-create',
        simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
        intervalMs: 1000,
        recoverAfterTicks: 2,
        abortAfterTicks: 3,
        appiumHome,
        lastXcodebuildExitRef: { value: 0 },
        write: line => lines.push(line),
        execCapture: (bin, args) => {
          if (bin === 'pgrep' && (args[1] === 'xcodebuild' || args.includes('xcodebuild'))) {
            return { stdout: '66564 /usr/bin/xcodebuild test\n', stderr: '', status: 0 };
          }
          if (bin === 'pgrep') {
            return { stdout: '', stderr: '', status: 1 };
          }
          if (args.includes('list')) {
            return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
          }
          return { stdout: 'Monitoring boot\nBooted\n', stderr: '', status: 0 };
        },
        deviceHubMode: 'off',
        deviceHubPids: [],
        wdaPortProbeEnabled: false,
        simulatorUiPids: [],
        now: () => new Date('2026-10-15T17:00:00.000Z'),
        clock: {
          setInterval(callback) {
            callbacks.push(callback);
            return 1;
          },
          clearInterval() {},
        },
        onRecover: (udid, reason) => recovers.push(`${udid}:${reason}`),
        onAbort: error => aborts.push(error),
      });

      callbacks[0]!(); // tick 1
      callbacks[0]!(); // tick 2 — Booted recover deferred (live PIDs, exit 0)
      callbacks[0]!(); // tick 3 — abortDeferred (not hang-abort)
      assert.equal(recovers.length, 0);
      assert.equal(aborts.length, 0);
      assert.ok(lines.some(line => /abortDeferred:|host build still live/.test(line)));
      assert.ok(lines.some(line => /hang-recoverSkipped-artifacts/.test(line)));

      // 180s supervisor backstop: stage before drain (child log still present).
      const order: string[] = [];
      const supervisor = new StartupSupervisor(['serial-ios']);
      supervisor.onAbortArtifacts(() => {
        order.push('artifacts');
        stageIosSessionHangArtifacts({
          derivedDataPath: derived,
          appiumHome,
          extraLogPaths: [childLog],
          phase: 'serial:supervisor-abort-artifacts',
          write: line => lines.push(line),
        });
      });
      supervisor.onFailure(() => {
        order.push('drain');
        writeFileSync(childLog, '');
      });
      supervisor.phase = 'worker';
      const workers = supervisor.waitForWorkers();
      supervisor.recordFailure(
        'serial-ios',
        new Error('Timed out after 180000ms waiting for worker startup readiness'),
      );
      await assert.rejects(workers, /Timed out after 180000ms/);
      assert.deepEqual(order, ['artifacts', 'drain']);
      const snap = hangRecoverArtifactSnapshotDir(derived);
      assert.ok(existsSync(join(snap, 'staging-receipt.txt')));
      assert.equal(
        readFileSync(join(snap, 'supervisor-child-logs', 'ios-serial.log'), 'utf8'),
        'POST /session still open',
      );
      assert.ok(existsSync(join(snap, 'appium-logs', 'port-4725', 'appium.log')));
      assert.ok(lines.some(line => /serial:supervisor-abort-artifacts/.test(line)));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('hang watchdog recovers/aborts on Booted hang without ETIMEDOUT and stages artifacts', () => {
    const lines: string[] = [];
    const callbacks: Array<() => void> = [];
    const recovers: string[] = [];
    const aborts: Error[] = [];
    startIosSessionCreateHangWatchdog('target-udid', {
      phase: 'serial:session-create',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
      intervalMs: 1000,
      recoverAfterTicks: 2,
      abortAfterTicks: 3,
      // Generic (non-prebuilt) hang-recover path — pin explicitly so this
      // test stays hermetic regardless of whether a real `.wda-derived`
      // artifact happens to exist on the machine running it (FLAKE-005c's
      // prebuilt-mode recover gate only applies when this is true).
      prebuiltWdaArtifactPresent: false,
      lastXcodebuildExitRef: { value: null },
      write: line => lines.push(line),
      execCapture: (bin, args) => {
        if (bin === 'pgrep') {
          return { stdout: '', stderr: '', status: 1 };
        }
        if (args.includes('list')) {
          return { stdout: SAMPLE_LIST_JSON, stderr: '', status: 0 };
        }
        // bootstatus succeeds — the proven CI gap (Booted, no ETIMEDOUT).
        return { stdout: 'Monitoring boot\nBooted\n', stderr: '', status: 0 };
      },
      deviceHubMode: 'off',
      deviceHubPids: [],
      wdaPortProbeEnabled: false,
      simulatorUiPids: [],
      now: () => new Date('2026-10-15T15:00:00.000Z'),
      clock: {
        setInterval(callback) {
          callbacks.push(callback);
          return 1;
        },
        clearInterval() {},
      },
      onRecover: (udid, reason) => {
        recovers.push(`${udid}:${reason}`);
      },
      onAbort: error => {
        aborts.push(error);
      },
    });
    callbacks[0]!(); // tick 1 — continue
    assert.equal(recovers.length, 0);
    assert.equal(aborts.length, 0);
    assert.ok(lines.some(line => /\[e2e-ios-session\].*hang-probe/.test(line)));
    callbacks[0]!(); // tick 2 — Booted-hang recover
    assert.equal(recovers.length, 1);
    assert.match(recovers[0]!, /Booted hang-probe streak/);
    assert.ok(lines.some(line => /hang-recover-artifacts/.test(line)));
    callbacks[0]!(); // tick 3 — abort + artifact staging
    assert.equal(aborts.length, 1);
    assert.match(aborts[0]!.message, /Booted hang-probe streak/);
    assert.ok(lines.some(line => /hang-abort-artifacts/.test(line)));
  });

  test('FLAKE-005/c: prebuilt WDA + live xcodebuild — only a genuine build action may skip the live-PID defer', () => {
    const base = {
      hangTick: 3,
      consecutiveXcrunEtimedout: 0,
      consecutiveBootedHangProbes: 3,
      simState: 'Booted',
      recoveredOnce: true,
      hostXcodebuildPids: '66564',
      hostWdaPids: '(none)',
      lastXcodebuildExitLabel: '0',
    };
    const deferredWithoutPrebuilt = decideSessionCreateHangAction({
      ...base,
      prebuiltWdaArtifactPresent: false,
      consecutiveLiveBuildDeferrals: 0,
    });
    assert.equal(deferredWithoutPrebuilt.action, 'skip-recover');
    if (deferredWithoutPrebuilt.action === 'skip-recover') {
      assert.match(deferredWithoutPrebuilt.reason, /abortDeferred:/);
    }
    // Genuine anomaly: prebuilt mode selected but xcodebuild is actually
    // running a `build` / `build-for-testing` action (Appium ignored
    // `usePrebuiltWDA`, or caps never applied) — still fail fast.
    const abortWithPrebuiltGenuineBuild = decideSessionCreateHangAction({
      ...base,
      prebuiltWdaArtifactPresent: true,
      hostXcodebuildBuilding: true,
      consecutiveLiveBuildDeferrals: 0,
    });
    assert.equal(abortWithPrebuiltGenuineBuild.action, 'abort');
    if (abortWithPrebuiltGenuineBuild.action === 'abort') {
      assert.match(abortWithPrebuiltGenuineBuild.reason, /prebuilt WDA artifact present/);
    }
    // FLAKE-005c: the same live PID, but it is the launch-only `test` /
    // `test-without-building` action `usePrebuiltWDA` always runs to start
    // the already-built WDA (appium-webdriveragent `xcodebuild.js`
    // `getCommand`) — not a rebuild. Must defer like any other live host
    // build, not fail-fast abort (this is exactly the #939 regression: the
    // old gate aborted on *every* prebuilt session that was still mid-launch
    // at the abort tick, because it never distinguished build vs. launch-only
    // xcodebuild actions).
    const deferredPrebuiltLaunchOnly = decideSessionCreateHangAction({
      ...base,
      prebuiltWdaArtifactPresent: true,
      hostXcodebuildBuilding: false,
      consecutiveLiveBuildDeferrals: 0,
    });
    assert.equal(deferredPrebuiltLaunchOnly.action, 'skip-recover');
    if (deferredPrebuiltLaunchOnly.action === 'skip-recover') {
      assert.match(deferredPrebuiltLaunchOnly.reason, /abortDeferred:.*host build still live/);
    }
    // Omitting hostXcodebuildBuilding must default to launch-only (safe —
    // matches the overwhelmingly common real case), not to the genuine-build
    // anomaly path.
    const deferredPrebuiltUnspecified = decideSessionCreateHangAction({
      ...base,
      prebuiltWdaArtifactPresent: true,
      consecutiveLiveBuildDeferrals: 0,
    });
    assert.equal(deferredPrebuiltUnspecified.action, 'skip-recover');

    const recoverTickBase = {
      hangTick: 2,
      consecutiveXcrunEtimedout: 0,
      consecutiveBootedHangProbes: 2,
      simState: 'Booted',
      recoveredOnce: false,
      hostXcodebuildPids: '66564',
      hostWdaPids: '(none)',
      lastXcodebuildExitLabel: '(none)',
      prebuiltWdaArtifactPresent: true,
    };
    // Same correction at the (earlier) recover tick: a launch-only xcodebuild
    // must not be WDA-terminated mid-launch — defer instead of recover.
    const deferredAtRecoverTick = decideSessionCreateHangAction({
      ...recoverTickBase,
      hostXcodebuildBuilding: false,
    });
    assert.equal(deferredAtRecoverTick.action, 'skip-recover');
    // A genuine build action at the recover tick still recovers (WDA
    // terminate + settle) as before.
    const recoverWithPrebuiltGenuineBuild = decideSessionCreateHangAction({
      ...recoverTickBase,
      hostXcodebuildBuilding: true,
    });
    assert.equal(recoverWithPrebuiltGenuineBuild.action, 'recover');

    // FLAKE-005c residual (CI run 43961818325, post-launch-only-fix): at the
    // recover tick neither `xcodebuild` nor the WDA runner is visible to
    // pgrep yet (hostXcodebuildPids=(none), hostWdaPids=(none)) — the
    // launch-only xcodebuild has startup overhead before anything execs
    // visibly, especially under CI host contention. The live-PID gate above
    // only defers when a PID is already live, so it cannot see this gap and
    // previously fell through to a blind WDA-terminate `recover` here — which
    // then raced the real launch once it did appear a tick later (observed in
    // CI as hostWdaPids briefly appearing then clearing, followed by a hang-
    // abort). Prebuilt mode must never WDA-terminate via this heuristic: skip
    // recover instead and let the (already live-PID-aware) abort path be the
    // sole backstop.
    const skipRecoverPrebuiltNoPidsYet = decideSessionCreateHangAction({
      ...recoverTickBase,
      hostXcodebuildPids: '(none)',
      hostWdaPids: '(none)',
      hostXcodebuildBuilding: false,
      wdaPortReachable: true,
    });
    assert.equal(
      skipRecoverPrebuiltNoPidsYet.action,
      'skip-recover',
      'prebuilt WDA with port up and no visible PIDs still defers harness recover',
    );
    if (skipRecoverPrebuiltNoPidsYet.action === 'skip-recover') {
      assert.match(skipRecoverPrebuiltNoPidsYet.reason, /prebuilt-recover-skipped-port-up/);
      assert.equal(skipRecoverPrebuiltNoPidsYet.consumeRecoveryOpportunity, false);
    }
    const recoverPrebuiltNoPidsPortDown = decideSessionCreateHangAction({
      ...recoverTickBase,
      hostXcodebuildPids: '(none)',
      hostWdaPids: '(none)',
      hostXcodebuildBuilding: false,
      wdaPortReachable: false,
    });
    assert.equal(recoverPrebuiltNoPidsPortDown.action, 'recover');
  });

  test('T29.a: live host PIDs with WDA port-down at recover threshold escalate to recover', () => {
    const atRecoverTick = decideSessionCreateHangAction({
      hangTick: 2,
      consecutiveXcrunEtimedout: 0,
      consecutiveBootedHangProbes: 2,
      simState: 'Booted',
      recoveredOnce: false,
      hostXcodebuildPids: '4242',
      hostWdaPids: '77888',
      lastXcodebuildExitLabel: '(none)',
      prebuiltWdaArtifactPresent: true,
      hostXcodebuildBuilding: false,
      wdaPortReachable: false,
      consecutiveWdaPortDownProbes: IOS_SESSION_CREATE_HANG_RECOVER_AFTER_TICKS,
    });
    assert.equal(atRecoverTick.action, 'recover');
    if (atRecoverTick.action === 'recover') {
      assert.match(atRecoverTick.reason, /WDA terminate/);
    }
  });

  test('T29.a: port-down through abort tick recovers once before abort despite live PIDs', () => {
    const recoverDespiteLivePids = decideSessionCreateHangAction({
      hangTick: 3,
      consecutiveXcrunEtimedout: 0,
      consecutiveBootedHangProbes: 3,
      simState: 'Booted',
      recoveredOnce: false,
      hostXcodebuildPids: '4242',
      hostWdaPids: '77888',
      lastXcodebuildExitLabel: '(none)',
      prebuiltWdaArtifactPresent: true,
      hostXcodebuildBuilding: false,
      wdaPortReachable: false,
      consecutiveWdaPortDownProbes: IOS_SESSION_CREATE_HANG_ABORT_AFTER_TICKS,
    });
    assert.equal(
      recoverDespiteLivePids.action,
      'recover',
      'must not abort without one recover when :8100 stayed down',
    );
  });

  test('formatSessionCreateAbortSummary emits stable grep block', () => {
    const line = formatSessionCreateAbortSummary({
      wdaPort: 'down',
      livePids: '4242/(none)',
      lastXcodebuildExit: '(none)',
      recoverAttempted: true,
      artifactDir: '/tmp/hang-snapshots/last',
      consecutivePortDownProbes: 3,
      consecutiveDeferrals: 2,
      wdaLocalPort: 8100,
    });
    assert.match(line, /^\[e2e-ios-boot\] session-create-abort-summary /);
    assert.match(line, /wdaPort=down/);
    assert.match(line, /consecutivePortDownProbes=3/);
  });

  test('FLAKE-005: live-PID abortDeferred livelock caps then escalates abort', () => {
    const base = {
      hangTick: 3,
      consecutiveXcrunEtimedout: 0,
      consecutiveBootedHangProbes: 3,
      simState: 'Booted',
      recoveredOnce: true,
      hostXcodebuildPids: '4242',
      hostWdaPids: '(none)',
      lastXcodebuildExitLabel: '65',
      prebuiltWdaArtifactPresent: false,
    };
  assert.equal(
    decideSessionCreateHangAction({
      ...base,
      consecutiveLiveBuildDeferrals: IOS_SESSION_CREATE_HANG_LIVE_PID_DEFER_MAX_TICKS - 1,
    }).action,
    'skip-recover',
  );
    const escalated = decideSessionCreateHangAction({
      ...base,
      consecutiveLiveBuildDeferrals: IOS_SESSION_CREATE_HANG_LIVE_PID_DEFER_MAX_TICKS,
    });
    assert.equal(escalated.action, 'abort');
    if (escalated.action === 'abort') {
      assert.match(escalated.reason, /live-PID deferral cap reached/);
    }
  });

  test('formatSessionCreateHangAbortError keeps stable prefix', () => {
    assert.match(
      formatSessionCreateHangAbortError('WDA not ready').message,
      /^\[e2e-ios-boot\] session-create abort: WDA not ready$/,
    );
  });

  test('noteXcodebuildExitFromLine updates the hang-watchdog exit ref', () => {
    const ref = { value: null as number | null };
    assert.equal(
      noteXcodebuildExitFromLine("[Xcode] xcodebuild exited with code '65'", ref),
      65,
    );
    assert.equal(ref.value, 65);
    assert.equal(noteXcodebuildExitFromLine('nope', ref), null);
    assert.equal(ref.value, 65);
  });
});
