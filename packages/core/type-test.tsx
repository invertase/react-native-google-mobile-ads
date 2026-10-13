/**
 * First `.tsx` type test.
 *
 * JSX examples and hook-in-component usage are not exercised by `type-test.ts`.
 * This file is included in `tsconfig.test.json` so `yarn tsc:compile` fails if
 * the JSX / provider / hook surface regresses.
 */
import React from 'react';

import {
  AdPoolPresets,
  AdPoolProvider,
  BannerAd,
  BannerAdSize,
  GAMBannerAd,
  GAMBannerAdSize,
  MultiFormatAdPresets,
  MultiFormatBannerAdView,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  TestIds,
  useAdPool,
  useAppOpenAdManager,
  useGAMInterstitialAd,
  useMultiFormatAd,
  useNativeAd,
  usePooledAd,
  type AdErrorPayload,
  type GAMBannerAdProps,
  type MultiFormatBannerAdHandle,
  type UseAppOpenAdManagerOptions,
  type UseAppOpenAdManagerResult,
  type UseAppOpenAdManagerStatus,
  type UseGAMInterstitialAdOptions,
  type UseGAMInterstitialAdResult,
  type UseNativeAdOptions,
  type UseNativeAdResult,
  type UseNativeAdStatus,
  type UsePooledAdStatus,
} from './src';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

// Banner JSX: onAdFailedToLoad keeps structured reason / phase fields.
function BannerFailedLoadExample(): React.JSX.Element {
  return (
    <BannerAd
      unitId={TestIds.BANNER}
      size={BannerAdSize.BANNER}
      onAdFailedToLoad={error => {
        const reason: AdErrorPayload['reason'] | undefined = error.reason;
        const phase: AdErrorPayload['phase'] | undefined = error.phase;
        console.log(reason, phase, error.message);
      }}
    />
  );
}

// Multi-format banner view: handle prop is banner-only (non-banner is an error).
declare const bannerHandle: MultiFormatBannerAdHandle;
function MultiFormatBannerExample(): React.JSX.Element {
  return <MultiFormatBannerAdView handle={bannerHandle} />;
}

// Provider + hooks in a component tree (the shape docs examples actually use).
function PoolHookTreeExample(): React.JSX.Element {
  const displayConfig = AdPoolPresets.display(TestIds.GAM_NATIVE);
  const poolId: string = displayConfig.poolId;

  function Consumer(): React.JSX.Element | null {
    const pool = useAdPool(poolId);
    const pooled = usePooledAd(poolId);
    const multi = useMultiFormatAd(
      TestIds.GAM_NATIVE,
      MultiFormatAdPresets.nativeOrBanner([BannerAdSize.BANNER]),
    );

    const consumed: UsePooledAdStatus = 'consumed';
    type ObservedCountIsNumber = Equal<typeof pooled.observedCount, number>;
    const observedCountLock: ObservedCountIsNumber = true;

    console.log(
      pool.status,
      pooled.status,
      pooled.poolStatus,
      pooled.available,
      pooled.observedCount,
      multi.status,
      consumed,
      observedCountLock,
    );
    return null;
  }

  return (
    <AdPoolProvider pools={[displayConfig]}>
      <Consumer />
    </AdPoolProvider>
  );
}

// High-value hooks previously missing from type-test.
function DeferredHooksTypeProof(): React.JSX.Element | null {
  const managerOptions: UseAppOpenAdManagerOptions = {
    adUnitId: TestIds.APP_OPEN,
    autoLoad: false,
  };
  const manager: UseAppOpenAdManagerResult = useAppOpenAdManager(managerOptions);
  const managerStatus: UseAppOpenAdManagerStatus = manager.status;

  const gamOptions: UseGAMInterstitialAdOptions = {
    adUnitId: TestIds.GAM_INTERSTITIAL,
    autoLoad: false,
    onAppEvent: (event: { name: string; data?: string }) => {
      console.log(event.name, event.data);
    },
  };
  const gam: UseGAMInterstitialAdResult = useGAMInterstitialAd(gamOptions);

  const nativeOptions: UseNativeAdOptions = {
    adUnitId: TestIds.GAM_NATIVE,
    autoLoad: false,
  };
  const native: UseNativeAdResult = useNativeAd(nativeOptions);
  const nativeStatus: UseNativeAdStatus = native.status;

  console.log(managerStatus, gam.status, nativeStatus, native.nativeAd);
  return null;
}

// Native component JSX props previously missing from type-test.
function NativeComponentsTypeProof(): React.JSX.Element | null {
  const native: UseNativeAdResult = useNativeAd({
    adUnitId: TestIds.GAM_NATIVE,
    autoLoad: false,
  });
  if (!native.nativeAd) {
    return null;
  }
  return (
    <NativeAdView nativeAd={native.nativeAd}>
      <NativeAsset assetType={NativeAssetType.HEADLINE} />
      <NativeMediaView resizeMode="cover" />
    </NativeAdView>
  );
}

// GAM banner ref + manualImpressionsEnabled prop (JSX surface).
function GAMBannerManualImpressionTypeProof(): React.JSX.Element {
  const ref = React.useRef<GAMBannerAd>(null);
  type ManualImpressionsEnabledIsOptionalBoolean = Equal<
    GAMBannerAdProps['manualImpressionsEnabled'],
    boolean | undefined
  >;
  const manualImpressionsEnabledLock: ManualImpressionsEnabledIsOptionalBoolean = true;
  const recordManualImpression = (): void => {
    ref.current?.recordManualImpression();
    ref.current?.load();
  };
  console.log(manualImpressionsEnabledLock, recordManualImpression);
  return (
    <GAMBannerAd
      ref={ref}
      unitId={TestIds.GAM_BANNER}
      sizes={[GAMBannerAdSize.BANNER]}
      manualImpressionsEnabled={true}
    />
  );
}

void BannerFailedLoadExample;
void MultiFormatBannerExample;
void PoolHookTreeExample;
void DeferredHooksTypeProof;
void NativeComponentsTypeProof;
void GAMBannerManualImpressionTypeProof;
