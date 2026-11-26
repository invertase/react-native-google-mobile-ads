import type { Options } from '@wdio/types';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flushCoverageFromApp } from './src/flushCoverage.ts';
import { appiumServerLogPath } from './src/iosSessionDiagnostics.ts';
import { platformForSharedConfig, runtimeResources } from './src/slots.ts';
import {
  consumeIosSessionCreateInfraAbort,
  RNGMA_INFRA_ABORT_PREFIX,
} from './src/wdioInfraAbort.ts';
import { selectedWdioSpecs } from './src/wdioSpecs.ts';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const appiumHome = path.join(packageRoot, '.appium-home');
const e2eLogDir = path.join(packageRoot, '.e2e-logs');
const APPIUM_PORT = runtimeResources(platformForSharedConfig()).appiumPort;
const appiumLogFile = appiumServerLogPath(appiumHome, APPIUM_PORT);

/**
 * Shared WebdriverIO config for Appium 4 focused smoke against RNGoogleMobileAdsExample.
 */
export const config: Options.Testrunner = {
  runner: 'local',
  // WDIO 10 defaults strictSelectors to true; gallery accordions can surface duplicate testIDs.
  strictSelectors: false,
  specs: selectedWdioSpecs(),
  exclude: [],
  maxInstances: 1,
  // Startup ownership consumes WDIO/Appium's session-created evidence before
  // allowing the slower app/JS readiness phase to begin.
  logLevel: 'info',
  outputDir: e2eLogDir,
  // Reliability worker sets RNGMA_WDIO_RUNNER_BAIL=0 so a failed shard process
  // never implies cross-shard runner bail; mocha bail stays on within a shard.
  bail: process.env.RNGMA_WDIO_RUNNER_BAIL === '0' ? 0 : 1,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 2,
  hostname: '127.0.0.1',
  port: APPIUM_PORT,
  path: '/',
  framework: 'mocha',
  reporters: ['spec'],
  // CI-only: one whole-spec retry absorbs intermittent Ad Inspector dismiss /
  // interstitial show-close flakes on shard c without masking local failures.
  ...(process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
    ? { specFileRetries: 1, specFileRetriesDelay: 2 }
    : {}),
  mochaOpts: {
    ui: 'bdd',
    // Request-outcome remount budgets (10 × observe + backoff + ads-log) and
    // rewarded show-close (≤120s dismiss wait) must finish before mocha Timeout
    // masks `[request-outcome]` exhaust diagnostics (GAM interstitial run).
    timeout: 600000,
    bail: true,
    ...(process.env.RNGMA_MOCHA_GREP ? { grep: process.env.RNGMA_MOCHA_GREP } : {}),
  },
  onComplete(exitCode, _config, _capabilities, result) {
    const failed = result?.failed ?? 0;
    if (consumeIosSessionCreateInfraAbort()) {
      const line = `${RNGMA_INFRA_ABORT_PREFIX} session-create (0 spec failures)`;
      console.error(line);
      throw new Error(line);
    }
    if (exitCode !== 0 || failed > 0) {
      throw new Error(
        `WebdriverIO completed with exit code ${exitCode} and ${failed} failed test(s).`,
      );
    }
  },
  async onPrepare() {
    // @wdio/appium-service spawns Appium with process.env only (ignores service `env`).
    process.env.APPIUM_HOME = appiumHome;
    mkdirSync(path.dirname(appiumLogFile), { recursive: true });
    mkdirSync(e2eLogDir, { recursive: true });
    // Drop a previous self-hosted job's debug log so the follower cannot replay it.
    writeFileSync(appiumLogFile, '');
  },
  /**
   * After each top-level smoke suite, while the Appium session is still alive:
   * tap Flush coverage so Emma/LLVM buffers hit disk before process kill.
   * Idempotent across the three session-split specs.
   */
  async afterSuite(suite) {
    // Mocha top-level describe: parent is the root suite.
    // Also accept root-less shapes from WDIO wrappers so bail paths still flush.
    if (suite.parent && !suite.parent.root) {
      return;
    }
    await flushCoverageFromApp();
  },
  services: [
    [
      'appium',
      {
        command: 'appium',
        // Cold CI Appium startup can exceed the default 30s; stay inside nested timeouts.
        appiumStartTimeout: 120_000,
        args: {
          port: APPIUM_PORT,
          relaxedSecurity: true,
          log: appiumLogFile,
          logLevel: 'error:debug',
        },
        env: {
          APPIUM_HOME: appiumHome,
        },
      },
    ],
  ],
};

export { appiumHome, appiumLogFile, e2eLogDir, packageRoot };
