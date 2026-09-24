import { NativeModules, Platform } from 'react-native';

/**
 * Meta Audience Network (Facebook) GAM mediation adapter package public surface.
 *
 * Exports adapter class-name constants for GAM UI paste / docs, plus Meta SDK
 * privacy hooks that must run before core `mobileAds().initialize()`:
 * - iOS: `FBAdSettings.setAdvertiserTrackingEnabled`
 * - Android: `AdSettings.setDataProcessingOptions` (no advertiser-tracking API on
 *   audience-network-sdk 6.22.0 — verified from the local AAR)
 *
 * Native mediation is linked via Google's published adapter:
 * - Android: `com.google.ads.mediation:facebook`
 * - iOS: `GoogleMobileAdsMediationFacebook`
 */

export type NativeAdapterClassName = {
  android: string;
  ios: string;
};

/** Network slug for this GAM adapter package. */
export const networkSlug = 'facebook' as const;

/**
 * Fully-qualified native mediation adapter class names for AdMob / GAM console paste.
 */
export const nativeAdapterClassName: NativeAdapterClassName = {
  android: 'com.google.ads.mediation.facebook.FacebookMediationAdapter',
  ios: 'GADMediationAdapterFacebook',
};

type NativeFacebookAdapterModule = {
  setAdvertiserTrackingEnabled(enabled: boolean): void;
  setDataProcessingOptions(options: string[]): void;
  setDataProcessingOptionsWithLocation(options: string[], country: number, state: number): void;
};

const LINKING_ERROR =
  `RNGoogleMobileAdsAdapterFacebook native module is not linked. ` +
  `Rebuild the app after installing @react-native-google-mobile-ads/facebook` +
  (Platform.OS === 'ios' ? ` (pod install).` : `.`);

const NativeFacebookAdapter: NativeFacebookAdapterModule =
  (NativeModules.RNGoogleMobileAdsAdapterFacebook as NativeFacebookAdapterModule | undefined) ??
  new Proxy({} as NativeFacebookAdapterModule, {
    get() {
      throw new Error(LINKING_ERROR);
    },
  });

/**
 * Set Meta Audience Network advertiser tracking (iOS ATT flag) before GMA initialize.
 *
 * On iOS this calls `FBAdSettings.setAdvertiserTrackingEnabled`. On **iOS 17+** with
 * Audience Network **6.15.0+**, Meta’s `FBAdSettings.h` marks that setter deprecated and
 * unused — the SDK reads `ATTrackingManager.trackingAuthorizationStatus` instead. On Android
 * this is a documented no-op — Meta's Android `AdSettings` has no advertiser-tracking setter
 * (audience-network-sdk 6.22.0).
 *
 * Call after resolving App Tracking Transparency (when applicable on older iOS) and **before**
 * `mobileAds().initialize()`. This JS hook cannot prevent Meta `FBAudienceNetwork` process-start
 * aborts that run before the bridge is up.
 */
export function setAdvertiserTrackingEnabled(enabled: boolean): void {
  if (typeof enabled !== 'boolean') {
    throw new Error(
      "setAdvertiserTrackingEnabled(*) 'enabled' expected a boolean value.",
    );
  }
  NativeFacebookAdapter.setAdvertiserTrackingEnabled(enabled);
}

/**
 * Set Meta Audience Network data-processing options (e.g. Limited Data Use).
 *
 * On Android this calls `AdSettings.setDataProcessingOptions`. On iOS this calls
 * `FBAdSettings.setDataProcessingOptions` when the Audience Network SDK is linked.
 *
 * Prefer calling before `mobileAds().initialize()`.
 */
export function setDataProcessingOptions(
  options: string[],
  country?: number,
  state?: number,
): void {
  if (!Array.isArray(options) || options.some(item => typeof item !== 'string')) {
    throw new Error(
      "setDataProcessingOptions(*) 'options' expected an array of strings.",
    );
  }

  const hasCountry = country !== undefined;
  const hasState = state !== undefined;
  if (hasCountry !== hasState) {
    throw new Error(
      "setDataProcessingOptions(*) 'country' and 'state' must both be provided or both omitted.",
    );
  }

  if (hasCountry && hasState) {
    if (typeof country !== 'number' || typeof state !== 'number') {
      throw new Error(
        "setDataProcessingOptions(*) 'country' and 'state' expected number values.",
      );
    }
    NativeFacebookAdapter.setDataProcessingOptionsWithLocation(options, country, state);
    return;
  }

  NativeFacebookAdapter.setDataProcessingOptions(options);
}
