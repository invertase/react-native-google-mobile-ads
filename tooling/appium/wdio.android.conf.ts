import type { Options } from '@wdio/types';
import { execFileSync } from 'node:child_process';
import {
  EXAMPLE_ANDROID_ACTIVITY,
  EXAMPLE_ANDROID_PACKAGE,
  androidDebugApkPath,
} from './src/formats.ts';
import { dismissAndroidAnrDialogsViaAdb } from './src/androidAnrDismiss.ts';
import {
  ensureAndroidMetroReverse,
  type AndroidExec,
} from './src/hostPreflight.ts';
import { runtimeResources } from './src/slots.ts';
import { probeMetroPackagerHttp } from './src/startupSupervisor.ts';
import { config as shared } from './wdio.shared.conf.ts';

const runtime = runtimeResources('android');

/**
 * Slot Android Appium must pin an exact serial before session create. An unset
 * `appium:udid` lets UiAutomator2 attach to any connected emulator (for example a
 * non-slot lab AVD), install the APK there, and miss the slot Metro reverse.
 */
function resolveAndroidSessionUdid(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (runtime.slotResources) {
    const expected = runtime.slotResources.androidSerial;
    const provided = env.RNGMA_ANDROID_UDID;
    if (provided == null || provided === '') {
      throw new Error(
        `RNGMA_ANDROID_UDID is required for slot ${runtime.slot} Android Appium; expected ${expected} (${runtime.slotResources.androidAvdName}). Refusing an unscoped session that could attach to another connected emulator.`,
      );
    }
    if (provided !== expected) {
      throw new Error(
        `RNGMA_ANDROID_UDID=${provided} conflicts with RNGMA_E2E_SLOT=${runtime.slot}; expected ${expected} (${runtime.slotResources.androidAvdName}).`,
      );
    }
    return expected;
  }
  return env.RNGMA_ANDROID_UDID || undefined;
}

const androidSessionUdid = resolveAndroidSessionUdid();

type AndroidStartupBrowser = {
  execute(command: string, options: unknown): Promise<unknown>;
  activateApp(packageName: string): Promise<unknown>;
};

const systemAndroidExec: AndroidExec = (bin, args) =>
  execFileSync(bin, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 10_000,
  });

export async function prepareAndroidApp(
  browser: AndroidStartupBrowser,
  serial = androidSessionUdid ?? process.env.RNGMA_ANDROID_UDID,
  execFile: AndroidExec = systemAndroidExec,
  metroReady: (port: number) => Promise<boolean> = probeMetroPackagerHttp,
): Promise<void> {
  if (!serial) {
    throw new Error('RNGMA_ANDROID_UDID is required for Android Appium startup.');
  }
  // Positive confirmation before launch: host Metro must already be serving.
  // Activating into a dead packager produces a redbox and wastes gallery waits.
  if (!(await metroReady(runtime.metroPort))) {
    throw new Error(
      `Metro on 127.0.0.1:${runtime.metroPort} is not packager-status:running; refusing to activate the Android app into a JS-load redbox. Start the named slot packager (yarn tests:packager with RNGMA_E2E_SLOT / RNGMA_E2E_PLATFORM) before Appium.`,
    );
  }
  // UiAutomator2 session creation may restart adb transport while installing/resetting
  // the app. Re-establish and prove the reverse after that work, immediately before
  // launch, so a pre-session success cannot leave the app redboxed on fresh AVDs.
  ensureAndroidMetroReverse(serial, execFile, runtime.metroPort);
  console.log(
    `Android device ${serial} retained this checkout's Metro reverse through session setup on tcp:${runtime.metroPort}.`,
  );

  // Multi-AVD load often stacks System UI / launcher / "Process system" ANRs.
  // UiAutomator cannot click those reliably; dismiss Wait via adb before launch.
  const anr = dismissAndroidAnrDialogsViaAdb(serial);
  if (anr.tapped > 0) {
    console.log(
      `Android device ${serial} ANR dismiss via adb: cleared=${anr.cleared} rounds=${anr.rounds} taps=${anr.tapped}.`,
    );
  }

  // Appium clears app data during session creation, so establish the selected device's
  // reversed localhost as React Native's debug host only after that reset, then launch.
  const preferences = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?><map><string name='debug_http_host'>127.0.0.1:${runtime.metroPort}</string></map>`;
  const encodedPreferences = Buffer.from(preferences).toString('base64');
  await browser.execute('mobile: shell', {
    command: 'run-as',
    args: [
      EXAMPLE_ANDROID_PACKAGE,
      'mkdir',
      '-p',
      'shared_prefs',
    ],
  });
  await browser.execute('mobile: shell', {
    command: 'run-as',
    args: [
      EXAMPLE_ANDROID_PACKAGE,
      'sh',
      '-c',
      `'echo ${encodedPreferences} | base64 -d > shared_prefs/${EXAMPLE_ANDROID_PACKAGE}_preferences.xml'`,
    ],
  });
  await browser.activateApp(EXAMPLE_ANDROID_PACKAGE);
}

/**
 * Android Appium smoke (UiAutomator2).
 * Prerequisites: `yarn tests:appium:drivers:install`, emulator/device, Metro on :8081,
 * `yarn tests:android:build` (or set RNGMA_ANDROID_APK).
 */
export const config: Options.Testrunner = {
  ...shared,
  async before(_capabilities, _specs, browser) {
    await prepareAndroidApp(browser);
  },
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName':
        process.env.RNGMA_ANDROID_DEVICE ||
        runtime.slotResources?.androidAvdName ||
        'Android Emulator',
      // Never omit udid in slot mode — undefined means "any device".
      'appium:udid': androidSessionUdid,
      'appium:app': androidDebugApkPath(),
      'appium:appPackage': EXAMPLE_ANDROID_PACKAGE,
      'appium:appActivity': EXAMPLE_ANDROID_ACTIVITY,
      'appium:appWaitActivity': '*',
      'appium:autoLaunch': false,
      'appium:autoGrantPermissions': true,
      ...(runtime.slotResources
        ? {
            'appium:systemPort': runtime.slotResources.automationPort,
            'appium:mjpegServerPort': runtime.slotResources.mjpegPort,
          }
        : {}),
      'appium:newCommandTimeout': 240,
      'appium:noReset': false,
      // CI caches the whole emulator (`~/.android/avd/*`) after the app is installed, so a
      // freshly built APK with the same versionCode is otherwise skipped and a stale app runs
      // against fresh Metro JS. Force reinstall so native always matches the built APK.
      'appium:enforceAppInstall': true,
      'appium:uiautomator2ServerLaunchTimeout': 60000,
      'appium:adbExecTimeout': 60000,
      'appium:ignoreHiddenApiPolicyError': true,
    },
  ],
};
