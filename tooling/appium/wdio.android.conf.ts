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
      'appium:app': androidDebugApkPath(),
      'appium:appPackage': EXAMPLE_ANDROID_PACKAGE,
      'appium:appActivity': EXAMPLE_ANDROID_ACTIVITY,
      'appium:appWaitActivity': '*',
      'appium:autoGrantPermissions': true,
      'appium:newCommandTimeout': 240,
      'appium:noReset': false,
      'appium:uiautomator2ServerLaunchTimeout': 60000,
      'appium:adbExecTimeout': 60000,
      'appium:ignoreHiddenApiPolicyError': true,
    },
  ],
};
