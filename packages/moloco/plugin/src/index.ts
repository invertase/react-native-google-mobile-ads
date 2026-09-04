import { ConfigPlugin, withInfoPlist, withPlugins } from '@expo/config-plugins';

type PluginParameters = {
  /**
   * Moloco SKAdNetwork identifiers to merge into Info.plist.
   * Core's Expo plugin owns app IDs; this adapter only merges mediation network rows.
   * Pass identifiers from Moloco's current SKAdNetwork documentation at integrate time.
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
 * Optional Expo config plugin for `@react-native-google-mobile-ads/moloco`.
 * Does not set GMA app IDs (core plugin).
 */
const withRNGoogleMobileAdsAdapterMoloco: ConfigPlugin<PluginParameters> = (
  config,
  { skAdNetworkItems } = {},
) => {
  return withPlugins(config, [[withAdapterSkAdNetworkItems, skAdNetworkItems]]);
};

export default withRNGoogleMobileAdsAdapterMoloco;
