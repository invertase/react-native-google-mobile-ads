import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ANDROID_SESSION_TIMEOUT_HINT,
  annotateAndroidSessionLogLine,
  androidPackageIsInstalled,
  formatAndroidBootDiagnosticLine,
  formatAndroidSessionDiagnosticLine,
  formatAndroidWorkerTimeoutHint,
  prepareAndroidSessionInstall,
  preUninstallAndroidAppIfPresent,
  type AndroidExecCapture,
} from '../src/androidSessionDiagnostics.ts';

describe('androidSessionDiagnostics', () => {
  test('format lines keep stable prefixes', () => {
    assert.equal(
      formatAndroidSessionDiagnosticLine(
        { phase: 'test', serial: 'emulator-5554' },
        () => new Date('2026-10-14T12:00:00.000Z'),
      ),
      '[e2e-android-session] ts=2026-10-14T12:00:00.000Z phase=test serial=emulator-5554',
    );
    assert.match(
      formatAndroidBootDiagnosticLine({ phase: 'boot' }, () => new Date('2026-10-14T12:00:00.000Z')),
      /^\[e2e-android-boot\] /,
    );
  });

  test('androidPackageIsInstalled reads pm path', () => {
    const exec: AndroidExecCapture = (_bin, args) => {
      if (args.includes('path')) {
        return {
          stdout: 'package:/data/app/com.microsoft.reacttestapp/base.apk\n',
          stderr: '',
          status: 0,
        };
      }
      return { stdout: '', stderr: '', status: 1 };
    };
    assert.equal(
      androidPackageIsInstalled('emulator-5554', 'com.microsoft.reacttestapp', exec),
      true,
    );
    assert.equal(
      androidPackageIsInstalled('emulator-5554', 'com.microsoft.reacttestapp', () => ({
        stdout: '',
        stderr: '',
        status: 1,
      })),
      false,
    );
  });

  test('preUninstallAndroidAppIfPresent uninstalls when installed', () => {
    const calls: string[][] = [];
    const exec: AndroidExecCapture = (_bin, args) => {
      calls.push(args);
      if (args.includes('path')) {
        return {
          stdout: 'package:/data/app/x/base.apk\n',
          stderr: '',
          status: 0,
        };
      }
      return { stdout: 'Success\n', stderr: '', status: 0 };
    };
    const result = preUninstallAndroidAppIfPresent('emulator-5554', {
      execCapture: exec,
      now: (() => {
        let t = 1000;
        return () => {
          t += 25;
          return t;
        };
      })(),
    });
    assert.equal(result.wasInstalled, true);
    assert.equal(result.attempted, true);
    assert.equal(result.removed, true);
    assert.ok(calls.some(args => args.includes('uninstall')));
  });

  test('preUninstallAndroidAppIfPresent is a no-op when absent', () => {
    const calls: string[][] = [];
    const result = preUninstallAndroidAppIfPresent('emulator-5554', {
      execCapture: (_bin, args) => {
        calls.push(args);
        return { stdout: '', stderr: '', status: 1 };
      },
    });
    assert.equal(result.attempted, false);
    assert.equal(result.wasInstalled, false);
    assert.ok(!calls.some(args => args.includes('uninstall')));
  });

  test('prepareAndroidSessionInstall emits boot + session lines', () => {
    const lines: string[] = [];
    prepareAndroidSessionInstall('emulator-5554', {
      write: line => lines.push(line),
      now: () => new Date('2026-10-14T12:00:00.000Z'),
      execCapture: () => ({ stdout: '', stderr: '', status: 1 }),
    });
    assert.ok(lines.some(line => /\[e2e-android-boot\].*pre-uninstall:begin/.test(line)));
    assert.ok(lines.some(line => /\[e2e-android-session\].*pre-uninstall/.test(line)));
  });

  test('annotateAndroidSessionLogLine tags INSTALL_FAILED and uia2/session', () => {
    const lines: string[] = [];
    const state = { reinstallStartedAtMs: 1_000 };
    annotateAndroidSessionLogLine(
      'Error: INSTALL_FAILED_UPDATE_INCOMPATIBLE: Package ...',
      {
        write: line => lines.push(line),
        now: () => new Date('2026-10-14T12:00:01.000Z'),
        state,
      },
    );
    assert.ok(lines.some(line => /install-failed.*UPDATE_INCOMPATIBLE/.test(line)));
    annotateAndroidSessionLogLine('Starting UiAutomator2 server', {
      write: line => lines.push(line),
      now: () => new Date('2026-10-14T12:00:02.000Z'),
      state,
    });
    assert.ok(lines.some(line => /uia2-start/.test(line)));
    annotateAndroidSessionLogLine('Appium session created successfully', {
      write: line => lines.push(line),
      now: () => new Date('2026-10-14T12:00:03.000Z'),
      state,
    });
    assert.ok(lines.some(line => /session-created/.test(line)));
  });

  test('formatAndroidWorkerTimeoutHint only annotates Android sources', () => {
    const base = 'Timed out after 60000ms waiting for worker startup readiness (serial-android; workers=1/1 sessions=0/1).';
    assert.match(formatAndroidWorkerTimeoutHint('serial-android', base), /INSTALL_FAILED_UPDATE_INCOMPATIBLE/);
    assert.match(formatAndroidWorkerTimeoutHint('android:a-primary', base), new RegExp(ANDROID_SESSION_TIMEOUT_HINT.slice(0, 40)));
    assert.equal(formatAndroidWorkerTimeoutHint('ios:a-primary', base), base);
  });
});
