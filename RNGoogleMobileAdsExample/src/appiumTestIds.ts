/**
 * Stable testID / accessibility IDs for Appium (and Jet gallery containers).
 * Keep string values in sync with tooling/appium/src/testIds.ts.
 *
 * Banner / GAM banner containers use `bannerVariant` / `gamBannerVariant` (size-specific).
 * `format.banner` / `format.gamBanner` are family prefixes for docs and helpers, not mounted IDs.
 */
export const AppiumTestIds = {
  root: 'gma.app.root',
  jetRunner: 'gma.jet.runner',
  format: {
    banner: 'gma.format.banner',
    collapsibleBanner: 'gma.format.collapsible-banner',
    interstitial: 'gma.format.interstitial',
    rewarded: 'gma.format.rewarded',
    rewardedInterstitial: 'gma.format.rewarded-interstitial',
    appOpen: 'gma.format.app-open',
    native: 'gma.format.native',
    gamBanner: 'gma.format.gam-banner',
    gamInterstitial: 'gma.format.gam-interstitial',
    interstitialHook: 'gma.format.interstitial-hook',
    rewardedHook: 'gma.format.rewarded-hook',
    rewardedInterstitialHook: 'gma.format.rewarded-interstitial-hook',
    appOpenHook: 'gma.format.app-open-hook',
    consent: 'gma.format.consent',
    adInspector: 'gma.format.ad-inspector',
    debugMenu: 'gma.format.debug-menu',
  },
  action: {
    load: (formatId: string) => `${formatId}.load`,
    show: (formatId: string) => `${formatId}.show`,
    reload: (formatId: string) => `${formatId}.reload`,
    loaded: (formatId: string) => `${formatId}.loaded`,
    recordImpression: (formatId: string) => `${formatId}.record-impression`,
  },
  bannerVariant: (jetPath: string) => `gma.format.banner.${jetPath}`,
  gamBannerVariant: (sizesKey: string) => `gma.format.gam-banner.${sizesKey}`,
} as const;
