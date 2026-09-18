const { execFileSync } = require('node:child_process');
const { statSync } = require('node:fs');
const { resolve } = require('node:path');

const repositoryRoot = resolve(__dirname, '..');
const appPath = resolve(
  repositoryRoot,
  'RNGoogleMobileAdsExample/ios/build/Build/Products/Debug-iphonesimulator/ReactTestApp.app',
);

function parseUdid(args) {
  const udidIndex = args.indexOf('--udid');
  const udid = udidIndex >= 0 ? args[udidIndex + 1] : undefined;

  if (!udid || udidIndex !== args.length - 2) {
    throw new Error('Usage: yarn tests:ios:run --udid <simulator-udid>');
  }

  return udid;
}

function run(args = process.argv.slice(2)) {
  const udid = parseUdid(args);
  const executablePath = resolve(appPath, 'ReactTestApp');

  if (!statSync(executablePath).isFile()) {
    throw new Error(`iOS app executable is not a regular file: ${executablePath}`);
  }

  const bundleIdentifier = execFileSync(
    '/usr/libexec/PlistBuddy',
    ['-c', 'Print:CFBundleIdentifier', resolve(appPath, 'Info.plist')],
    { encoding: 'utf8' },
  ).trim();

  execFileSync('xcrun', ['simctl', 'install', udid, appPath], {
    stdio: 'inherit',
  });
  execFileSync('xcrun', ['simctl', 'launch', udid, bundleIdentifier], {
    stdio: 'inherit',
  });
}

module.exports = { appPath, parseUdid, run };

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
