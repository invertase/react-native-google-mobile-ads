import { ConfigPlugin, withInfoPlist, withPlugins } from '@expo/config-plugins';

type PluginParameters = {
  /**
   * Meta Audience Network SKAdNetwork identifiers to merge into Info.plist.
   * Core's Expo plugin owns app IDs; this adapter only merges mediation network rows.
   * Pass identifiers from Meta's current SKAdNetwork documentation at integrate time.
   */
  skAdNetworkItems?: string[];
};

/** Keys accepted by the facebook adapter Expo config plugin. */
export const KNOWN_PLUGIN_PARAMETER_KEYS = ['skAdNetworkItems'] as const;

const RUNTIME_META_KEYS_HINT =
  'Advertiser tracking and data-processing options are runtime JS APIs on ' +
  '@react-native-google-mobile-ads/facebook (setAdvertiserTrackingEnabled / setDataProcessingOptions), ' +
  'not Expo plugin config. Call them before mobileAds().initialize().';

/**
 * Warn when Expo plugin options include keys this adapter plugin does not apply.
 * Exported for unit tests.
 */
export function warnUnknownPluginParameters(
  params: Record<string, unknown> | undefined,
): void {
  if (params == null || typeof params !== 'object' || Array.isArray(params)) {
    return;
  }

  const known = new Set<string>(KNOWN_PLUGIN_PARAMETER_KEYS);
  const unknownKeys = Object.keys(params).filter(key => !known.has(key));
  if (unknownKeys.length === 0) {
    return;
  }

  const runtimeKeys = unknownKeys.filter(key =>
    /^(meta)?(AdvertiserTrackingEnabled|DataProcessingOptions|AudienceNetworkEnabled)$/i.test(
      key,
    ),
  );
  const otherKeys = unknownKeys.filter(key => !runtimeKeys.includes(key));

  if (runtimeKeys.length > 0) {
    console.warn(
      `[@react-native-google-mobile-ads/facebook] Ignoring Expo plugin option(s): ${runtimeKeys.join(
        ', ',
      )}. ${RUNTIME_META_KEYS_HINT}`,
    );
  }

  if (otherKeys.length > 0) {
    console.warn(
      `[@react-native-google-mobile-ads/facebook] Ignoring unknown Expo plugin option(s): ${otherKeys.join(
        ', ',
      )}. Known keys: ${KNOWN_PLUGIN_PARAMETER_KEYS.join(', ')}.`,
    );
  }
}

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
 * Optional Expo config plugin for `@react-native-google-mobile-ads/facebook`.
 * Does not set GMA app IDs (core plugin). Does not set advertiser tracking
 * (runtime JS — ATT status is not knowable at prebuild time).
 */
const withRNGoogleMobileAdsAdapterFacebook: ConfigPlugin<PluginParameters> = (
  config,
  props = {},
) => {
  warnUnknownPluginParameters(props as Record<string, unknown>);

  const { skAdNetworkItems } = props;
  return withPlugins(config, [[withAdapterSkAdNetworkItems, skAdNetworkItems]]);
};

export default withRNGoogleMobileAdsAdapterFacebook;
