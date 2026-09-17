'use strict';

const {
  LERNA_PUBLISH_COMMAND,
  PUBLIC_PACKAGE_DIRS,
  assertPublishSurface,
  assertPublishWorkflow,
  assertReleaseConfig,
  assertReleaseInvariants,
  prepare,
  selfCheck,
} = require('../../../scripts/semantic-release-sync-package-versions');

const npmPlugin = pkgRoot => ['@semantic-release/npm', { pkgRoot, npmPublish: false }];

const releaseConfig = (overrides = {}) => ({
  plugins: [
    ...PUBLIC_PACKAGE_DIRS.map(npmPlugin),
    [
      '@semantic-release/git',
      {
        assets: [
          ...PUBLIC_PACKAGE_DIRS.map(packageDir => `${packageDir}/package.json`),
          'lerna.json',
        ],
      },
    ],
  ],
  ...overrides,
});

const workflow = `
    permissions:
      id-token: write
      - uses: actions/setup-node@v6
        with:
          registry-url: 'https://registry.npmjs.org'
      - name: Publish Missing Packages
        if: success()
        run: ${LERNA_PUBLISH_COMMAND}
`;

describe('semantic-release-sync-package-versions', () => {
  it('accepts the repository publish surface, release config, and workflow', () => {
    expect(() => assertPublishSurface()).not.toThrow();
    expect(() => assertReleaseConfig()).not.toThrow();
    expect(() => assertPublishWorkflow()).not.toThrow();
    expect(() => assertReleaseInvariants()).not.toThrow();
    expect(() => selfCheck()).not.toThrow();
  });

  it('release-time invariants reject a config or workflow that could double-publish', () => {
    const uploading = releaseConfig();
    uploading.plugins[0] = ['@semantic-release/npm', { pkgRoot: PUBLIC_PACKAGE_DIRS[0] }];

    expect(() => assertReleaseInvariants({ releaseConfig: uploading })).toThrow(/npmPublish/);
    expect(() =>
      assertReleaseInvariants({ workflow: workflow.replace(LERNA_PUBLISH_COMMAND, '') }),
    ).toThrow(/lerna publish from-package/);
  });

  it('prepare requires nextRelease.version', async () => {
    await expect(prepare({}, {})).rejects.toThrow(/nextRelease.version/);
  });

  it('rejects an @semantic-release/npm root that still uploads to npm', () => {
    const config = releaseConfig();
    config.plugins[0] = ['@semantic-release/npm', { pkgRoot: PUBLIC_PACKAGE_DIRS[0] }];

    expect(() => assertReleaseConfig(config)).toThrow(/npmPublish/);
  });

  it('rejects npm roots that drift from the public package list', () => {
    const config = releaseConfig();
    config.plugins.splice(1, 1);

    expect(() => assertReleaseConfig(config)).toThrow(/do not match the public package list/);
  });

  it('rejects release commit assets missing a manifest or lerna.json', () => {
    const withoutManifest = releaseConfig();
    withoutManifest.plugins[PUBLIC_PACKAGE_DIRS.length][1].assets = ['lerna.json'];
    expect(() => assertReleaseConfig(withoutManifest)).toThrow(/package.json is missing/);

    const withoutLerna = releaseConfig();
    withoutLerna.plugins[PUBLIC_PACKAGE_DIRS.length][1].assets = PUBLIC_PACKAGE_DIRS.map(
      packageDir => `${packageDir}/package.json`,
    );
    expect(() => assertReleaseConfig(withoutLerna)).toThrow(/lerna.json is missing/);
  });

  it('requires OIDC, registry-url, and the convergent Lerna upload step', () => {
    expect(() => assertPublishWorkflow(workflow)).not.toThrow();

    expect(() => assertPublishWorkflow(workflow.replace('id-token: write', ''))).toThrow(
      /id-token: write/,
    );
    expect(() => assertPublishWorkflow(workflow.replace('registry-url:', ''))).toThrow(
      /registry-url/,
    );
    expect(() => assertPublishWorkflow(workflow.replace(LERNA_PUBLISH_COMMAND, ''))).toThrow(
      /lerna publish from-package/,
    );
  });

  it('requires the npm upload step to be guarded by success(), not always()', () => {
    expect(() => assertPublishWorkflow(workflow.replace('if: success()', ''))).toThrow(
      /if: success\(\)/,
    );
    expect(() => assertPublishWorkflow(workflow.replace('if: success()', 'if: always()'))).toThrow(
      /if: success\(\)/,
    );
    expect(() =>
      assertPublishWorkflow(`${workflow}\n      - name: Extra\n        if: always()\n`),
    ).toThrow(/must not run the npm upload step with if: always\(\)/);
  });
});
