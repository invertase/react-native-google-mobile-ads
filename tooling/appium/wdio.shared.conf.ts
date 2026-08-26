import type { Options } from '@wdio/types';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const appiumHome = path.join(packageRoot, '.appium-home');

/**
 * Shared WebdriverIO config for Appium 3 smoke.
 * Device suites land later; specs may be empty/skipped until then.
 */
export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./test/specs/**/*.ts'],
  exclude: [],
  maxInstances: 1,
  logLevel: 'warn',
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 2,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },
  services: [
    [
      'appium',
      {
        // Prefer the workspace Appium binary + pinned APPIUM_HOME.
        command: 'appium',
        args: {
          relaxedSecurity: true,
          // Port chosen per platform config via baseConfig merge.
        },
        // Ensure drivers come from the checked-in pin install tree.
        env: {
          APPIUM_HOME: appiumHome,
        },
      },
    ],
  ],
};

export { appiumHome, packageRoot };
