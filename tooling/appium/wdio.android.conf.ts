import type { Options } from '@wdio/types';
import {
  EXAMPLE_ANDROID_ACTIVITY,
  EXAMPLE_ANDROID_PACKAGE,
  androidDebugApkPath,
} from './src/formats.ts';
import { config as shared } from './wdio.shared.conf.ts';

/**
 * Android Appium smoke (UiAutomator2).
 * Prerequisites: `yarn tests:appium:drivers:install`, emulator/device, Metro on :8081,
 * `yarn tests:android:build` (or set RNGMA_ANDROID_APK).
 */
export const config: Options.Testrunner = {
  ...shared,
  specs: ['./test/specs/**/*.ts'],
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
      'appium:autoGrantPermissions': true,
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
