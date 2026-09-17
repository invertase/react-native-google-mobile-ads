'use strict';

/**
 * semantic-release prepare plugin: refresh example Podfile.lock after
 * @semantic-release/npm prepares the public packages and the version-sync plugin
 * aligns their manifests, before @semantic-release/git commits release assets.
 */

const { refreshIosPodLockfile } = require('./refresh-ios-pod-lockfile');

async function prepare(_pluginConfig, context) {
  const logger = (context && context.logger) || console;
  logger.log('Refreshing RNGoogleMobileAdsExample/ios/Podfile.lock for release commit');
  refreshIosPodLockfile({ requireDarwin: true });
}

module.exports = { prepare };
