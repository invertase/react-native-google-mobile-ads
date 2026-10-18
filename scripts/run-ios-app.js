const { execFileSync, spawnSync } = require('node:child_process');
const { statSync } = require('node:fs');
const { resolve } = require('node:path');

const repositoryRoot = resolve(__dirname, '..');
const appPath = resolve(
  repositoryRoot,
  'RNGoogleMobileAdsExample/ios/build/Build/Products/Debug-iphonesimulator/ReactTestApp.app',
);

/** simctl install wall; CI should fail here instead of the GHA step. */
const INSTALL_TIMEOUT_MS = 90_000;
/** simctl launch wall; hung Launch Services must not burn the step budget. */
const LAUNCH_TIMEOUT_MS = 90_000;
/** Best-effort diagnostics must not hang the failure path. */
const DIAGNOSTICS_TIMEOUT_MS = 15_000;

function parseUdid(args) {
  const udidIndex = args.indexOf('--udid');
  const udid = udidIndex >= 0 ? args[udidIndex + 1] : undefined;

  if (!udid || udidIndex !== args.length - 2) {
    throw new Error('Usage: yarn tests:ios:run --udid <simulator-udid>');
  }

  return udid;
}

function logPhase(phase, event, details = {}) {
  const parts = [`[ios-run] phase=${phase} ${event}`, `ts=${new Date().toISOString()}`];
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    parts.push(`${key}=${value}`);
  }
  console.log(parts.join(' '));
}

/**
 * Run a command with an optional wall-clock timeout (Node SIGKILL on ETIMEDOUT).
 * Prefer this over assuming GNU `timeout` on macOS CI.
 */
function runTimed(bin, args, { timeoutMs, stdio = 'inherit' } = {}) {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    stdio,
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
  });

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      const error = new Error(`Timed out after ${timeoutMs}ms: ${bin} ${args.join(' ')}`);
      error.code = 'ETIMEDOUT';
      error.timedOut = true;
      throw error;
    }
    throw result.error;
  }

  if (result.signal) {
    const error = new Error(`Terminated by ${result.signal}: ${bin} ${args.join(' ')}`);
    error.signal = result.signal;
    throw error;
  }

  if (result.status !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const error = new Error(
      `Exited ${result.status}: ${bin} ${args.join(' ')}${stderr ? `: ${stderr}` : ''}`,
    );
    error.status = result.status;
    error.stderr = result.stderr;
    error.stdout = result.stdout;
    throw error;
  }

  return result;
}

function captureBestEffort(bin, args, timeoutMs) {
  try {
    const result = spawnSync(bin, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
    });
    if (result.error) {
      return `error: ${result.error.message}`;
    }
    if (result.signal) {
      return `signal: ${result.signal}`;
    }
    const stdout = String(result.stdout || '').trim();
    const stderr = String(result.stderr || '').trim();
    if (result.status !== 0) {
      return `exit ${result.status}${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ''}`;
    }
    return stdout || '(empty)';
  } catch (error) {
    return `threw: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function snippet(text, maxChars = 2_000) {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n… truncated ${text.length - maxChars} chars`;
}

/** Best-effort post-failure diagnostics; never throws. */
function logInstallLaunchDiagnostics(udid, bundleIdentifier, appPathForLog) {
  console.error(
    `[ios-run] diagnostics bundleId=${bundleIdentifier} appPath=${appPathForLog} udid=${udid}`,
  );
  try {
    const container = captureBestEffort(
      'xcrun',
      ['simctl', 'get_app_container', udid, bundleIdentifier],
      DIAGNOSTICS_TIMEOUT_MS,
    );
    console.error(`[ios-run] diagnostics get_app_container: ${snippet(container, 500)}`);
  } catch {
    // ignore
  }
  try {
    const listapps = captureBestEffort(
      'xcrun',
      ['simctl', 'listapps', udid],
      DIAGNOSTICS_TIMEOUT_MS,
    );
    const needle = bundleIdentifier;
    const lines = String(listapps).split('\n');
    const relevant = lines.filter(line => line.includes(needle));
    const body = relevant.length > 0 ? relevant.join('\n') : snippet(listapps, 1_500);
    console.error(`[ios-run] diagnostics listapps snippet:\n${body}`);
  } catch {
    // ignore
  }
}

function withPhase(phase, fn) {
  const startedAt = Date.now();
  logPhase(phase, 'start');
  try {
    const value = fn();
    logPhase(phase, 'end', { ok: true, elapsedMs: Date.now() - startedAt });
    return value;
  } catch (error) {
    logPhase(phase, 'end', {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** Boot if Shutdown (simctl boot is a no-op error when already Booted), then wait for ready. */
function ensureSimulatorBooted(udid) {
  try {
    execFileSync('xcrun', ['simctl', 'boot', udid], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const stderr = String(error.stderr || error.message || '');
    if (!/current state: Booted|Unable to boot device in current state: Booted/i.test(stderr)) {
      // Already booted is fine; any other boot failure still needs bootstatus/install to surface.
      if (!/Booted/i.test(stderr)) {
        console.warn(`simctl boot ${udid}: ${stderr.trim() || 'non-zero exit'}`);
      }
    }
  }
  withPhase('bootstatus', () => {
    execFileSync('xcrun', ['simctl', 'bootstatus', udid, '-b'], { stdio: 'inherit' });
  });
}

function run(args = process.argv.slice(2)) {
  const udid = parseUdid(args);
  const executablePath = resolve(appPath, 'ReactTestApp');

  if (!statSync(executablePath).isFile()) {
    throw new Error(`iOS app executable is not a regular file: ${executablePath}`);
  }

  const bundleIdentifier = execFileSync(
    '/usr/libexec/PlistBuddy',
    ['-c', 'Print:CFBundleIdentifier', resolve(appPath, 'Info.plist')],
    { encoding: 'utf8' },
  ).trim();

  console.log(
    `[ios-run] udid=${udid} bundleId=${bundleIdentifier} appPath=${appPath} installTimeoutMs=${INSTALL_TIMEOUT_MS} launchTimeoutMs=${LAUNCH_TIMEOUT_MS}`,
  );

  ensureSimulatorBooted(udid);

  try {
    withPhase('install', () => {
      runTimed('xcrun', ['simctl', 'install', udid, appPath], {
        timeoutMs: INSTALL_TIMEOUT_MS,
        stdio: 'inherit',
      });
    });
  } catch (error) {
    logInstallLaunchDiagnostics(udid, bundleIdentifier, appPath);
    throw error;
  }

  try {
    withPhase('launch', () => {
      runTimed('xcrun', ['simctl', 'launch', udid, bundleIdentifier], {
        timeoutMs: LAUNCH_TIMEOUT_MS,
        stdio: 'inherit',
      });
    });
  } catch (error) {
    logInstallLaunchDiagnostics(udid, bundleIdentifier, appPath);
    throw error;
  }
}

module.exports = {
  appPath,
  parseUdid,
  run,
  ensureSimulatorBooted,
  INSTALL_TIMEOUT_MS,
  LAUNCH_TIMEOUT_MS,
  DIAGNOSTICS_TIMEOUT_MS,
  runTimed,
  logPhase,
  withPhase,
  logInstallLaunchDiagnostics,
};

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
