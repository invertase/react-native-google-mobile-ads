import type { Options } from '@wdio/types';
import { EXAMPLE_IOS_BUNDLE_ID, iosAppPath } from './src/formats.ts';
import { config as shared } from './wdio.shared.conf.ts';

const iosApp = iosAppPath();

/**
 * iOS Appium smoke (XCUITest).
 * Prerequisites: `yarn tests:appium:drivers:install`, simulator, Metro on :8081,
 * built example (`yarn tests:ios:pod:install` + install via `yarn tests:ios:run` or set RNGMA_IOS_APP).
 */
export const config: Options.Testrunner = {
  ...shared,
  specs: ['./test/specs/**/*.ts'],
  capabilities: [
    {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': process.env.RNGMA_IOS_DEVICE || 'iPhone 16',
      'appium:platformVersion': process.env.RNGMA_IOS_VERSION,
      'appium:bundleId': EXAMPLE_IOS_BUNDLE_ID,
      ...(iosApp ? { 'appium:app': iosApp } : {}),
      'appium:newCommandTimeout': 240,
      'appium:noReset': false,
    },
  ],
};
