import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  assertSimulatorReadyForPersist,
  collectIosBootDiagnosticLines,
  confirmSimulatorReadyForPersist,
  decideSessionCreateHangAction,
  findSimulatorDeviceInListJson,
  formatIosBootDiagnosticLine,
  formatIosIsHeadlessCapResolveLine,
  formatSessionCreateHangAbortError,
  IOS_SESSION_CREATE_HANG_HINT,
  isXcrunTimedOutError,
  noteXcodebuildExitFromLine,
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
      lastXcodebuildExitRef,
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
      execCapture: (_bin, args) => {
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
