import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type IosAppBundleResolution, resolveIosAppBundle } from './hostPreflight.ts';
import { runtimeResources } from './slots.ts';
import { AppiumTestIds } from './testIds.ts';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(srcDir, '../../..');

export const EXAMPLE_ANDROID_PACKAGE = 'com.microsoft.reacttestapp';
export const EXAMPLE_ANDROID_ACTIVITY = 'com.microsoft.reacttestapp.MainActivity';
export const EXAMPLE_IOS_BUNDLE_ID = 'com.microsoft.ReactTestApp';

export function androidDebugApkPath(): string {
  return process.env.RNGMA_ANDROID_APK || runtimeResources('android').androidApkPath;
}

export function defaultIosSimulatorAppPath(): string {
  return path.join(
    repoRoot,
    'RNGoogleMobileAdsExample/ios/build/Build/Products/Debug-iphonesimulator/ReactTestApp.app',
  );
}

export function iosAppBundleResolution(): IosAppBundleResolution {
  const exactPath = process.env.RNGMA_IOS_APP || defaultIosSimulatorAppPath();
  const resolution = resolveIosAppBundle([exactPath]);
  return resolution.kind === 'absent' ? { kind: 'incomplete', path: exactPath } : resolution;
}

export function iosAppPath(): string {
  return process.env.RNGMA_IOS_APP || defaultIosSimulatorAppPath();
}

/** Representative banner size used in smoke (remaining sizes via gallery accordion / manual). */
export const SMOKE_BANNER_VARIANT = AppiumTestIds.bannerVariant('Banner');
export const SMOKE_GAM_BANNER_VARIANT = AppiumTestIds.gamBannerVariant('AnchoredAdaptiveBanner');
export const SMOKE_GAM_FLUID_VARIANT = AppiumTestIds.gamBannerVariant('Fluid');

/**
 * Navigation/container smoke is split across three WDIO sessions because Android
 * UiAutomator2 destabilizes after ~15 tests in a single session. These cases do
 * not claim that an ad loaded.
 */
export type NavigationSmokeCase = {
  id: string;
  title: string;
  containerId: string;
  contract: 'navigation';
  requiresAppRestart?: boolean;
};

export type RepresentativeRequestPath = 'banner' | 'native' | 'fullscreen' | 'gam';

export type RepresentativeRequestOutcomeContract = {
  id: string;
  title: string;
  galleryTitle: string;
  containerId: string;
  contract: 'request-outcome';
  path: RepresentativeRequestPath;
  actionId?: string;
  requiresAppRestart?: boolean;
};

export const NAVIGATION_SMOKE_PRIMARY: NavigationSmokeCase[] = [
  {
    id: SMOKE_BANNER_VARIANT,
    title: 'Banner Banner',
    containerId: SMOKE_BANNER_VARIANT,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.collapsibleBanner,
    title: 'Collapsible Banner',
    containerId: AppiumTestIds.format.collapsibleBanner,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.gamInterstitial,
    title: 'GAM Interstitial',
    containerId: AppiumTestIds.format.gamInterstitial,
    contract: 'navigation',
  },
  {
    id: SMOKE_GAM_BANNER_VARIANT,
    title: 'GAM Banner AnchoredAdaptiveBanner',
    containerId: SMOKE_GAM_BANNER_VARIANT,
    contract: 'navigation',
  },
  {
    id: SMOKE_GAM_FLUID_VARIANT,
    title: 'GAM Banner Fluid',
    containerId: SMOKE_GAM_FLUID_VARIANT,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.appOpen,
    title: 'App Open',
    containerId: AppiumTestIds.format.appOpen,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.interstitial,
    title: 'Interstitial',
    containerId: AppiumTestIds.format.interstitial,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.rewarded,
    title: 'Rewarded',
    containerId: AppiumTestIds.format.rewarded,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.rewardedInterstitial,
    title: 'Rewarded Interstitial',
    containerId: AppiumTestIds.format.rewardedInterstitial,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.native,
    title: 'Native',
    containerId: AppiumTestIds.format.native,
    contract: 'navigation',
  },
];

export const NAVIGATION_SMOKE_SECONDARY: NavigationSmokeCase[] = [
  {
    id: AppiumTestIds.format.adInspector,
    title: 'Ad Inspector',
    containerId: AppiumTestIds.format.adInspector,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.consent,
    title: 'Consent',
    containerId: AppiumTestIds.format.consent,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.appOpenHook,
    title: 'App Open Hook',
    containerId: AppiumTestIds.format.appOpenHook,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.rewardedHook,
    title: 'RWD Hook',
    containerId: AppiumTestIds.format.rewardedHook,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.debugMenu,
    title: 'Debug Menu',
    containerId: AppiumTestIds.format.debugMenu,
    contract: 'navigation',
  },
];

export const NAVIGATION_SMOKE_TERTIARY: NavigationSmokeCase[] = [
  {
    id: AppiumTestIds.format.interstitialHook,
    title: 'INT Hook',
    containerId: AppiumTestIds.format.interstitialHook,
    contract: 'navigation',
  },
  {
    id: AppiumTestIds.format.rewardedInterstitialHook,
    title: 'RWI Hook',
    containerId: AppiumTestIds.format.rewardedInterstitialHook,
    contract: 'navigation',
  },
];

/** Exactly one deterministic Google-test-ID request-outcome contract per representative path. */
export const REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS: readonly RepresentativeRequestOutcomeContract[] =
  [
  {
    id: SMOKE_BANNER_VARIANT,
    title: 'standard Banner auto-load request reaches a terminal outcome',
    galleryTitle: 'Banner Banner',
    containerId: SMOKE_BANNER_VARIANT,
    contract: 'request-outcome',
    path: 'banner',
  },
  {
    id: AppiumTestIds.format.native,
    title: 'Native request reaches a terminal outcome',
    galleryTitle: 'Native',
    containerId: AppiumTestIds.format.native,
    contract: 'request-outcome',
    path: 'native',
  },
  {
    id: AppiumTestIds.format.interstitial,
    title: 'Interstitial request completes without showing',
    galleryTitle: 'Interstitial',
    containerId: AppiumTestIds.format.interstitial,
    contract: 'request-outcome',
    path: 'fullscreen',
    actionId: AppiumTestIds.action.load(AppiumTestIds.format.interstitial),
  },
  {
    id: AppiumTestIds.format.gamInterstitial,
    title: 'GAM Interstitial request completes without showing',
    galleryTitle: 'GAM Interstitial',
    containerId: AppiumTestIds.format.gamInterstitial,
    contract: 'request-outcome',
    path: 'gam',
    actionId: AppiumTestIds.action.load(AppiumTestIds.format.gamInterstitial),
  },
  ] as const;

/** Pattern C probe contract remains distinct from ad-fill assertions. */
export const NATIVE_RNGMA_TESTING_PROBE = {
  id: AppiumTestIds.format.nativeRngmaTesting,
  title: 'NativeRNGMATesting',
  containerId: AppiumTestIds.format.nativeRngmaTesting,
  actionId: AppiumTestIds.action.show(AppiumTestIds.format.nativeRngmaTesting),
  expectedStatusText: 'ok ping=',
  actionAccessibilityLabel: 'Run NativeRNGMATesting probes',
} as const;

/** Gallery home section that contains a format open target (mirrors example App.tsx). */
export type GallerySectionId = keyof typeof AppiumTestIds.section;

const HOOK_FORMAT_IDS = new Set<string>([
  AppiumTestIds.format.appOpenHook,
  AppiumTestIds.format.rewardedHook,
  AppiumTestIds.format.interstitialHook,
  AppiumTestIds.format.rewardedInterstitialHook,
]);

const DEBUG_FORMAT_IDS = new Set<string>([
  AppiumTestIds.format.adInspector,
  AppiumTestIds.format.consent,
  AppiumTestIds.format.debugMenu,
  AppiumTestIds.format.flushCoverage,
  AppiumTestIds.format.nativeRngmaTesting,
]);

/**
 * Section the coverage-flush teardown selects before locating the home Flush button.
 *
 * Flush renders at the bottom of gallery home regardless of section, so a long
 * selection (notably `formats`) can leave it below the scrollable viewport and
 * UiAutomator2 never exposes it. `debug` is the shortest list, so Flush stays
 * reachable no matter which section a suite happened to leave selected.
 */
export const FLUSH_TEARDOWN_SECTION: Exclude<GallerySectionId, 'all'> = 'debug';

export function gallerySectionForFormat(formatId: string): Exclude<GallerySectionId, 'all'> {
  if (HOOK_FORMAT_IDS.has(formatId)) {
    return 'hooks';
  }
  if (DEBUG_FORMAT_IDS.has(formatId)) {
    return 'debug';
  }
  return 'formats';
}
