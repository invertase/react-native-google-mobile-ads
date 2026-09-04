/**
 * Moloco GAM mediation adapter package public surface.
 *
 * Exports adapter class-name constants for GAM UI paste / docs only. Does **not**
 * add JS ad APIs — core `initialize()` adapter statuses remain the discovery
 * signal (API design §5.3).
 *
 * Native mediation is linked via Google's published adapter:
 * - Android: `com.google.ads.mediation:moloco`
 * - iOS: `GoogleMobileAdsMediationMoloco`
 */

export type NativeAdapterClassName = {
  android: string;
  ios: string;
};

/** Network slug for this Character GAM adapter package. */
export const networkSlug = 'moloco' as const;

/**
 * Fully-qualified native mediation adapter class names for AdMob / GAM console paste.
 * @see https://developers.google.com/ad-manager/mobile-ads-sdk/android/mediation/moloco
 * @see https://developers.google.com/ad-manager/mobile-ads-sdk/ios/mediation/moloco
 */
export const nativeAdapterClassName: NativeAdapterClassName = {
  android: 'com.google.ads.mediation.moloco.MolocoMediationAdapter',
  ios: 'GADMediationAdapterMoloco',
};
