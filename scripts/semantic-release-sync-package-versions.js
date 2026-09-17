'use strict';

/**
 * semantic-release prepare plugin: keep every public package and Lerna's fixed
 * version aligned after the per-package @semantic-release/npm prepare steps, and
 * assert that `lerna publish from-package` stays the only npm upload path.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_PACKAGE_DIRS = [
  'packages/core',
  'packages/applovin',
  'packages/facebook',
  'packages/inmobi',
  'packages/mintegral',
  'packages/moloco',
  'packages/pangle',
  'packages/unity',
  'packages/vungle',
  'packages/yandex',
];
const TEMPLATE_PACKAGE = 'packages/_template/package.json';
const PUBLISH_WORKFLOW = '.github/workflows/publish.yml';
const LERNA_PUBLISH_COMMAND = 'yarn lerna publish from-package --yes --loglevel trace';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertPublishSurface() {
  for (const packageDir of PUBLIC_PACKAGE_DIRS) {
    const manifest = readJson(`${packageDir}/package.json`);
    if (manifest.private === true || manifest.publishConfig?.access !== 'public') {
      throw new Error(`${manifest.name} must be a public npm package`);
    }
  }

  const template = readJson(TEMPLATE_PACKAGE);
  if (template.private !== true) {
    throw new Error(`${template.name} must remain private`);
  }
}

function assertReleaseConfig(releaseConfig = readJson('.releaserc')) {
  const npmPlugins = releaseConfig.plugins.filter(
    plugin => Array.isArray(plugin) && plugin[0] === '@semantic-release/npm',
  );
  const npmPackageDirs = npmPlugins.map(plugin => plugin[1].pkgRoot);
  if (JSON.stringify(npmPackageDirs) !== JSON.stringify(PUBLIC_PACKAGE_DIRS)) {
    throw new Error(
      `@semantic-release/npm roots do not match the public package list: ${npmPackageDirs.join(
        ', ',
      )}`,
    );
  }
  for (const plugin of npmPlugins) {
    if (plugin[1].npmPublish !== false) {
      throw new Error(`${plugin[1].pkgRoot} must set @semantic-release/npm npmPublish to false`);
    }
  }

  const gitPlugin = releaseConfig.plugins.find(
    plugin => Array.isArray(plugin) && plugin[0] === '@semantic-release/git',
  );
  const gitAssets = new Set(gitPlugin?.[1]?.assets || []);
  for (const packageDir of PUBLIC_PACKAGE_DIRS) {
    const manifestPath = `${packageDir}/package.json`;
    if (!gitAssets.has(manifestPath)) {
      throw new Error(`${manifestPath} is missing from @semantic-release/git assets`);
    }
  }
  if (!gitAssets.has('lerna.json')) {
    throw new Error('lerna.json is missing from @semantic-release/git assets');
  }
}

function assertPublishWorkflow(
  workflow = fs.readFileSync(path.join(ROOT, PUBLISH_WORKFLOW), 'utf8'),
) {
  if (!workflow.includes('id-token: write')) {
    throw new Error('publish.yml must keep id-token: write for npm OIDC Trusted Publish');
  }
  if (!workflow.includes('registry-url:')) {
    throw new Error('publish.yml must set setup-node registry-url for npm');
  }
  if (!workflow.includes(LERNA_PUBLISH_COMMAND)) {
    throw new Error(`publish.yml must run ${LERNA_PUBLISH_COMMAND}`);
  }
  // success() keeps rerun-heals (a no-op semantic-release exits 0) while a failed
  // prepare cannot reach npm with bumped manifests and no tag.
  if (!workflow.includes('if: success()')) {
    throw new Error(`publish.yml must guard ${LERNA_PUBLISH_COMMAND} with if: success()`);
  }
  if (workflow.includes('if: always()')) {
    throw new Error('publish.yml must not run the npm upload step with if: always()');
  }
}

function assertReleaseInvariants({ releaseConfig, workflow } = {}) {
  assertPublishSurface();
  assertReleaseConfig(releaseConfig);
  assertPublishWorkflow(workflow);
}

function syncVersions(version) {
  assertReleaseInvariants();

  for (const packageDir of PUBLIC_PACKAGE_DIRS) {
    const manifestPath = `${packageDir}/package.json`;
    const manifest = readJson(manifestPath);
    manifest.version = version;
    writeJson(manifestPath, manifest);
  }

  const lerna = readJson('lerna.json');
  lerna.version = version;
  writeJson('lerna.json', lerna);
}

async function prepare(_pluginConfig, context) {
  const version = context?.nextRelease?.version;
  if (!version) {
    throw new Error('semantic-release did not provide nextRelease.version');
  }

  syncVersions(version);
  (context.logger || console).log(
    `Synchronized ${PUBLIC_PACKAGE_DIRS.length} public packages and lerna.json to ${version}`,
  );
}

function selfCheck() {
  assertReleaseInvariants();

  const versions = new Set(
    PUBLIC_PACKAGE_DIRS.map(packageDir => readJson(`${packageDir}/package.json`).version),
  );
  versions.add(readJson('lerna.json').version);
  if (versions.size !== 1) {
    throw new Error(`Package versions are not aligned: ${Array.from(versions).join(', ')}`);
  }

  console.log(
    `semantic-release package surface OK (${PUBLIC_PACKAGE_DIRS.length} public, template private)`,
  );
}

if (require.main === module) {
  if (process.argv[2] !== '--self-check') {
    throw new Error('Usage: node ./scripts/semantic-release-sync-package-versions.js --self-check');
  }
  selfCheck();
}

module.exports = {
  LERNA_PUBLISH_COMMAND,
  PUBLIC_PACKAGE_DIRS,
  assertPublishSurface,
  assertPublishWorkflow,
  assertReleaseConfig,
  assertReleaseInvariants,
  prepare,
  selfCheck,
  syncVersions,
};
