import type { Options } from '@wdio/types';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const appiumHome = path.join(packageRoot, '.appium-home');
const APPIUM_PORT = Number(process.env.RNGMA_APPIUM_PORT || 4725);

/**
 * Shared WebdriverIO config for Appium 3 focused smoke against RNGoogleMobileAdsExample.
 */
export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./test/specs/**/*.ts'],
  exclude: [],
  maxInstances: 1,
  logLevel: 'warn',
  bail: 1,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 2,
  hostname: '127.0.0.1',
  port: APPIUM_PORT,
  path: '/',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 180000,
    bail: true,
  },
  onComplete(exitCode, _config, _capabilities, result) {
    const failed = result?.failed ?? 0;
    if (exitCode !== 0 || failed > 0) {
      // WDIO can report failures while still exiting 0; force a non-zero process status.
      process.exit(1);
    }
  },
  async onPrepare() {
    // @wdio/appium-service spawns Appium with process.env only (ignores service `env`).
    process.env.APPIUM_HOME = appiumHome;
  },
  services: [
    [
      'appium',
      {
        command: 'appium',
        args: {
          port: APPIUM_PORT,
          relaxedSecurity: true,
        },
        env: {
          APPIUM_HOME: appiumHome,
        },
      },
    ],
  ],
};

export { appiumHome, packageRoot };
