import type { Options } from '@wdio/types';
import { iosAppPath } from './src/formats.ts';
import {
  DEFAULT_IOS_DEVICE_NAME,
  IOS_SESSION_RETRY_TIMEOUT_MS,
  iosPrebuiltWdaCapabilities,
  requireIosUdid,
  SIMULATOR_STARTUP_TIMEOUT_MS,
  WDA_LAUNCH_TIMEOUT_MS,
} from './src/hostPreflight.ts';
import {
  formatIosIsHeadlessCapResolveLine,
  formatSessionCreateHangAbortError,
  logIosBootDiagnostics,
  noteXcodebuildExitFromLine,
  resolveIosIsHeadlessResolution,
  startIosSessionCreateHangWatchdog,
  type IosSessionCreateHangWatchdog,
} from './src/iosBootDiagnostics.ts';
import {
  clearXcodebuildExitState,
  installXcodebuildExitLogTap,
  xcodebuildExitStatePath,
} from './src/iosSessionDiagnostics.ts';
import { iosMetroProcessArguments, runtimeResources } from './src/slots.ts';
import { appiumHome, config as shared } from './wdio.shared.conf.ts';

const iosApp = iosAppPath();
const runtime = runtimeResources('ios');
const iosIsHeadlessResolution = resolveIosIsHeadlessResolution();
const iosIsHeadless = iosIsHeadlessResolution.isHeadless;
// One-shot at cap resolve so CI logs show the effective headless decision.
console.log(formatIosIsHeadlessCapResolveLine(iosIsHeadlessResolution));
let sessionCreateHangWatchdog: IosSessionCreateHangWatchdog | undefined;
/**
 * Launcher-only: @wdio/appium-service prints Appium `[Xcode]` lines in the
 * launcher process. Persist the last exit for the worker hang watchdog.
 */
const launcherXcodebuildExitRef: { value: number | null } = { value: null };
const xcodebuildExitStateFile = xcodebuildExitStatePath(runtime.appiumPort, appiumHome);
let uninstallLauncherXcodebuildExitLogTap: (() => void) | undefined;

/**
 * Print the stable hard marker and exit so parallel WDIO children abort early
 * too — hang-abort phase lines alone are not matched by the startup supervisor.
 * Serial preflight also wires onAbort → recordFailure; this path covers the
 * in-WDIO watchdog every child runs (serial + parallel).
 */
function abortWdioSessionCreateHang(error: Error): never {
  const marker =
    /\[e2e-ios-boot\] session-create abort/i.test(error.message)
      ? error
      : formatSessionCreateHangAbortError(error.message);
  console.error(marker.message);
  process.exit(1);
}

function disarmSessionCreateHangWatchdog(sessionId?: string): void {
  if (!sessionCreateHangWatchdog) {
    return;
  }
  if (sessionId != null) {
    sessionCreateHangWatchdog.markSessionCreated(sessionId);
  } else {
    sessionCreateHangWatchdog.stop();
  }
  sessionCreateHangWatchdog = undefined;
}

/**
 * iOS Appium smoke (XCUITest).
 * Prerequisites: `yarn tests:appium:drivers:install`, simulator, Metro on :8081,
 * built example (`yarn tests:ios:pod:install` + install via `yarn tests:ios:run --udid <selected-udid>` or set RNGMA_IOS_APP).
 */
export const config: Options.Testrunner = {
  ...shared,
  // Must remain longer than wdaLaunchTimeout so WDIO cannot terminate WDA's xcodebuild first.
  connectionRetryTimeout: IOS_SESSION_RETRY_TIMEOUT_MS,
  capabilities: [
    {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': process.env.RNGMA_IOS_DEVICE || DEFAULT_IOS_DEVICE_NAME,
      'appium:udid': requireIosUdid(),
      'appium:platformVersion': process.env.RNGMA_IOS_VERSION,
      ...iosMetroProcessArguments(runtime),
      ...(runtime.slotResources
        ? {
            'appium:wdaLocalPort': runtime.slotResources.automationPort,
            'appium:mjpegServerPort': runtime.slotResources.mjpegPort,
          }
        : {}),
      'appium:wdaLaunchTimeout': WDA_LAUNCH_TIMEOUT_MS,
      // Override appium-ios-simulator's 120s default; see SIMULATOR_STARTUP_TIMEOUT_MS.
      'appium:simulatorStartupTimeout': SIMULATOR_STARTUP_TIMEOUT_MS,
      // Without this, Appium suppresses xcodebuild stdout/stderr and exit-65
      // failures only print "xcodebuild exited with code '65'" with no cause.
      'appium:showXcodeLog': true,
      ...iosPrebuiltWdaCapabilities(),
      'appium:app': iosApp,
      'appium:newCommandTimeout': 240,
      'appium:noReset': false,
      // Mirror Android: force reinstall so a cached/pre-installed bundle never shadows the
      // freshly built app when the version is unchanged.
      'appium:enforceAppInstall': true,
      // CI: select-and-boot leaves a headless Booted sim; default isHeadless=false makes
      // Appium shut down + relaunch Simulator UI (guest death / bootstatus hang).
      // Local/slotted: false unless RNGMA_IOS_HEADLESS=1.
      'appium:isHeadless': iosIsHeadless,
    },
  ],
  async onPrepare(config, capabilities) {
    const sharedPrepare = shared.onPrepare;
    if (typeof sharedPrepare === 'function') {
      await sharedPrepare.call(this, config, capabilities);
    }
    // Launcher process: tap Appium-service log lines and persist exit codes for
    // the worker hang watchdog (serial + each parallel iOS child WDIO).
    clearXcodebuildExitState(xcodebuildExitStateFile);
    launcherXcodebuildExitRef.value = null;
    uninstallLauncherXcodebuildExitLogTap?.();
    uninstallLauncherXcodebuildExitLogTap = installXcodebuildExitLogTap(
      launcherXcodebuildExitRef,
      {
        noteLine: noteXcodebuildExitFromLine,
        statePath: xcodebuildExitStateFile,
      },
    );
    // Timestamped lines land in the supervised WDIO child log before session create.
    logIosBootDiagnostics(requireIosUdid(), {
      phase: 'wdio:onPrepare',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
    });
  },
  async onComplete(exitCode, configArg, capabilities, result) {
    uninstallLauncherXcodebuildExitLogTap?.();
    uninstallLauncherXcodebuildExitLogTap = undefined;
    const sharedComplete = shared.onComplete;
    if (typeof sharedComplete === 'function') {
      await sharedComplete.call(this, exitCode, configArg, capabilities, result);
    }
  },
  async beforeSession(_config, capabilities) {
    const caps = (Array.isArray(capabilities) ? capabilities[0] : capabilities) as
      | Record<string, unknown>
      | undefined;
    const timeoutRaw = caps?.['appium:simulatorStartupTimeout'];
    const timeoutMs = typeof timeoutRaw === 'number' ? timeoutRaw : SIMULATOR_STARTUP_TIMEOUT_MS;
    const udid =
      typeof caps?.['appium:udid'] === 'string' ? caps['appium:udid'] : requireIosUdid();
    logIosBootDiagnostics(udid, {
      phase: 'wdio:beforeSession',
      simulatorStartupTimeoutMs: timeoutMs,
    });
    sessionCreateHangWatchdog?.stop();
    // Worker process: do not tap stdout here — Appium `[Xcode]` lines are emitted
    // in the launcher. Read the per-port sidecar the launcher writes.
    sessionCreateHangWatchdog = startIosSessionCreateHangWatchdog(udid, {
      phase: 'wdio:session-create',
      simulatorStartupTimeoutMs: timeoutMs,
      lastXcodebuildExitStatePath: xcodebuildExitStateFile,
      onAbort: abortWdioSessionCreateHang,
    });
  },
  async before(_capabilities, _specs, browser) {
    // Session id exists — disarm before mid-suite xcrun ETIMEDOUT can WDA-terminate.
    const sessionId =
      browser && typeof browser.sessionId === 'string' ? browser.sessionId : undefined;
    disarmSessionCreateHangWatchdog(sessionId ?? '(present)');
  },
  async afterSession() {
    disarmSessionCreateHangWatchdog();
  },
};
