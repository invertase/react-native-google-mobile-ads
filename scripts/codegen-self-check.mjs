#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  EXAMPLE_PACKAGE,
  OUTPUT_PATHS,
  regenerateAll,
  resolveToolchain,
  wipeOutput,
} from './codegen-package.mjs';
import { verifyCodegen } from './codegen-verify.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const read = relativePath =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const json = relativePath => JSON.parse(read(relativePath));

function checkWipeRemovesStaleFiles() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rngma-codegen-'));
  const output = path.join(temporaryRoot, 'generated');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'stale.txt'), 'stale');
  wipeOutput(output);
  assert.equal(fs.existsSync(output), false);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

const trackedGeneratedFiles = [
  'packages/core/android/generated/java/NativeSpec.java',
  'packages/core/ios/generated/RNGoogleMobileAdsSpec/NativeSpec.h',
].join('\0');

function verifyMock(overrides = {}) {
  const calls = [];
  const execute = (command, args) => {
    calls.push([command, args]);
    if (command !== 'git') {
      return undefined;
    }
    if (args[0] === 'ls-files' && args[1] === '--others') {
      return overrides.status ?? '';
    }
    if (args[0] === 'ls-files') {
      return overrides.tracked ?? `${trackedGeneratedFiles}\0`;
    }
    if (args[0] === 'diff' && overrides.drift) {
      const drift = new Error('generated drift');
      drift.status = 1;
      throw drift;
    }
    return '';
  };
  return { calls, execute };
}

function checkVerifyRejectsOmittedTrees() {
  const { calls, execute } = verifyMock({
    tracked: 'packages/core/android/generated/java/NativeSpec.java\0',
  });
  assert.throws(
    () => verifyCodegen(execute),
    /Missing tracked files under: packages\/core\/ios\/generated/,
  );
  assert.deepEqual(
    calls.map(([, args]) => args[0]),
    ['ls-files'],
    'Verification must reject an incomplete index before regeneration',
  );
}

function checkVerifyRejectsUntrackedExtras() {
  const { calls, execute } = verifyMock({
    status: '?? packages/core/ios/generated/Unexpected.h\n',
  });
  assert.throws(
    () => verifyCodegen(execute),
    /Generated Codegen trees contain untracked files/,
  );
  assert.deepEqual(
    calls.map(([, args]) => args.slice(0, 2)),
    [
      ['ls-files', '-z'],
      ['./scripts/codegen-package.mjs', 'all'],
      ['diff', '--exit-code'],
      ['ls-files', '--others'],
    ],
  );
}

function checkVerifyPropagatesDrift() {
  const { calls, execute } = verifyMock({ drift: true });
  assert.throws(
    () => verifyCodegen(execute),
    /generated drift/,
  );
  assert.deepEqual(calls[2], [
    'git',
    [
      'diff',
      '--exit-code',
      '--',
      'packages/core/android/generated',
      'packages/core/ios/generated',
    ],
  ]);
}

function digestTree(root) {
  const digest = createHash('sha256');
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name),
    )) {
      const absolute = path.join(directory, entry.name);
      digest.update(path.relative(root, absolute));
      if (entry.isDirectory()) {
        visit(absolute);
      } else {
        digest.update(fs.readFileSync(absolute));
      }
    }
  };
  visit(root);
  return digest.digest('hex');
}

function checkRegenerationIsDeterministic() {
  for (const output of Object.values(OUTPUT_PATHS)) {
    assert.ok(fs.existsSync(output), `Run yarn codegen:all first: missing ${output}`);
  }
  const before = Object.fromEntries(
    Object.entries(OUTPUT_PATHS).map(([platform, output]) => [
      platform,
      digestTree(output),
    ]),
  );
  regenerateAll();
  const after = Object.fromEntries(
    Object.entries(OUTPUT_PATHS).map(([platform, output]) => [
      platform,
      digestTree(output),
    ]),
  );
  assert.deepEqual(after, before);
}

function checkConfigurationContracts() {
  const core = json('packages/core/package.json');
  const example = json('RNGoogleMobileAdsExample/package.json');
  const probe = json(
    'RNGoogleMobileAdsExample/modules/rngma-testing/package.json',
  );
  const root = json('package.json');
  const toolchain = resolveToolchain();

  assert.equal(core.codegenConfig.includesGeneratedCode, true);
  assert.equal(example.codegenConfig?.includesGeneratedCode, undefined);
  assert.equal(probe.codegenConfig.includesGeneratedCode, undefined);
  assert.match(
    root.scripts['tests:e2e:codegen'],
    /--platform ios --source app/,
  );
  assert.doesNotMatch(
    root.scripts['tests:e2e:codegen'],
    /android\/app\/build\/generated\/source\/codegen/,
  );

  assert.match(
    read('packages/core/android/build.gradle'),
    /generated\/java/,
  );
  assert.match(
    read('packages/core/react-native.config.js'),
    /\.\/generated\/jni\/CMakeLists\.txt/,
  );
  assert.match(
    read('packages/core/RNGoogleMobileAds.podspec'),
    /ios\/generated/,
  );
  assert.match(
    read('packages/core/RNGoogleMobileAds.podspec'),
    /PODS_TARGET_SRCROOT.*ios\/generated/,
  );
  assert.ok(core.files.includes('/android/'));
  assert.ok(core.files.includes('/ios/'));
  assert.equal(root.devDependencies['react-native'], '0.86.0');
  assert.equal(root.devDependencies['@react-native/babel-preset'], '0.86.0');
  assert.equal(example.dependencies['react-native'], '0.86.0');
  assert.equal(example.dependencies['@react-native/new-app-screen'], '0.86.0');
  assert.equal(example.devDependencies['@react-native/codegen'], '0.86.0');
  for (const cliPackage of [
    '@react-native-community/cli',
    '@react-native-community/cli-platform-android',
    '@react-native-community/cli-platform-ios',
  ]) {
    assert.equal(example.devDependencies[cliPackage], '20.2.0');
    assert.equal(toolchain.packages[cliPackage].version, '20.2.0');
  }
  assert.equal(core.peerDependencies['react-native'], '>=0.86.0');
  for (const adapter of [
    '_template',
    'applovin',
    'facebook',
    'inmobi',
    'mintegral',
    'moloco',
    'pangle',
    'unity',
    'vungle',
    'yandex',
  ]) {
    assert.equal(
      json(`packages/${adapter}/package.json`).peerDependencies['react-native'],
      '>=0.86.0',
    );
  }
  for (const script of [
    'tests:android:build:windows',
    'tests:android:build-release',
    'tests:android:build-release:windows',
  ]) {
    assert.doesNotMatch(root.scripts[script], /tests:e2e:codegen/);
  }
  assert.ok(
    toolchain.generator.startsWith(
      path.dirname(toolchain.packages['react-native'].packageJson),
    ),
  );
  assert.equal(toolchain.packages['react-native'].version, '0.86.0');
  assert.equal(toolchain.packages['@react-native/codegen'].version, '0.86.0');
  assert.equal(
    path.resolve(EXAMPLE_PACKAGE, 'package.json'),
    path.resolve(repoRoot, 'RNGoogleMobileAdsExample/package.json'),
  );
  assert.ok(
    fs.existsSync(
      path.join(
        OUTPUT_PATHS.android,
        'jni/RNGoogleMobileAdsSpec-generated.cpp',
      ),
    ),
    'Android generated C++ must be present in the published android tree',
  );
  assert.ok(
    fs.existsSync(
      path.join(
        OUTPUT_PATHS.ios,
        'RNGoogleMobileAdsSpec/RNGoogleMobileAdsSpec-generated.mm',
      ),
    ),
    'iOS generated Objective-C++ must be present in the published ios tree',
  );
  assert.match(
    read(
      'packages/core/ios/generated/RNGoogleMobileAdsSpec/RNGoogleMobileAdsSpec.h',
    ),
    /using ResultT = Constants;/,
  );
  for (const source of [
    'RNGoogleMobileAdsAppOpenModule.mm',
    'RNGoogleMobileAdsBannerView.mm',
    'RNGoogleMobileAdsConsentModule.mm',
    'RNGoogleMobileAdsInterstitialModule.mm',
    'RNGoogleMobileAdsMediaView.mm',
    'RNGoogleMobileAdsModule.mm',
    'RNGoogleMobileAdsMultiFormatBannerView.mm',
    'RNGoogleMobileAdsNativeView.mm',
    'RNGoogleMobileAdsPoolModule.mm',
    'RNGoogleMobileAdsRewardedInterstitialModule.mm',
    'RNGoogleMobileAdsRewardedModule.mm',
  ]) {
    const contents = read(`packages/core/ios/RNGoogleMobileAds/${source}`);
    assert.match(contents, /<RNGoogleMobileAdsSpec\//);
    assert.doesNotMatch(
      contents,
      /react\/renderer\/components\/RNGoogleMobileAdsSpec/,
    );
    assert.doesNotMatch(contents, /#import "RNGoogleMobileAdsSpec\.h"/);
  }
}

checkWipeRemovesStaleFiles();
checkVerifyRejectsOmittedTrees();
checkVerifyRejectsUntrackedExtras();
checkVerifyPropagatesDrift();
checkConfigurationContracts();
checkRegenerationIsDeterministic();
console.log('Codegen self-check passed.');
