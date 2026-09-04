import { ConfigPlugin, withInfoPlist, withPlugins } from '@expo/config-plugins';

type PluginParameters = {
  /**
   * Network-specific SKAdNetwork identifiers to merge into Info.plist.
   * Core's Expo plugin owns app IDs; adapters only add mediation network rows.
   */
  skAdNetworkItems?: string[];
};

const withAdapterSkAdNetworkItems: ConfigPlugin<PluginParameters['skAdNetworkItems']> = (
  config,
  skAdNetworkItems,
) => {
  if (skAdNetworkItems === undefined || skAdNetworkItems.length === 0) {
    return config;
  }

  return withInfoPlist(config, config => {
    config.modResults.SKAdNetworkItems = config.modResults.SKAdNetworkItems ?? [];

    const existingIdentifiers = config.modResults.SKAdNetworkItems.map(
      (item: { SKAdNetworkIdentifier: string }) => item.SKAdNetworkIdentifier,
    );

    const missingIdentifiers = skAdNetworkItems.filter(
      identifier => !existingIdentifiers.includes(identifier),
    );

    config.modResults.SKAdNetworkItems.push(
      ...missingIdentifiers.map(identifier => ({
        SKAdNetworkIdentifier: identifier,
      })),
    );

    return config;
  });
};

/**
 * Optional Expo config plugin for a GAM adapter package.
 * Does not set GMA app IDs (core plugin). Replace export name when instantiating.
 */
const withRNGoogleMobileAdsAdapterTemplate: ConfigPlugin<PluginParameters> = (
  config,
  { skAdNetworkItems } = {},
) => {
  return withPlugins(config, [[withAdapterSkAdNetworkItems, skAdNetworkItems]]);
};

export default withRNGoogleMobileAdsAdapterTemplate;
