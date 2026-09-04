/**
 * A-0 GAM adapter package public surface.
 *
 * Scoped network packages export adapter class-name constants for GAM UI paste /
 * docs only. They do **not** add JS ad APIs — core `initialize()` adapter
 * statuses remain the discovery signal (API design §5.3).
 *
 * When copying this template to `packages/<network>/`, replace every
 * `__PLACEHOLDER__` token (see README).
 */

export type NativeAdapterClassName = {
  android: string;
  ios: string;
};

/** Network slug (`applovin`, `facebook`, …). Replace `__NETWORK__` when instantiating. */
export const networkSlug = '__NETWORK__' as const;

/**
 * Fully-qualified native mediation adapter class names for AdMob / GAM console paste.
 * Replace `__ANDROID_ADAPTER_CLASS__` / `__IOS_ADAPTER_CLASS__` per vendor docs.
 */
export const nativeAdapterClassName: NativeAdapterClassName = {
  android: '__ANDROID_ADAPTER_CLASS__',
  ios: '__IOS_ADAPTER_CLASS__',
};
