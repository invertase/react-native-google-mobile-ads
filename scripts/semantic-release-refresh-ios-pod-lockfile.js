'use strict';

/**
 * semantic-release prepare plugin: refresh example Podfile.lock after
 * @semantic-release/npm bumps packages/core/package.json, before
 * @semantic-release/git commits release assets.
 */

const { refreshIosPodLockfile } = require('./refresh-ios-pod-lockfile');

async function prepare(_pluginConfig, context) {
  const logger = (context && context.logger) || console;
  logger.log('Refreshing RNGoogleMobileAdsExample/ios/Podfile.lock for release commit');
  refreshIosPodLockfile({ requireDarwin: true });
}

module.exports = { prepare };
