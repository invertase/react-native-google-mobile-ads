import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  IOS_SESSION_RETRY_TIMEOUT_MS,
  SIMULATOR_STARTUP_TIMEOUT_MS,
  WDA_LAUNCH_TIMEOUT_MS,
} from '../src/hostPreflight.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const {
  appPath,
  parseUdid,
  INSTALL_TIMEOUT_MS,
  LAUNCH_TIMEOUT_MS,
  DIAGNOSTICS_TIMEOUT_MS,
  runTimed,
} = require('../../../scripts/run-ios-app.js') as {
  appPath: string;
  parseUdid: (args: string[]) => string;
  INSTALL_TIMEOUT_MS: number;
  LAUNCH_TIMEOUT_MS: number;
  DIAGNOSTICS_TIMEOUT_MS: number;
  runTimed: (
    bin: string,
    args: string[],
    options?: { timeoutMs?: number; stdio?: 'inherit' | 'pipe' | ['ignore', 'pipe', 'pipe'] },
  ) => { status: number | null };
};

test('iOS CI and publish use an explicit frozen root Ruby bundle before Yarn', () => {
  const workflows = ['tests_e2e_ios.yml', 'publish.yml'].map(name =>
    readFileSync(resolve(repositoryRoot, '.github/workflows', name), 'utf8'),
  );
  for (const workflow of workflows) {
    assert.match(workflow, /command: BUNDLE_FROZEN=true bundle install/);
    assert.match(
      workflow,
      /Gemfile\.lock's `BUNDLED WITH` version is the Bundler pin/,
    );
    assert.ok(
      workflow.indexOf('command: BUNDLE_FROZEN=true bundle install') <
        workflow.indexOf('command: yarn'),
      'frozen bundle install must run before Yarn',
    );
    assert.doesNotMatch(workflow, /bundler-cache:/);
    assert.doesNotMatch(workflow, /working-directory: RNGoogleMobileAdsExample/);
    assert.doesNotMatch(workflow, /gem update cocoapods xcodeproj/);
    assert.doesNotMatch(workflow, /(?:^|\s)pod install(?:\s|$)/);
  }

  assert.ok(readFileSync(resolve(repositoryRoot, 'Gemfile'), 'utf8').includes("gem 'cocoapods'"));
  assert.match(
    readFileSync(resolve(repositoryRoot, 'Gemfile.lock'), 'utf8'),
    /\nBUNDLED WITH\n {3}\d+\.\d+\.\d+\s*$/,
  );

  const rootPackage = JSON.parse(
    readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
  assert.equal(
    rootPackage.scripts['tests:ios:pod:install'],
    'bundle exec pod install --project-directory=RNGoogleMobileAdsExample/ios --repo-update',
  );
  assert.equal(
    rootPackage.scripts['tests:ios:run'],
    'yarn workspace @invertase/rngma-appium ios:run',
  );
});

test('canonical iOS installer requires the selected simulator and exact app', () => {
  assert.equal(
    appPath,
    resolve(
      repositoryRoot,
      'RNGoogleMobileAdsExample/ios/build/Build/Products/Debug-iphonesimulator/ReactTestApp.app',
    ),
  );
  assert.equal(parseUdid(['--udid', 'selected-simulator']), 'selected-simulator');
  assert.throws(() => parseUdid([]), /tests:ios:run --udid/);
  assert.throws(
    () => parseUdid(['--udid', 'selected-simulator', '--unexpected']),
    /tests:ios:run --udid/,
  );
});

test('iOS run-ios-app time-boxes install/launch and emits durable phase markers', () => {
  assert.equal(INSTALL_TIMEOUT_MS, 90_000);
  assert.equal(LAUNCH_TIMEOUT_MS, 90_000);
  assert.equal(DIAGNOSTICS_TIMEOUT_MS, 15_000);

  const source = readFileSync(resolve(repositoryRoot, 'scripts/run-ios-app.js'), 'utf8');
  assert.match(source, /\[ios-run\] phase=\$\{phase\}/);
  assert.match(source, /phase=bootstatus|withPhase\('bootstatus'/);
  assert.match(source, /withPhase\('install'/);
  assert.match(source, /withPhase\('launch'/);
  assert.match(source, /get_app_container/);
  assert.match(source, /listapps/);
  assert.match(source, /killSignal:\s*'SIGKILL'/);
  assert.doesNotMatch(source, /\bgtimeout\b|\btimeout\s+90\b/);

  // Node spawnSync timeout path — hang fails with ETIMEDOUT instead of GHA wall.
  assert.throws(
    () =>
      runTimed(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], {
        timeoutMs: 200,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { timedOut?: boolean; code?: string }).timedOut === true &&
      /Timed out after 200ms/.test(error.message),
  );

  const workflow = readFileSync(
    resolve(repositoryRoot, '.github/workflows/tests_e2e_ios.yml'),
    'utf8',
  );
  const installHeading = workflow.indexOf('- name: Install example on simulator');
  assert.ok(installHeading >= 0, 'workflow must keep Install example on simulator');
  const nextHeading = workflow.indexOf('\n      - name:', installHeading + 1);
  const installStep = workflow.slice(
    installHeading,
    nextHeading >= 0 ? nextHeading : undefined,
  );
  assert.match(installStep, /timeout-minutes:\s*25/);
  assert.match(installStep, /\[ios-run\] workflow step start/);
  assert.match(installStep, /\[ios-run\] workflow step end/);
});

test('CI prebuilds WDA before the WDIO command enables the prebuilt capability', () => {
  const rootPackage = JSON.parse(
    readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
  const appiumPackage = JSON.parse(
    readFileSync(resolve(repositoryRoot, 'tooling/appium/package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
  assert.equal(
    rootPackage.scripts['tests:appium:ios:prebuild-wda'],
    'yarn workspace @invertase/rngma-appium ios:prebuild-wda',
  );
  assert.equal(
    rootPackage.scripts['tests:appium:ios'],
    'cross-env RNGMA_WDA_PREBUILT=1 yarn workspace @invertase/rngma-appium appium:ios',
    'the canonical local iOS command must consume the shared prebuilt WDA by default',
  );
  assert.equal(appiumPackage.scripts['ios:prebuild-wda'], 'tsx ./scripts/prebuild-wda.ts');

  const workflow = readFileSync(
    resolve(repositoryRoot, '.github/workflows/tests_e2e_ios.yml'),
    'utf8',
  );
  const prebuild = workflow.indexOf('yarn tests:appium:ios:prebuild-wda');
  const enablePrebuilt = workflow.indexOf('export RNGMA_WDA_PREBUILT=1');
  const appium = workflow.indexOf('yarn tests:appium:ios', enablePrebuilt + 1);
  assert.ok(prebuild >= 0, 'workflow must run the named WDA prebuild');
  assert.ok(enablePrebuilt > prebuild, 'workflow must enable prebuilt WDA after a successful build');
  assert.ok(appium > enablePrebuilt, 'workflow must start WDIO only after prebuilt WDA is enabled');

  // Appium e2e must not use nick-fields/retry — that would re-run product fails.
  // Session-create infra aborts in-process via the WDIO hang-watchdog hard marker.
  const runAppiumHeading = workflow.indexOf('- name: Run Appium e2e');
  assert.ok(runAppiumHeading >= 0, 'workflow must have a dedicated Run Appium e2e step');
  const nextHeading = workflow.indexOf('\n      - name:', runAppiumHeading + 1);
  const runAppiumStep = workflow.slice(
    runAppiumHeading,
    nextHeading >= 0 ? nextHeading : undefined,
  );
  assert.doesNotMatch(runAppiumStep, /nick-fields\/retry/);
  assert.match(runAppiumStep, /^\s+run:\s*\|?\s*$/m);

  assert.match(workflow, /name: Upload WDA xcodebuild logs/);
  assert.match(workflow, /name: wda_xcodebuild_logs/);
  assert.match(workflow, /tooling\/appium\/\.wda-derived\/Logs/);
  assert.match(workflow, /tooling\/appium\/\.wda-derived\/\*\*\/\*\.xcresult/);
  // Durable sibling of DerivedData — not under `.wda-derived` (reclaimed between sessions).
  assert.match(workflow, /tooling\/appium\/\.hang-recover-snapshots/);
  assert.doesNotMatch(workflow, /tooling\/appium\/\.wda-derived\/hang-recover-snapshots/);
  assert.match(workflow, /tooling\/appium\/\.appium-home\/logs/);
});

test('wdio.ios.conf hang watchdog onAbort prints session-create abort hard marker', () => {
  const wdioSource = readFileSync(
    resolve(repositoryRoot, 'tooling/appium/wdio.ios.conf.ts'),
    'utf8',
  );
  assert.match(wdioSource, /formatSessionCreateHangAbortError/);
  assert.match(wdioSource, /onAbort:\s*abortWdioSessionCreateHang/);
  assert.match(wdioSource, /console\.error\(marker\.message\)/);
  // Source holds a regex literal: /\[e2e-ios-boot\] session-create abort/
  assert.match(wdioSource, /session-create abort/);
  assert.match(wdioSource, /appium:isHeadless/);
  assert.match(wdioSource, /resolveIosIsHeadlessResolution/);
  assert.match(wdioSource, /formatIosIsHeadlessCapResolveLine/);
  // Stop on session create (before), not only afterSession — mid-suite ETIMEDOUT
  // must not WDA-terminate an already-created session.
  assert.match(wdioSource, /async before\(/);
  assert.match(wdioSource, /markSessionCreated/);
  assert.match(wdioSource, /async afterSession\(/);
  // Launcher taps Appium [Xcode] lines; worker hang watchdog reads the sidecar.
  assert.match(wdioSource, /installXcodebuildExitLogTap/);
  assert.match(wdioSource, /noteXcodebuildExitFromLine/);
  assert.match(wdioSource, /xcodebuildExitStatePath/);
  assert.match(wdioSource, /lastXcodebuildExitStatePath/);
  assert.match(wdioSource, /async onPrepare\(/);
  assert.match(wdioSource, /async onComplete\(/);
});
test('named prebuild producer and XCUITest consumer use the shared DerivedData path', () => {
  const prebuildSource = readFileSync(
    resolve(repositoryRoot, 'tooling/appium/scripts/prebuild-wda.ts'),
    'utf8',
  );
  const hostPreflightSource = readFileSync(
    resolve(repositoryRoot, 'tooling/appium/src/hostPreflight.ts'),
    'utf8',
  );
  const wdioSource = readFileSync(
    resolve(repositoryRoot, 'tooling/appium/wdio.ios.conf.ts'),
    'utf8',
  );
  assert.match(
    prebuildSource,
    /import\s*\{[\s\S]*?\bIOS_WDA_DERIVED_DATA_PATH\b[\s\S]*?\}\s*from\s*['"]\.\.\/src\/hostPreflight\.ts['"]/,
  );
  assert.match(prebuildSource, /rmSync\(\s*IOS_WDA_DERIVED_DATA_PATH\b/);
  assert.match(prebuildSource, /derivedDataPath: IOS_WDA_DERIVED_DATA_PATH/);
  assert.match(
    hostPreflightSource,
    /['"]appium:derivedDataPath['"]\s*:\s*IOS_WDA_DERIVED_DATA_PATH/,
  );
  assert.match(
    wdioSource,
    /import\s*\{[\s\S]*?\biosPrebuiltWdaCapabilities\b[\s\S]*?\}\s*from\s*['"]\.\/src\/hostPreflight\.ts['"]/,
  );
  assert.match(wdioSource, /\.\.\.iosPrebuiltWdaCapabilities\(\)/);
  assert.match(wdioSource, /['"]appium:showXcodeLog['"]\s*:\s*true/);
  const sharedSource = readFileSync(
    resolve(repositoryRoot, 'tooling/appium/wdio.shared.conf.ts'),
    'utf8',
  );
  // Appium --log under .appium-home so supervisor-abort staging / CI globs capture stdio.
  assert.match(sharedSource, /appiumServerLogPath/);
  assert.match(sharedSource, /\blog:\s*appiumLogFile\b/);
});

test('iOS WDA and WDIO session timeouts retain their reviewed CI budgets', () => {
  assert.equal(WDA_LAUNCH_TIMEOUT_MS, 300_000);
  assert.equal(IOS_SESSION_RETRY_TIMEOUT_MS, 330_000);
  assert.equal(SIMULATOR_STARTUP_TIMEOUT_MS, 180_000);
});
