/**
 * Yandex GAM / AdMob mediation adapter package public surface.
 *
 * Exports adapter class-name constants for AdMob / GAM UI paste / docs only.
 * Does **not** add JS ad APIs — core `initialize()` adapter statuses remain the
 * discovery signal (API design §5.3).
 *
 * **iOS-only:** Google does not publish `GoogleMobileAdsMediationYandex` /
 * `com.google.ads.mediation:yandex`. Character’s GAM adapter inventory is
 * iOS-focused. This package links Yandex’s published AdMob custom-event pod
 * `YandexMobileAdsAdMobAdapters` (not Yandex-as-host / `GoogleYandexMobileAdsAdapters`).
 *
 * @see https://ads.yandex.com/helpcenter/en/dev/ios/admob-third
 * @see https://cocoapods.org/pods/YandexMobileAdsAdMobAdapters
 */

/** Per-format iOS custom-event class names for AdMob / GAM console paste. */
export type YandexIosCustomEventClassNames = {
  banner: string;
  interstitial: string;
  rewarded: string;
  native: string;
};

/**
 * Native adapter class names for this package.
 * `android` is `null` — no Android mediation artifact is linked (see README).
 */
export type NativeAdapterClassName = {
  android: null;
  ios: YandexIosCustomEventClassNames;
};

/** Network slug for this Character GAM adapter package. */
export const networkSlug = 'yandex' as const;

/**
 * Fully-qualified native mediation adapter class names for AdMob / GAM console.
 * Yandex integrates as **custom events** (not a single `GADMediationAdapter*` class).
 *
 * @see https://ads.yandex.com/helpcenter/en/dev/ios/admob-third
 */
export const nativeAdapterClassName: NativeAdapterClassName = {
  android: null,
  ios: {
    banner: 'YMAAdMobCustomEventBanner',
    interstitial: 'YMAAdMobCustomEventInterstitial',
    rewarded: 'YMAAdMobCustomEventRewarded',
    native: 'YMAAdMobCustomEventNative',
  },
};
