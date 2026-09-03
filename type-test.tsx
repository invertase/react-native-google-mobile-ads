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
  MultiFormatAdPresets,
  MultiFormatBannerAdView,
  TestIds,
  useAdPool,
  useMultiFormatAd,
  usePooledAd,
  type AdErrorPayload,
  type MultiFormatBannerAdHandle,
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

void BannerFailedLoadExample;
void MultiFormatBannerExample;
void PoolHookTreeExample;
