/**
 * Meta Audience Network (Facebook) GAM mediation adapter package public surface.
 *
 * Exports adapter class-name constants for GAM UI paste / docs only. Does **not**
 * add JS ad APIs — core `initialize()` adapter statuses remain the discovery
 * signal (API design §5.3).
 *
 * Native mediation is linked via Google's published adapter:
 * - Android: `com.google.ads.mediation:facebook`
 * - iOS: `GoogleMobileAdsMediationFacebook`
 */

export type NativeAdapterClassName = {
  android: string;
  ios: string;
};

/** Network slug for this Character GAM adapter package. */
export const networkSlug = 'facebook' as const;

/**
 * Fully-qualified native mediation adapter class names for AdMob / GAM console paste.
 * @see https://developers.google.com/admob/android/mediation/meta
 * @see https://developers.google.com/admob/ios/mediation/meta
 */
export const nativeAdapterClassName: NativeAdapterClassName = {
  android: 'com.google.ads.mediation.facebook.FacebookMediationAdapter',
  ios: 'GADMediationAdapterFacebook',
};
