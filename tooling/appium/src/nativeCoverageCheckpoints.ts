import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_API_CONTRACTS } from './contracts.ts';
import {
  REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS,
  SDK_UTILITY_SURFACE_CONTRACTS,
} from './formats.ts';
import { AppiumTestIds } from './testIds.ts';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const androidProductRoot = path.join(
  repositoryRoot,
  'packages/core/android/src/main/java/io/invertase/googlemobileads',
);
const iosProductRoot = path.join(repositoryRoot, 'packages/core/ios/RNGoogleMobileAds');

export type NativeCoverageCheckpoint = {
  contractId: string;
  /** Repo-relative paths expected to gain execution after this contract succeeds on device. */
  androidSources: readonly string[];
  iosSources: readonly string[];
  /** What a maintainer should compare in Jacoco XML / iOS LCOV after slot-6 proof. */
  jacocoExpectation: string;
};

function android(...segments: string[]): string {
  return path.join(androidProductRoot, ...segments);
}

function ios(...segments: string[]): string {
  return path.join(iosProductRoot, ...segments);
}

/**
 * Device-run Jacoco/LLVM checkpoints for each executable Appium contract.
 * Behavioral proof stays in Appium assertions; this registry only names native
 * product files agents should diff in pull/report artifacts (coverage-design).
 */
const REQUEST_OUTCOME_NATIVE_COVERAGE_CHECKPOINTS: readonly NativeCoverageCheckpoint[] = [
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[0].id,
    androidSources: [
      android('ReactNativeGoogleMobileAdsBannerAdViewManager.java'),
      android('ReactNativeGoogleMobileAdsAdHelper.kt'),
    ],
    iosSources: [
      ios('RNGoogleMobileAdsBannerViewManager.mm'),
      ios('RNGoogleMobileAdsBannerView.mm'),
    ],
    jacocoExpectation:
      'Banner load/render path executes banner view manager and helper code without requiring paid-event branches.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[1].id,
    androidSources: [android('ReactNativeGoogleMobileAdsBannerAdViewManager.java')],
    iosSources: [ios('RNGoogleMobileAdsBannerViewManager.mm')],
    jacocoExpectation:
      'Collapsible banner request options flow through the same banner manager path as standard banners.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[2].id,
    androidSources: [android('ReactNativeGoogleMobileAdsBannerAdViewManager.java')],
    iosSources: [ios('RNGoogleMobileAdsBannerViewManager.mm')],
    jacocoExpectation:
      'GAM anchored adaptive sizes execute the GAM banner bridge; fluid-only navigation remains a separate gap.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[3].id,
    androidSources: [
      android('ReactNativeGoogleMobileAdsNativeModule.kt'),
      android('ReactNativeGoogleMobileAdsNativeAdViewManager.kt'),
    ],
    iosSources: [
      ios('RNGoogleMobileAdsNativeModule.mm'),
      ios('RNGoogleMobileAdsNativeView.mm'),
    ],
    jacocoExpectation:
      'Native load and NativeAdView attach execute native module and view manager code.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[4].id,
    androidSources: [
      android('ReactNativeGoogleMobileAdsAppOpenModule.kt'),
      android('ReactNativeGoogleMobileAdsFullScreenAdModule.kt'),
    ],
    iosSources: [
      ios('RNGoogleMobileAdsAppOpenModule.mm'),
      ios('RNGoogleMobileAdsFullScreenAd.mm'),
    ],
    jacocoExpectation:
      'App-open load/show/close executes app-open and shared fullscreen delegate modules.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[5].id,
    androidSources: [
      android('ReactNativeGoogleMobileAdsInterstitialModule.kt'),
      android('ReactNativeGoogleMobileAdsFullScreenAdModule.kt'),
    ],
    iosSources: [
      ios('RNGoogleMobileAdsInterstitialModule.mm'),
      ios('RNGoogleMobileAdsFullScreenAd.mm'),
    ],
    jacocoExpectation:
      'Interstitial load/show/close executes interstitial module plus fullscreen content delegate plumbing.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[6].id,
    androidSources: [
      android('ReactNativeGoogleMobileAdsRewardedModule.kt'),
      android('ReactNativeGoogleMobileAdsFullScreenAdModule.kt'),
    ],
    iosSources: [
      ios('RNGoogleMobileAdsRewardedModule.mm'),
      ios('RNGoogleMobileAdsFullScreenAd.mm'),
    ],
    jacocoExpectation:
      'Rewarded load/show/close executes rewarded module; earned-reward branches may remain uncovered by design.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[7].id,
    androidSources: [
      android('ReactNativeGoogleMobileAdsRewardedInterstitialModule.kt'),
      android('ReactNativeGoogleMobileAdsFullScreenAdModule.kt'),
    ],
    iosSources: [
      ios('RNGoogleMobileAdsRewardedInterstitialModule.mm'),
      ios('RNGoogleMobileAdsFullScreenAd.mm'),
    ],
    jacocoExpectation:
      'Rewarded-interstitial load/show/close executes RWI module where platform capability allows pool/preload creation.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[8].id,
    androidSources: [
      android('ReactNativeGoogleMobileAdsInterstitialModule.kt'),
      android('ReactNativeGoogleMobileAdsFullScreenAdModule.kt'),
    ],
    iosSources: [
      ios('RNGoogleMobileAdsInterstitialModule.mm'),
      ios('RNGoogleMobileAdsFullScreenAd.mm'),
    ],
    jacocoExpectation:
      'GAM interstitial load/show/close executes interstitial bridge; GAM app-event dispatch may remain inventory-dependent.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[9].id,
    androidSources: [android('ReactNativeGoogleMobileAdsFullScreenAdModule.kt')],
    iosSources: [ios('RNGoogleMobileAdsFullScreenAd.mm')],
    jacocoExpectation:
      'App-open hook show/close reuses fullscreen bridge paths invoked by imperative app-open controls.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[10].id,
    androidSources: [android('ReactNativeGoogleMobileAdsFullScreenAdModule.kt')],
    iosSources: [ios('RNGoogleMobileAdsFullScreenAd.mm')],
    jacocoExpectation:
      'Interstitial hook auto-load and show/close executes fullscreen bridge without requiring paid callbacks.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[11].id,
    androidSources: [android('ReactNativeGoogleMobileAdsRewardedModule.kt')],
    iosSources: [ios('RNGoogleMobileAdsRewardedModule.mm')],
    jacocoExpectation:
      'Rewarded hook load/show/close executes rewarded module; paid/earned-reward branches stay non-blocking.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[12].id,
    androidSources: [android('ReactNativeGoogleMobileAdsRewardedInterstitialModule.kt')],
    iosSources: [ios('RNGoogleMobileAdsRewardedInterstitialModule.mm')],
    jacocoExpectation:
      'Rewarded-interstitial hook executes RWI module on platforms where the format is supported.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[13].id,
    androidSources: [android('ReactNativeGoogleMobileAdsPoolModule.kt')],
    iosSources: [ios('RNGoogleMobileAdsPoolModule.mm')],
    jacocoExpectation:
      'Provider-owned pool ready/filled/show paths execute pool registry, poll, and fullscreen show plumbing.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[14].id,
    androidSources: [android('ReactNativeGoogleMobileAdsPoolModule.kt')],
    iosSources: [ios('RNGoogleMobileAdsPoolModule.mm')],
    jacocoExpectation:
      'Imperative AdPools.create/get/poll/show executes pool module registration and inventory polling.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[15].id,
    androidSources: [android('ReactNativeGoogleMobileAdsPoolModule.kt')],
    iosSources: [ios('RNGoogleMobileAdsPoolModule.mm')],
    jacocoExpectation:
      'Capability peek probes execute pool peek entry points; Android classic reports structured unsupported without faking success.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[16].id,
    androidSources: [android('ReactNativeGoogleMobileAdsPoolModule.kt')],
    iosSources: [ios('RNGoogleMobileAdsPoolModule.mm')],
    jacocoExpectation:
      'RWI preload gate executes pool create on iOS and capability-gated failure handling on Android classic.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[17].id,
    androidSources: [
      android('ReactNativeGoogleMobileAdsNativeModule.kt'),
      android('MultiFormatRequestParser.kt'),
      android('ReactNativeGoogleMobileAdsMultiFormatBannerViewManager.kt'),
    ],
    iosSources: [
      ios('RNGoogleMobileAdsNativeModule.mm'),
      ios('RNGoogleMobileAdsMultiFormatBannerView.mm'),
    ],
    jacocoExpectation:
      'Multi-format imperative load executes parser plus native or banner winner attach modules depending on inventory.',
  },
  {
    contractId: REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS[18].id,
    androidSources: [
      android('ReactNativeGoogleMobileAdsNativeModule.kt'),
      android('MultiFormatRequestParser.kt'),
      android('ReactNativeGoogleMobileAdsMultiFormatBannerViewManager.kt'),
    ],
    iosSources: [
      ios('RNGoogleMobileAdsNativeModule.mm'),
      ios('RNGoogleMobileAdsMultiFormatBannerView.mm'),
    ],
    jacocoExpectation:
      'Multi-format hook auto-load executes the same native/banner attach modules as the imperative request surface.',
  },
] as const;

const UTILITY_NATIVE_COVERAGE_CHECKPOINTS: readonly NativeCoverageCheckpoint[] = [
  {
    contractId: AppiumTestIds.format.adInspector,
    androidSources: [android('ReactNativeGoogleMobileAdsModule.kt')],
    iosSources: [ios('RNGoogleMobileAdsModule.mm')],
    jacocoExpectation:
      'Ad Inspector open/close executes MobileAds module inspector entry points without requiring ad inventory or creative interaction.',
  },
  {
    contractId: AppiumTestIds.format.debugMenu,
    androidSources: [android('ReactNativeGoogleMobileAdsModule.kt')],
    iosSources: [ios('RNGoogleMobileAdsModule.mm')],
    jacocoExpectation:
      'Debug Menu open/close executes MobileAds module debug-menu entry points after initialize on Android without asserting SDK internals.',
  },
] as const;

export const NATIVE_COVERAGE_CHECKPOINTS: readonly NativeCoverageCheckpoint[] = [
  ...REQUEST_OUTCOME_NATIVE_COVERAGE_CHECKPOINTS,
  ...UTILITY_NATIVE_COVERAGE_CHECKPOINTS,
] as const;

export const EXECUTABLE_E2E_CONTRACT_IDS: readonly string[] = [
  ...REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.map(contract => contract.id),
  ...SDK_UTILITY_SURFACE_CONTRACTS.map(contract => contract.id),
] as const;

/** Gaps that remain honest dispositions or navigation-only until a device proof run closes native coverage. */
export const DEVICE_NATIVE_COVERAGE_GAPS = [
  {
    id: 'gam-banner-fluid',
    summary:
      'GAM Banner Fluid remains navigation-only; no render contract claims fluid inventory.',
    deviceProof:
      'Optional future contract would share banner manager checkpoints with anchored GAM banner once fluid render is asserted.',
  },
  {
    id: 'initialization-state',
    summary:
      'InitializationState is not rendered in the example; initialize() runs but adapter state is not an Appium outcome.',
    deviceProof:
      'Jacoco may show ReactNativeGoogleMobileAdsModule initialize paths from debug-menu pre-init without a dedicated public-API contract.',
  },
  {
    id: 'consent-ump',
    summary: 'Consent/UMP exports are parked not-appium-capable with maintainer decision; no coverage expected.',
    deviceProof: 'Consent module branches stay excluded until a configured UMP test app exists.',
  },
  {
    id: 'ios-lcov-export',
    summary:
      'react-native-coverage@0.2.0 cannot export universal simulator LCOV without architecture selection; preserve raw profraw until exporter fix.',
    deviceProof:
      'Slot-6 iOS run: rn-coverage ios pull then export; report limitation if percentage cannot be claimed.',
  },
  {
    id: 'android-baseline-final',
    summary:
      'E9 closure requires before/after Android jacocoTestReport.xml from a full multi-shard Appium run with teardown flush.',
    deviceProof:
      'yarn workspace RNGoogleMobileAdsExample exec rn-coverage android pull && android report; diff against pre-E9 baseline artifact.',
  },
] as const;

export function nativeCoverageCheckpointSummary(): {
  checkpointCount: number;
  contractIds: string[];
  deviceGapCount: number;
} {
  return {
    checkpointCount: NATIVE_COVERAGE_CHECKPOINTS.length,
    contractIds: NATIVE_COVERAGE_CHECKPOINTS.map(checkpoint => checkpoint.contractId),
    deviceGapCount: DEVICE_NATIVE_COVERAGE_GAPS.length,
  };
}

export function validateNativeCoverageCheckpoints(): string[] {
  const errors: string[] = [];
  const executableIds = [...EXECUTABLE_E2E_CONTRACT_IDS];
  const checkpointIds = NATIVE_COVERAGE_CHECKPOINTS.map(checkpoint => checkpoint.contractId);

  if (checkpointIds.length !== executableIds.length) {
    errors.push(
      `checkpoint count ${checkpointIds.length} does not match executable contract count ${executableIds.length}`,
    );
  }
  for (const contractId of executableIds) {
    if (!checkpointIds.includes(contractId)) {
      errors.push(`missing native coverage checkpoint for executable contract ${contractId}`);
    }
  }
  for (const contractId of checkpointIds) {
    if (!executableIds.includes(contractId)) {
      errors.push(`stale native coverage checkpoint references unknown contract ${contractId}`);
    }
  }

  const dispositioned = new Set(
    PUBLIC_API_CONTRACTS.flatMap(contract =>
      contract.disposition === 'e2e-outcome' ? [contract.contractId] : [],
    ),
  );
  for (const contractId of dispositioned) {
    if (!checkpointIds.includes(contractId)) {
      errors.push(`e2e-outcome contractId ${contractId} has no Jacoco checkpoint entry`);
    }
  }

  for (const checkpoint of NATIVE_COVERAGE_CHECKPOINTS) {
    if (checkpoint.jacocoExpectation.trim().split(/\s+/).length < 8) {
      errors.push(`checkpoint ${checkpoint.contractId} has a non-specific jacocoExpectation`);
    }
    for (const sourcePath of [...checkpoint.androidSources, ...checkpoint.iosSources]) {
      if (!existsSync(sourcePath)) {
        errors.push(`checkpoint ${checkpoint.contractId} references missing source ${sourcePath}`);
      }
    }
  }

  return errors;
}
