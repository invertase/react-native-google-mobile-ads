import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppiumTestIds } from './testIds.ts';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(srcDir, '../../..');

export const EXAMPLE_ANDROID_PACKAGE = 'com.microsoft.reacttestapp';
export const EXAMPLE_ANDROID_ACTIVITY = 'com.microsoft.reacttestapp.MainActivity';
export const EXAMPLE_IOS_BUNDLE_ID = 'com.microsoft.ReactTestApp';

export function androidDebugApkPath(): string {
  return (
    process.env.RNGMA_ANDROID_APK ||
    path.join(
      repoRoot,
      'RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/app-debug.apk',
    )
  );
}

export function defaultIosSimulatorAppPath(): string {
  return path.join(
    repoRoot,
    'RNGoogleMobileAdsExample/ios/build/Build/Products/Debug-iphonesimulator/ReactTestApp.app',
  );
}

function derivedDataIosAppPath(): string | undefined {
  const derivedRoot = path.join(os.homedir(), 'Library/Developer/Xcode/DerivedData');
  if (!fs.existsSync(derivedRoot)) {
    return undefined;
  }
  const prefix = 'RNGoogleMobileAdsExample-';
  for (const entry of fs.readdirSync(derivedRoot)) {
    if (!entry.startsWith(prefix)) {
      continue;
    }
    const candidate = path.join(
      derivedRoot,
      entry,
      'Build/Products/Debug-iphonesimulator/ReactTestApp.app',
    );
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function iosAppPath(): string | undefined {
  if (process.env.RNGMA_IOS_APP) {
    return process.env.RNGMA_IOS_APP;
  }
  for (const candidate of [defaultIosSimulatorAppPath(), derivedDataIosAppPath()]) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/** Representative banner size used in smoke (remaining sizes via gallery accordion / manual). */
export const SMOKE_BANNER_VARIANT = AppiumTestIds.bannerVariant('Banner');
export const SMOKE_GAM_BANNER_VARIANT = AppiumTestIds.gamBannerVariant('AnchoredAdaptiveBanner');
export const SMOKE_GAM_FLUID_VARIANT = AppiumTestIds.gamBannerVariant('Fluid');

/**
 * Formats exercised by Appium smoke (split across three WDIO sessions — Android
 * UiAutomator2 destabilizes after ~15 tests in a single session).
 */
export const SMOKE_FORMATS_PRIMARY: Array<{
  id: string;
  title: string;
  containerId: string;
  actionId?: string;
}> = [
  {
    id: SMOKE_BANNER_VARIANT,
    title: 'Banner Banner',
    containerId: SMOKE_BANNER_VARIANT,
  },
  {
    id: AppiumTestIds.format.collapsibleBanner,
    title: 'Collapsible Banner',
    containerId: AppiumTestIds.format.collapsibleBanner,
  },
  {
    id: AppiumTestIds.format.gamInterstitial,
    title: 'GAM Interstitial',
    containerId: AppiumTestIds.format.gamInterstitial,
  },
  {
    id: SMOKE_GAM_BANNER_VARIANT,
    title: 'GAM Banner AnchoredAdaptiveBanner',
    containerId: SMOKE_GAM_BANNER_VARIANT,
  },
  {
    id: SMOKE_GAM_FLUID_VARIANT,
    title: 'GAM Banner Fluid',
    containerId: SMOKE_GAM_FLUID_VARIANT,
  },
  {
    id: AppiumTestIds.format.appOpen,
    title: 'App Open',
    containerId: AppiumTestIds.format.appOpen,
  },
  {
    id: AppiumTestIds.format.interstitial,
    title: 'Interstitial',
    containerId: AppiumTestIds.format.interstitial,
  },
  {
    id: AppiumTestIds.format.rewarded,
    title: 'Rewarded',
    containerId: AppiumTestIds.format.rewarded,
  },
  {
    id: AppiumTestIds.format.rewardedInterstitial,
    title: 'Rewarded Interstitial',
    containerId: AppiumTestIds.format.rewardedInterstitial,
  },
  {
    id: AppiumTestIds.format.native,
    title: 'Native',
    containerId: AppiumTestIds.format.native,
  },
];

export const SMOKE_FORMATS_SECONDARY: Array<{
  id: string;
  title: string;
  containerId: string;
  actionId?: string;
}> = [
  {
    id: AppiumTestIds.format.adInspector,
    title: 'Ad Inspector',
    containerId: AppiumTestIds.format.adInspector,
  },
  {
    id: AppiumTestIds.format.consent,
    title: 'Consent',
    containerId: AppiumTestIds.format.consent,
  },
  {
    id: AppiumTestIds.format.appOpenHook,
    title: 'App Open Hook',
    containerId: AppiumTestIds.format.appOpenHook,
  },
  {
    id: AppiumTestIds.format.rewardedHook,
    title: 'RWD Hook',
    containerId: AppiumTestIds.format.rewardedHook,
  },
  {
    id: AppiumTestIds.format.debugMenu,
    title: 'Debug Menu',
    containerId: AppiumTestIds.format.debugMenu,
  },
];

export const SMOKE_FORMATS_TERTIARY: Array<{
  id: string;
  title: string;
  containerId: string;
  actionId?: string;
  /** After action tap, require `action.loaded` text to include this (probe seams). */
  expectLoadedSubstring?: string;
  /** Optional a11y label for the action control (Android tap fallback). */
  actionAccessibilityLabel?: string;
}> = [
  {
    id: AppiumTestIds.format.interstitialHook,
    title: 'INT Hook',
    containerId: AppiumTestIds.format.interstitialHook,
  },
  {
    id: AppiumTestIds.format.rewardedInterstitialHook,
    title: 'RWI Hook',
    containerId: AppiumTestIds.format.rewardedInterstitialHook,
  },
  {
    id: AppiumTestIds.format.nativeRngmaTesting,
    title: 'NativeRNGMATesting',
    containerId: AppiumTestIds.format.nativeRngmaTesting,
    actionId: AppiumTestIds.action.show(AppiumTestIds.format.nativeRngmaTesting),
    // Gallery status / accessibilityLabel: `ok ping=ok:android|ok:ios …` after seed probes run.
    expectLoadedSubstring: 'ok ping=',
    actionAccessibilityLabel: 'Run NativeRNGMATesting probes',
  },
];

/** Formats that can run back-to-back without an app restart (same gallery session). */
export const GALLERY_HOME_ONLY_FORMATS = new Set<string>([
  AppiumTestIds.bannerVariant('Banner'),
  AppiumTestIds.format.collapsibleBanner,
  AppiumTestIds.format.gamInterstitial,
]);

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

export function gallerySectionForFormat(formatId: string): Exclude<GallerySectionId, 'all'> {
  if (HOOK_FORMAT_IDS.has(formatId)) {
    return 'hooks';
  }
  if (DEBUG_FORMAT_IDS.has(formatId)) {
    return 'debug';
  }
  return 'formats';
}
