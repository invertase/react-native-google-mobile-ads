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
console.log(formatIosIsHeadlessCapResolveLine(iosIsHeadlessResolution));
let sessionCreateHangWatchdog: IosSessionCreateHangWatchdog | undefined;
const launcherXcodebuildExitRef: { value: number | null } = { value: null };
const xcodebuildExitStateFile = xcodebuildExitStatePath(runtime.appiumPort, appiumHome);
let uninstallLauncherXcodebuildExitLogTap: (() => void) | undefined;

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
  ...(process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
    ? { logLevel: 'warn' as const }
    : {}),
  connectionRetryTimeout: IOS_SESSION_RETRY_TIMEOUT_MS,
  // One connection retry after a transient WDIO transport flake; no harness respawn.
  connectionRetryCount: 1,
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
      'appium:simulatorStartupTimeout': SIMULATOR_STARTUP_TIMEOUT_MS,
      'appium:showXcodeLog': true,
      ...iosPrebuiltWdaCapabilities(),
      'appium:app': iosApp,
      'appium:newCommandTimeout': 240,
      'appium:noReset': false,
      'appium:enforceAppInstall': true,
      'appium:isHeadless': iosIsHeadless,
    },
  ],
  async onPrepare(config, capabilities) {
    const sharedPrepare = shared.onPrepare;
    if (typeof sharedPrepare === 'function') {
      await sharedPrepare.call(this, config, capabilities);
    }
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
    const wdaLocalPortRaw = caps?.['appium:wdaLocalPort'];
    sessionCreateHangWatchdog = startIosSessionCreateHangWatchdog(udid, {
      phase: 'wdio:session-create',
      simulatorStartupTimeoutMs: timeoutMs,
      lastXcodebuildExitStatePath: xcodebuildExitStateFile,
      appiumHome,
      wdaLocalPort:
        typeof wdaLocalPortRaw === 'number'
          ? wdaLocalPortRaw
          : (runtime.slotResources?.automationPort ?? 8_100),
      wdaPortProbeEnabled: true,
    });
  },
  async before(_capabilities, _specs, browser) {
    const sessionId =
      browser && typeof browser.sessionId === 'string' ? browser.sessionId : undefined;
    disarmSessionCreateHangWatchdog(sessionId ?? '(present)');
  },
  async afterSession() {
    disarmSessionCreateHangWatchdog();
  },
};