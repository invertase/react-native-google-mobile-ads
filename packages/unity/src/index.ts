/**
 * Unity Ads GAM mediation adapter package public surface.
 *
 * Exports adapter class-name constants for GAM UI paste / docs only. Does **not**
 * add JS ad APIs — core `initialize()` adapter statuses remain the discovery
 * signal (API design §5.3).
 *
 * Native mediation is linked via Google's published adapter:
 * - Android: `com.google.ads.mediation:unity`
 * - iOS: `GoogleMobileAdsMediationUnity`
 */

export type NativeAdapterClassName = {
  android: string;
  ios: string;
};

/** Network slug for this Character GAM adapter package. */
export const networkSlug = 'unity' as const;

/**
 * Fully-qualified native mediation adapter class names for AdMob / GAM console paste.
 * @see https://developers.google.com/ad-manager/mobile-ads-sdk/android/mediation/unity
 * @see https://developers.google.com/ad-manager/mobile-ads-sdk/ios/mediation/unity
 */
export const nativeAdapterClassName: NativeAdapterClassName = {
  android: 'com.google.ads.mediation.unity.UnityMediationAdapter',
  ios: 'GADMediationAdapterUnity',
};
