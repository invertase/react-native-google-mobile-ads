import type { Options } from '@wdio/types';
import {
  EXAMPLE_ANDROID_ACTIVITY,
  EXAMPLE_ANDROID_PACKAGE,
  androidDebugApkPath,
} from './src/formats.ts';
import { runtimeResources } from './src/slots.ts';
import { config as shared } from './wdio.shared.conf.ts';

const runtime = runtimeResources('android');

/**
 * Android Appium smoke (UiAutomator2).
 * Prerequisites: `yarn tests:appium:drivers:install`, emulator/device, Metro on :8081,
 * `yarn tests:android:build` (or set RNGMA_ANDROID_APK).
 */
export const config: Options.Testrunner = {
  ...shared,
  async before(_capabilities, _specs, browser) {
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
  },
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': process.env.RNGMA_ANDROID_DEVICE || 'Android Emulator',
      'appium:udid': process.env.RNGMA_ANDROID_UDID,
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
