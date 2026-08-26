import type { Options } from '@wdio/types';
import { config as shared } from './wdio.shared.conf.ts';

/**
 * iOS Appium smoke config (XCUITest).
 * Requires: installed drivers (`yarn drivers:install`), simulator, built example app.
 * Full format smoke specs are not in this scaffold — placeholder specs are skipped.
 */
export const config: Options.Testrunner = {
  ...shared,
  specs: ['./test/specs/**/*.ts'],
  capabilities: [
    {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPhone 16',
      'appium:newCommandTimeout': 240,
      // Later: set appium:app / bundleId against the example build.
    },
  ],
};
