import type { Options } from '@wdio/types';
import { config as shared } from './wdio.shared.conf.ts';

/**
 * Android Appium smoke config (UiAutomator2).
 * Requires: installed drivers (`yarn drivers:install`), emulator/device, built example APK.
 * Full format smoke specs are not in this scaffold — placeholder specs are skipped.
 */
export const config: Options.Testrunner = {
  ...shared,
  specs: ['./test/specs/**/*.ts'],
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Android Emulator',
      'appium:newCommandTimeout': 240,
      // Later: set appium:app / appPackage / appActivity against the example build.
    },
  ],
};
