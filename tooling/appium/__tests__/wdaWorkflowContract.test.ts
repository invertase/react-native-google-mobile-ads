import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  IOS_SESSION_RETRY_TIMEOUT_MS,
  WDA_LAUNCH_TIMEOUT_MS,
} from '../src/hostPreflight.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const { appPath, parseUdid } = require('../../../scripts/run-ios-app.js') as {
  appPath: string;
  parseUdid: (args: string[]) => string;
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
    'yarn tests:e2e:codegen && yarn tests:ios:pod:install && yarn workspace RNGoogleMobileAdsExample react-native build-ios --buildFolder build && node ./scripts/run-ios-app.js',
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
});

test('iOS WDA and WDIO session timeouts retain their reviewed CI budgets', () => {
  assert.equal(WDA_LAUNCH_TIMEOUT_MS, 300_000);
  assert.equal(IOS_SESSION_RETRY_TIMEOUT_MS, 330_000);
});
