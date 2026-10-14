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
  logIosBootDiagnostics,
  startIosSessionCreateHangWatchdog,
  type IosSessionCreateHangWatchdog,
} from './src/iosBootDiagnostics.ts';
import { iosMetroProcessArguments, runtimeResources } from './src/slots.ts';
import { config as shared } from './wdio.shared.conf.ts';

const iosApp = iosAppPath();
const runtime = runtimeResources('ios');
let sessionCreateHangWatchdog: IosSessionCreateHangWatchdog | undefined;

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
      ...iosPrebuiltWdaCapabilities(),
      'appium:app': iosApp,
      'appium:newCommandTimeout': 240,
      'appium:noReset': false,
      // Mirror Android: force reinstall so a cached/pre-installed bundle never shadows the
      // freshly built app when the version is unchanged.
      'appium:enforceAppInstall': true,
    },
  ],
  async onPrepare(config, capabilities) {
    const sharedPrepare = shared.onPrepare;
    if (typeof sharedPrepare === 'function') {
      await sharedPrepare.call(this, config, capabilities);
    }
    // Timestamped lines land in the supervised WDIO child log before session create.
    logIosBootDiagnostics(requireIosUdid(), {
      phase: 'wdio:onPrepare',
      simulatorStartupTimeoutMs: SIMULATOR_STARTUP_TIMEOUT_MS,
    });
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
    // POST /session runs after this hook returns; re-probe if it hangs.
    sessionCreateHangWatchdog = startIosSessionCreateHangWatchdog(udid, {
      phase: 'wdio:session-create',
      simulatorStartupTimeoutMs: timeoutMs,
    });
  },
  async afterSession() {
    sessionCreateHangWatchdog?.stop();
    sessionCreateHangWatchdog = undefined;
  },
};
