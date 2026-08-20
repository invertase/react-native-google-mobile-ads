import {
  AndroidConfig,
  ConfigPlugin,
  withAndroidManifest,
  withGradleProperties,
  withPlugins,
  withInfoPlist,
} from '@expo/config-plugins';

type PluginParameters = {
  androidAppId?: string;
  iosAppId?: string;
  delayAppMeasurementInit?: boolean;
  optimizeInitialization?: boolean;
  optimizeAdLoading?: boolean;
  skAdNetworkItems?: string[];
  userTrackingUsageDescription?: string;
  /**
   * Which Android Google Mobile Ads SDK to build against: the default `'legacy'`
   * (`com.google.android.gms:play-services-ads`) or `'next-gen'` (`ads-mobile-sdk`).
   * `'next-gen'` does not support Google Ad Manager ad unit IDs. Android only.
   */
  googleMobileAdsSdk?: 'legacy' | 'next-gen';
};

function addReplacingMainApplicationMetaDataItem(
  manifest: AndroidConfig.Manifest.AndroidManifest,
  itemName: string,
  itemValue: string,
): AndroidConfig.Manifest.AndroidManifest {
  AndroidConfig.Manifest.ensureToolsAvailable(manifest);

  const newItem = {
    $: {
      'android:name': itemName,
      'android:value': itemValue,
      'tools:replace': 'android:value',
    },
  } as AndroidConfig.Manifest.ManifestMetaData;

  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  mainApplication['meta-data'] = mainApplication['meta-data'] ?? [];

  const existingItem = mainApplication['meta-data'].find(
    item => item.$['android:name'] === itemName,
  );

  if (existingItem) {
    existingItem.$['android:value'] = itemValue;
    existingItem.$['tools:replace' as keyof AndroidConfig.Manifest.ManifestMetaData['$']] =
      'android:value';
  } else {
    mainApplication['meta-data'].push(newItem);
  }

  return manifest;
}

const withAndroidAppId: ConfigPlugin<PluginParameters['androidAppId']> = (config, androidAppId) => {
  if (androidAppId === undefined) return config;

  return withAndroidManifest(config, config => {
    addReplacingMainApplicationMetaDataItem(
      config.modResults,
      'com.google.android.gms.ads.APPLICATION_ID',
      androidAppId,
    );

    return config;
  });
};

const withAndroidAppMeasurementInitDelayed: ConfigPlugin<
  PluginParameters['delayAppMeasurementInit']
> = (config, delayAppMeasurementInit) => {
  if (delayAppMeasurementInit === undefined) return config;

  return withAndroidManifest(config, config => {
    addReplacingMainApplicationMetaDataItem(
      config.modResults,
      'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT',
      delayAppMeasurementInit.toString(),
    );

    return config;
  });
};

const withAndroidInitializationOptimized: ConfigPlugin<
  PluginParameters['optimizeInitialization']
> = (config, optimizeInitialization = true) => {
  return withAndroidManifest(config, config => {
    addReplacingMainApplicationMetaDataItem(
      config.modResults,
      'com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION',
      optimizeInitialization.toString(),
    );

    return config;
  });
};

const withAndroidAdLoadingOptimized: ConfigPlugin<PluginParameters['optimizeAdLoading']> = (
  config,
  optimizeAdLoading = true,
) => {
  return withAndroidManifest(config, config => {
    addReplacingMainApplicationMetaDataItem(
      config.modResults,
      'com.google.android.gms.ads.flag.OPTIMIZE_AD_LOADING',
      optimizeAdLoading.toString(),
    );

    return config;
  });
};

const withAndroidGoogleMobileAdsSdk: ConfigPlugin<PluginParameters['googleMobileAdsSdk']> = (
  config,
  googleMobileAdsSdk,
) => {
  if (googleMobileAdsSdk === undefined) return config;

  return withGradleProperties(config, config => {
    const existingItem = config.modResults.find(
      item => item.type === 'property' && item.key === 'googleMobileAdsSdk',
    );

    if (existingItem && existingItem.type === 'property') {
      existingItem.value = googleMobileAdsSdk;
    } else {
      config.modResults.push({
        type: 'property',
        key: 'googleMobileAdsSdk',
        value: googleMobileAdsSdk,
      });
    }

    return config;
  });
};

const withIosAppId: ConfigPlugin<PluginParameters['iosAppId']> = (config, iosAppId) => {
  if (iosAppId === undefined) return config;

  return withInfoPlist(config, config => {
    config.modResults.GADApplicationIdentifier = iosAppId;
    return config;
  });
};

const withIosAppMeasurementInitDelayed: ConfigPlugin<
  PluginParameters['delayAppMeasurementInit']
> = (config, delayAppMeasurementInit = false) => {
  return withInfoPlist(config, config => {
    config.modResults.GADDelayAppMeasurementInit = delayAppMeasurementInit;
    return config;
  });
};

const withIosSkAdNetworkItems: ConfigPlugin<PluginParameters['skAdNetworkItems']> = (
  config,
  skAdNetworkItems,
) => {
  if (skAdNetworkItems === undefined) return config;

  return withInfoPlist(config, config => {
    config.modResults.SKAdNetworkItems = config.modResults.SKAdNetworkItems ?? [];

    const existingIdentifiers = config.modResults.SKAdNetworkItems.map(
      (item: { SKAdNetworkIdentifier: string }) => item.SKAdNetworkIdentifier,
    );

    const missingIdentifiers = skAdNetworkItems.filter(
      skAdNetworkItem => !existingIdentifiers.includes(skAdNetworkItem),
    );

    config.modResults.SKAdNetworkItems.push(
      ...missingIdentifiers.map(identifier => ({
        SKAdNetworkIdentifier: identifier,
      })),
    );

    return config;
  });
};

const withIosUserTrackingUsageDescription: ConfigPlugin<
  PluginParameters['userTrackingUsageDescription']
> = (config, userTrackingUsageDescription) => {
  if (userTrackingUsageDescription === undefined) return config;

  return withInfoPlist(config, config => {
    config.modResults.NSUserTrackingUsageDescription = userTrackingUsageDescription;
    return config;
  });
};

const withReactNativeGoogleMobileAds: ConfigPlugin<PluginParameters> = (
  config,
  {
    androidAppId,
    delayAppMeasurementInit,
    optimizeInitialization,
    optimizeAdLoading,
    iosAppId,
    skAdNetworkItems,
    userTrackingUsageDescription,
    googleMobileAdsSdk,
  } = {},
) => {
  if (androidAppId === undefined) {
    console.warn(
      "No 'androidAppId' was provided. The native Google Mobile Ads SDK will crash on Android without it.",
    );
  }

  if (iosAppId === undefined) {
    console.warn(
      "No 'iosAppId' was provided. The native Google Mobile Ads SDK will crash on iOS without it.",
    );
  }

  return withPlugins(config, [
    // Android
    [withAndroidAppId, androidAppId],
    [withAndroidAppMeasurementInitDelayed, delayAppMeasurementInit],
    [withAndroidInitializationOptimized, optimizeInitialization],
    [withAndroidAdLoadingOptimized, optimizeAdLoading],
    [withAndroidGoogleMobileAdsSdk, googleMobileAdsSdk],
    // iOS
    [withIosAppId, iosAppId],
    [withIosAppMeasurementInitDelayed, delayAppMeasurementInit],
    [withIosSkAdNetworkItems, skAdNetworkItems],
    [withIosUserTrackingUsageDescription, userTrackingUsageDescription],
  ]);
};

export default withReactNativeGoogleMobileAds;
