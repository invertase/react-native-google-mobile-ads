/* eslint-disable no-console */
import mobileAds, {
  SDK_VERSION,
  MobileAds,
  AdsConsentDebugGeography,
  AdsConsentPurposes,
  AdsConsentSpecialFeatures,
  AdsConsentStatus,
  AdsConsentPrivacyOptionsRequirementStatus,
  MaxAdContentRating,
  TestIds,
  AdEventType,
  BannerAdSize,
  GAMBannerAdSize,
  GAMAdEventType,
  RewardedAdEventType,
  AdsConsent,
  AppOpenAd,
  InterstitialAd,
  RewardedAd,
  RewardedInterstitialAd,
  BannerAd,
  GAMBannerAd,
  GAMInterstitialAd,
  useAppOpenAd,
  useInterstitialAd,
  useRewardedAd,
  useRewardedInterstitialAd,
  useForeground,
  AdFormat,
  AdPools,
  AdPoolPresets,
  AdStalenessGuidanceMillis,
  MultiFormatAdPresets,
  MultiFormatAdRequest,
  MultiFormatBannerAdView,
  getAdCapabilities,
  AdPoolProvider,
  useAdPool,
  usePooledAd,
  useMultiFormatAd,
  NativeError,
} from './src';

import type {
  AdapterResponseInfo,
  AdBackend,
  AdCapabilities,
  AdError,
  AdErrorPayload,
  AdEventListener,
  AdEventPayload,
  KnownAdErrorReason,
  AdExpiry,
  AdIdentity,
  AdPool,
  AdPoolAvailability,
  AdPoolConfig,
  AdPoolEvent,
  AdPoolPresetOverrides,
  AdPoolProviderProps,
  DisplayPoolId,
  FullscreenPoolId,
  CapabilitySupport,
  LoadedAdapterResponseInfo,
  MultiFormatAdConfig,
  MultiFormatAdHandle,
  MultiFormatAdRequestOptions,
  MultiFormatBannerAdHandle,
  MultiFormatBannerAdViewProps,
  MultiFormatBannerSize,
  MultiFormatLoadResult,
  PaidEvent,
  PollResult,
  PooledAd,
  ResponseInfo,
  RewardedAdReward,
  UseAdPoolResult,
  UseAdPoolStatus,
  UseAppOpenAdResult,
  UseFullScreenAdStatus,
  UseInterstitialAdOptions,
  UseInterstitialAdResult,
  UseMultiFormatAdOptions,
  UseMultiFormatAdResult as ExportedUseMultiFormatAdResult,
  UseMultiFormatAdStatus,
  UsePooledAdResult as ExportedUsePooledAdResult,
  UsePooledAdStatus,
  UseRewardedAdOptions,
  UseRewardedAdResult,
} from './src';

// static exports
console.log(SDK_VERSION);

// default export
mobileAds()
  .initialize()
  .then(statuses => statuses);
mobileAds().openAdInspector().then();
mobileAds().openDebugMenu('foo');
mobileAds().setAppMuted(false);
mobileAds().setAppVolume(0.5);
mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.G }).then();
mobileAds().subscribeToNativeModuleEvent('foo');

// MobileAds
MobileAds()
  .initialize()
  .then(statuses => statuses);
MobileAds().openAdInspector().then();
MobileAds().openDebugMenu('foo');
MobileAds().setAppMuted(false);
MobileAds().setAppVolume(0.5);
MobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.G }).then();
MobileAds().subscribeToNativeModuleEvent('foo');

// AdsConsentDebugGeography
console.log(AdsConsentDebugGeography.DISABLED);
console.log(AdsConsentDebugGeography.EEA);
console.log(AdsConsentDebugGeography.NOT_EEA);

// AdsConsentPurposes
console.log(AdsConsentPurposes.APPLY_MARKET_RESEARCH_TO_GENERATE_AUDIENCE_INSIGHTS);
console.log(AdsConsentPurposes.CREATE_A_PERSONALISED_ADS_PROFILE);
console.log(AdsConsentPurposes.CREATE_A_PERSONALISED_CONTENT_PROFILE);
console.log(AdsConsentPurposes.DEVELOP_AND_IMPROVE_PRODUCTS);
console.log(AdsConsentPurposes.MEASURE_AD_PERFORMANCE);
console.log(AdsConsentPurposes.MEASURE_CONTENT_PERFORMANCE);
console.log(AdsConsentPurposes.SELECT_BASIC_ADS);
console.log(AdsConsentPurposes.SELECT_PERSONALISED_ADS);
console.log(AdsConsentPurposes.SELECT_PERSONALISED_CONTENT);
console.log(AdsConsentPurposes.STORE_AND_ACCESS_INFORMATION_ON_DEVICE);

// AdsConsentSpecialFeatures
console.log(AdsConsentSpecialFeatures.ACTIVELY_SCAN_DEVICE_CHARACTERISTICS_FOR_IDENTIFICATION);
console.log(AdsConsentSpecialFeatures.USE_PRECISE_GEOLOCATION_DATA);

// AdsConsentStatus
console.log(AdsConsentStatus.UNKNOWN);
console.log(AdsConsentStatus.REQUIRED);
console.log(AdsConsentStatus.NOT_REQUIRED);
console.log(AdsConsentStatus.OBTAINED);

// AdsConsentPrivacyOptionsRequirementStatus
console.log(AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED);
console.log(AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
console.log(AdsConsentPrivacyOptionsRequirementStatus.UNKNOWN);

// MaxAdContentRating
console.log(MaxAdContentRating.G);
console.log(MaxAdContentRating.MA);
console.log(MaxAdContentRating.PG);
console.log(MaxAdContentRating.T);

// TestIds
console.log(TestIds.ADAPTIVE_BANNER);
console.log(TestIds.APP_OPEN);
console.log(TestIds.BANNER);
console.log(TestIds.GAM_APP_OPEN);
console.log(TestIds.GAM_BANNER);
console.log(TestIds.GAM_INTERSTITIAL);
console.log(TestIds.GAM_NATIVE);
console.log(TestIds.GAM_REWARDED);
console.log(TestIds.GAM_REWARDED_INTERSTITIAL);
console.log(TestIds.INTERSTITIAL);
console.log(TestIds.INTERSTITIAL_VIDEO);
console.log(TestIds.REWARDED);
console.log(TestIds.REWARDED_INTERSTITIAL);

// AdEventType
console.log(AdEventType.CLICKED);
console.log(AdEventType.CLOSED);
console.log(AdEventType.ERROR);
console.log(AdEventType.IMPRESSION);
console.log(AdEventType.LOADED);
console.log(AdEventType.OPENED);
console.log(AdEventType.PAID);

// BannerAdSize
console.log(BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER);
console.log(BannerAdSize.BANNER);
console.log(BannerAdSize.FULL_BANNER);
console.log(BannerAdSize.INLINE_ADAPTIVE_BANNER);
console.log(BannerAdSize.LARGE_BANNER);
console.log(BannerAdSize.LEADERBOARD);
console.log(BannerAdSize.MEDIUM_RECTANGLE);
console.log(BannerAdSize.WIDE_SKYSCRAPER);

// GAMBannerAdSize
console.log(GAMBannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER);
console.log(GAMBannerAdSize.BANNER);
console.log(GAMBannerAdSize.FLUID);
console.log(GAMBannerAdSize.FULL_BANNER);
console.log(GAMBannerAdSize.INLINE_ADAPTIVE_BANNER);
console.log(GAMBannerAdSize.LARGE_BANNER);
console.log(GAMBannerAdSize.LEADERBOARD);
console.log(GAMBannerAdSize.MEDIUM_RECTANGLE);
console.log(GAMBannerAdSize.WIDE_SKYSCRAPER);

// GAMAdEventType
console.log(GAMAdEventType.APP_EVENT);

// RewaredAdEventType
console.log(RewardedAdEventType.LOADED);
console.log(RewardedAdEventType.EARNED_REWARD);

// AdsConsent
AdsConsent.getConsentInfo().then(info => info.canRequestAds);
AdsConsent.getGdprApplies().then(applies => applies);
AdsConsent.getPurposeConsents().then(consents => consents);
AdsConsent.getPurposeLegitimateInterests().then(legitimateInterests => legitimateInterests);
AdsConsent.getTCModel().then(model => model.cmpId);
AdsConsent.getTCString().then(string => string);
AdsConsent.getUserChoices().then(choices => choices.selectBasicAds);
AdsConsent.loadAndShowConsentFormIfRequired().then(info => info.canRequestAds);
AdsConsent.requestInfoUpdate().then(info => info.canRequestAds);
AdsConsent.reset();
AdsConsent.showForm().then(info => info.status);
AdsConsent.showPrivacyOptionsForm().then(info => info.status);

// AppOpenAd
const appOpenAd = AppOpenAd.createForAdRequest('foo', {
  keywords: ['test'],
});

console.log(appOpenAd.adUnitId);
console.log(appOpenAd.loaded);

appOpenAd.load();
appOpenAd.show().then();

appOpenAd.addAdEventListener(AdEventType.PAID, (paid: PaidEvent) => {
  console.log(paid.currency, paid.value, paid.valueMicros, paid.responseInfo?.responseId);
});
appOpenAd.addAdEventsListener(({ type, payload }) => {
  if (payload) {
    console.log(type);
    console.log(payload instanceof Error && payload.message);
    console.log('amount' in payload && payload.amount);
    console.log('data' in payload && payload.data);
    console.log('currency' in payload && payload.currency);
  }
});
appOpenAd.removeAllListeners();

// InterstitialAd
const interstitial = InterstitialAd.createForAdRequest('foo', {
  keywords: ['test'],
});

console.log(interstitial.adUnitId);
console.log(interstitial.loaded);

interstitial.load();
interstitial.show().then();

interstitial.addAdEventListener(AdEventType.PAID, (paid: PaidEvent) => {
  console.log(paid.currency, paid.valueMicros);
});
interstitial.addAdEventsListener(({ type, payload }) => {
  if (payload) {
    console.log(type);
    console.log(payload instanceof Error && payload.message);
    console.log('amount' in payload && payload.amount);
    console.log('data' in payload && payload.data);
    console.log('currency' in payload && payload.currency);
  }
});
interstitial.removeAllListeners();

// RewardedAd
const rewardedAd = RewardedAd.createForAdRequest('foo', {
  keywords: ['test'],
});

console.log(rewardedAd.adUnitId);
console.log(rewardedAd.loaded);

rewardedAd.load();
rewardedAd.show().then();

rewardedAd.addAdEventListener(AdEventType.PAID, (paid: PaidEvent) => {
  console.log(paid.currency, paid.valueMicros);
});
rewardedAd.addAdEventsListener(({ type, payload }) => {
  if (payload) {
    console.log(type);
    console.log(payload instanceof Error && payload.message);
    console.log('amount' in payload && payload.amount);
    console.log('data' in payload && payload.data);
    console.log('currency' in payload && payload.currency);
  }
});
rewardedAd.removeAllListeners();

// RewardedInterstitialAd
const rewardedInterstitialAd = RewardedInterstitialAd.createForAdRequest('foo', {
  keywords: ['test'],
});

console.log(rewardedInterstitialAd.adUnitId);
console.log(rewardedInterstitialAd.loaded);

rewardedInterstitialAd.load();
rewardedInterstitialAd.show().then();

rewardedInterstitialAd.addAdEventListener(AdEventType.PAID, (paid: PaidEvent) => {
  console.log(paid.currency, paid.valueMicros);
});
rewardedInterstitialAd.addAdEventsListener(({ type, payload }) => {
  if (payload) {
    console.log(type);
    console.log(payload instanceof Error && payload.message);
    console.log('amount' in payload && payload.amount);
    console.log('data' in payload && payload.data);
    console.log('currency' in payload && payload.currency);
  }
});
rewardedInterstitialAd.removeAllListeners();

// BannerAd
console.log(BannerAd);

// GAMBannerAd
console.log(GAMBannerAd);

// GAMInterstitialAd
const gmaInterstitialAd = GAMInterstitialAd.createForAdRequest('foo', {
  keywords: ['test'],
});

console.log(gmaInterstitialAd.adUnitId);
console.log(gmaInterstitialAd.loaded);

gmaInterstitialAd.load();
gmaInterstitialAd.show().then();

gmaInterstitialAd.addAdEventListener(AdEventType.PAID, (paid: PaidEvent) => {
  console.log(paid.currency, paid.valueMicros);
});
gmaInterstitialAd.addAdEventsListener(({ type, payload }) => {
  if (payload) {
    console.log(type);
    console.log(payload instanceof Error && payload.message);
    console.log('amount' in payload && payload.amount);
    console.log('data' in payload && payload.data);
    console.log('currency' in payload && payload.currency);
  }
});
gmaInterstitialAd.removeAllListeners();

// useAppOpenAd
console.log(useAppOpenAd);

// useInterstitialAd
console.log(useInterstitialAd);

// useRewardedAd
console.log(useRewardedAd);

// useRewardedInterstitialAd
console.log(useRewardedInterstitialAd);

// useForeground
console.log(useForeground);

// v17 capability discovery + presets
const capabilities: AdCapabilities = getAdCapabilities();
const backend: AdBackend = capabilities.backend;
const support: CapabilitySupport = capabilities.fullscreenPreload;
console.log(backend, support, capabilities.sdkVersion);
console.log(AdFormat.NATIVE, AdFormat.BANNER, AdFormat.INTERSTITIAL);

const fullscreenPoolConfig = AdPoolPresets.fullscreen(
  AdFormat.INTERSTITIAL,
  TestIds.INTERSTITIAL,
);
const fullscreenPoolConfigAsAdPool: AdPoolConfig = fullscreenPoolConfig;
const displayPoolConfig = AdPoolPresets.display(TestIds.GAM_NATIVE);
console.log(fullscreenPoolConfigAsAdPool.poolId, displayPoolConfig.formats);

// AdPoolPresets.fullscreen takes the same AdPoolPresetOverrides bag as display,
// so the one field that matters on a fullscreen pool is reachable.
const bufferedFullscreenConfig: AdPoolConfig = AdPoolPresets.fullscreen(
  AdFormat.INTERSTITIAL,
  TestIds.INTERSTITIAL,
  { bufferSize: 2, requestOptions: { keywords: ['test'] } },
);
console.log(bufferedFullscreenConfig.bufferSize, bufferedFullscreenConfig.requestOptions?.keywords);

// poolId is a typed joint — prefer config.poolId over hand-retyping the template.
const displayPoolIdFromPreset: DisplayPoolId<typeof TestIds.GAM_NATIVE> = displayPoolConfig.poolId;
const fullscreenPoolIdFromPreset: FullscreenPoolId<
  AdFormat.INTERSTITIAL,
  typeof TestIds.INTERSTITIAL
> = fullscreenPoolConfig.poolId;
console.log(displayPoolIdFromPreset, fullscreenPoolIdFromPreset);

// Override bag omits formats / adUnitId (compile-time undercut blocked).
const displayOverrides: AdPoolPresetOverrides = {
  bufferSize: 1,
  poolId: 'custom-display-pool',
  bannerSizes: [BannerAdSize.BANNER],
};
const customIdDisplay = AdPoolPresets.display(TestIds.GAM_NATIVE, displayOverrides);
console.log(customIdDisplay.poolId, customIdDisplay.adUnitId);
// @ts-expect-error formats is not an AdPoolPresetOverrides field
const badDisplayFormats: AdPoolPresetOverrides = { formats: [AdFormat.INTERSTITIAL] };
// @ts-expect-error adUnitId is not an AdPoolPresetOverrides field
const badDisplayUnit: AdPoolPresetOverrides = { adUnitId: 'other-unit' };
void badDisplayFormats;
void badDisplayUnit;

const multiFormatBannerSizes: MultiFormatBannerSize[] = [
  BannerAdSize.BANNER,
  BannerAdSize.MEDIUM_RECTANGLE,
  BannerAdSize.WIDE_SKYSCRAPER,
  '300x200',
  { width: 300, height: 200 },
];
const multiFormatOptions: MultiFormatAdRequestOptions = MultiFormatAdPresets.nativeOrBanner(
  multiFormatBannerSizes,
);
const multiFormat = MultiFormatAdRequest.create({
  adUnitId: TestIds.GAM_NATIVE,
  requestOptions: multiFormatOptions,
});
console.log(multiFormat.adUnitId);
multiFormat.destroy();

AdPools.getCapabilities();
AdPools.get('missing');
AdPools.destroyAll();
AdPools.create(fullscreenPoolConfig).catch(() => undefined);

console.log(AdPoolProvider);
console.log(useAdPool);
console.log(usePooledAd);
console.log(useMultiFormatAd);

// MultiFormatBannerAdView (banner-only handle prop)
declare const multiFormatBannerHandle: MultiFormatBannerAdHandle;
console.log(MultiFormatBannerAdView, multiFormatBannerHandle.format);

// NativeError public export
console.log(NativeError);

// PooledAd fullscreen listener typing (must not erase to unknown[])
declare const pooledAd: PooledAd;
if (
  pooledAd.format === AdFormat.INTERSTITIAL ||
  pooledAd.format === AdFormat.APP_OPEN ||
  pooledAd.format === AdFormat.REWARDED ||
  pooledAd.format === AdFormat.REWARDED_INTERSTITIAL
) {
  pooledAd.addAdEventListener(AdEventType.LOADED, () => undefined)();
  pooledAd.addAdEventListener(GAMAdEventType.APP_EVENT, () => undefined)();
  pooledAd.addAdEventsListener(({ type, payload }) => {
    console.log(type, payload);
  })();
  pooledAd.removeAllListeners();
}

// PooledAd identity + publisher-policy staleness are present on every variant
console.log(
  pooledAd.adId,
  pooledAd.observedAt,
  pooledAd.provenance,
  pooledAd.stalenessWindowMillis,
  pooledAd.stalenessWindowSource,
  pooledAd.isStaleByPolicy(),
);
pooledAd.onStaleByPolicy(() => undefined)();

// PollResult narrows the filled case to a PooledAd
declare const pollResult: PollResult;
switch (pollResult.status) {
  case 'filled':
    console.log(pollResult.ad.adId, pollResult.ad.isStaleByPolicy());
    break;
  case 'empty':
  case 'timeout':
    break;
  case 'no-fill':
  case 'error':
    console.log(pollResult.error.reason, pollResult.error.phase);
    break;
}

// Pool churn events: library-managed eviction vs SDK-managed signals
declare const poolEvent: AdPoolEvent;
if (poolEvent.type === 'expired') {
  console.log(poolEvent.poolId, poolEvent.adId, poolEvent.reason, poolEvent.provenance);
}
if (poolEvent.type === 'refreshed') {
  console.log(poolEvent.adId, poolEvent.replacedAdId, poolEvent.provenance);
}
if (poolEvent.type === 'exhausted') {
  console.log(poolEvent.poolId);
}
if (poolEvent.type === 'available') {
  console.log(poolEvent.poolId, poolEvent.responseId);
}

// useAdPool status union narrows `pool` to non-null without assertions
const poolState = useAdPool('display-pool');
// `retry` lives on every arm, so it is callable without narrowing first
poolState.retry();
if (poolState.status === 'ready' || poolState.status === 'ready-degraded') {
  console.log(poolState.pool.poolId, poolState.pool.resolved.degradeReasons);
  console.log(poolState.pool.resolved.effectiveStalenessWindowMillis);
}
if (poolState.status === 'error') {
  // The error arm carries the structured payload as well as being an Error
  console.log(poolState.error.message, poolState.error.reason, poolState.error.phase);
}

// usePooledAd is state-first and discriminated on status
const pooledState = usePooledAd('display-pool');
console.log(
  pooledState.status,
  pooledState.poolStatus,
  pooledState.available,
  pooledState.observedCount,
);
pooledState.poll().then(result => console.log(result.status));
console.log(pooledState.release());

// Narrowing: filled carries a PooledAd; error/no-fill carry AdError; empty does not
type UsePooledAdResult = ReturnType<typeof usePooledAd>;
type PooledFilled = Extract<UsePooledAdResult, { status: 'filled' }>;
type PooledError = Extract<UsePooledAdResult, { status: 'error' }>;
type PooledNoFill = Extract<UsePooledAdResult, { status: 'no-fill' }>;
type PooledEmpty = Extract<UsePooledAdResult, { status: 'empty' }>;
type PooledStale = Extract<UsePooledAdResult, { status: 'stale-by-policy' }>;
type PooledConsumed = Extract<UsePooledAdResult, { status: 'consumed' }>;
declare const pooledFilled: PooledFilled;
declare const pooledErrorArm: PooledError;
declare const pooledNoFillArm: PooledNoFill;
declare const pooledEmptyArm: PooledEmpty;
declare const pooledStaleArm: PooledStale;
declare const pooledConsumedArm: PooledConsumed;
console.log(pooledFilled.ad.adId, pooledFilled.error);
console.log(pooledErrorArm.error.reason, pooledErrorArm.ad);
console.log(pooledNoFillArm.error.phase, pooledNoFillArm.ad);
console.log(pooledEmptyArm.ad, pooledEmptyArm.error);
console.log(pooledStaleArm.ad, pooledStaleArm.error);
console.log(pooledConsumedArm.ad, pooledConsumedArm.error);

if (pooledState.status === 'filled') {
  console.log(pooledState.ad.adId, pooledState.error);
}
if (pooledState.status === 'error' || pooledState.status === 'no-fill') {
  console.log(pooledState.error.reason, pooledState.error.phase, pooledState.ad);
}
if (pooledState.status === 'idle' || pooledState.status === 'empty' || pooledState.status === 'timeout') {
  console.log(pooledState.ad, pooledState.error);
}
if (pooledState.status === 'consumed') {
  console.log(pooledState.ad, pooledState.error);
}

// 'stale-by-policy' and 'consumed' are part of the usePooledAd status union and
// are not error states
const stalePooledStatus: UsePooledAdResult['status'] = 'stale-by-policy';
const consumedPooledStatus: UsePooledAdResult['status'] = 'consumed';
console.log(stalePooledStatus, consumedPooledStatus);

// Impossible arms must not type-check (assignability via Extract)
type PooledFilledAdIsPooledAd = PooledFilled['ad'] extends PooledAd
  ? PooledAd extends PooledFilled['ad']
    ? true
    : false
  : false;
type PooledErrorIsAdError = PooledError['error'] extends AdError
  ? AdError extends PooledError['error']
    ? true
    : false
  : false;
const pooledFilledAdOk: PooledFilledAdIsPooledAd = true;
const pooledErrorOk: PooledErrorIsAdError = true;
console.log(pooledFilledAdOk, pooledErrorOk);

// useMultiFormatAd: ownership, no-fill vs error, stale-by-policy, release
const multiFormatState = useMultiFormatAd({
  adUnitId: TestIds.GAM_NATIVE,
  requestOptions: multiFormatOptions,
  autoLoad: true,
});
console.log(multiFormatState.status, multiFormatState.ads.length);
const releasedHandles: MultiFormatAdHandle[] = multiFormatState.release();
console.log(releasedHandles.length);
multiFormatState.load().then(result => console.log(result.status));

type UseMultiFormatAdResult = ReturnType<typeof useMultiFormatAd>;
type MultiFormatLoaded = Extract<UseMultiFormatAdResult, { status: 'loaded' }>;
type MultiFormatPartial = Extract<UseMultiFormatAdResult, { status: 'loaded-partial' }>;
type MultiFormatHookNoFill = Extract<UseMultiFormatAdResult, { status: 'no-fill' }>;
type MultiFormatHookError = Extract<UseMultiFormatAdResult, { status: 'error' }>;
type MultiFormatHookStale = Extract<UseMultiFormatAdResult, { status: 'stale-by-policy' }>;
declare const multiFormatLoaded: MultiFormatLoaded;
declare const multiFormatPartial: MultiFormatPartial;
declare const multiFormatHookNoFill: MultiFormatHookNoFill;
declare const multiFormatHookError: MultiFormatHookError;
declare const multiFormatHookStale: MultiFormatHookStale;
console.log(multiFormatLoaded.ads.length, multiFormatLoaded.errors.length);
console.log(multiFormatPartial.ads.length, multiFormatPartial.errors.map(e => e.reason));
console.log(multiFormatHookNoFill.ads.length, multiFormatHookNoFill.errors.length);
console.log(multiFormatHookError.errors.map(e => e.phase), multiFormatHookError.ads.length);
console.log(multiFormatHookStale.ads.length, multiFormatHookStale.errors.map(e => e.reason));

if (multiFormatState.status === 'loaded') {
  console.log(multiFormatState.ads[0]?.format, multiFormatState.errors.length);
}
if (multiFormatState.status === 'loaded-partial') {
  console.log(multiFormatState.ads[0]?.format, multiFormatState.errors.map(e => e.reason));
}
if (multiFormatState.status === 'error') {
  console.log(multiFormatState.errors.map(e => `${e.reason}/${e.phase}: ${e.message}`));
}
if (multiFormatState.status === 'no-fill' || multiFormatState.status === 'idle') {
  console.log(multiFormatState.ads.length, multiFormatState.errors.length);
}

const multiFormatNoFillStatus: UseMultiFormatAdResult['status'] = 'no-fill';
const multiFormatStaleStatus: UseMultiFormatAdResult['status'] = 'stale-by-policy';
const multiFormatLoadingStatus: UseMultiFormatAdResult['status'] = 'loading';
const pooledPollingStatus: UsePooledAdResult['status'] = 'polling';
const pooledFilledStatus: UsePooledAdResult['status'] = 'filled';
console.log(
  multiFormatNoFillStatus,
  multiFormatStaleStatus,
  multiFormatLoadingStatus,
  pooledPollingStatus,
  pooledFilledStatus,
);

// Use*AdStatus is derived from Use*AdResult['status'] — equality must hold.
// Poll-only words must not appear on multi-format; load-only words must not appear on pooled.
// (Avoid leading-underscore type alias names: noUnusedLocals + TS2552 interact badly.)
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
type AssertNever<T extends never> = T;

const pooledStatusEqualsResult: Equal<UsePooledAdStatus, UsePooledAdResult['status']> = true;
const pooledStatusEqualsExport: Equal<UsePooledAdStatus, ExportedUsePooledAdResult['status']> =
  true;
const multiStatusEqualsResult: Equal<UseMultiFormatAdStatus, UseMultiFormatAdResult['status']> =
  true;
const multiStatusEqualsExport: Equal<
  UseMultiFormatAdStatus,
  ExportedUseMultiFormatAdResult['status']
> = true;
// Hook result / status / provider props come from the public barrel.
const useAdPoolResultEqualsReturn: Equal<UseAdPoolResult, ReturnType<typeof useAdPool>> = true;
// UseAdPoolStatus derived + exported; poolStatus shares it; count required.
const useAdPoolStatusEqualsResult: Equal<UseAdPoolStatus, UseAdPoolResult['status']> = true;
type PooledPoolStatusEquals = Equal<UsePooledAdResult['poolStatus'], UseAdPoolStatus>;
type ObservedCountIsNumber = UsePooledAdResult['observedCount'] extends number
  ? number extends UsePooledAdResult['observedCount']
    ? true
    : false
  : false;
type AdPoolAvailabilityCountRequired = Equal<
  AdPoolAvailability,
  { available: boolean; observedCount: number }
>;
const poolAvailabilityLocks: [
  PooledPoolStatusEquals,
  ObservedCountIsNumber,
  AdPoolAvailabilityCountRequired,
] = [true, true, true];
declare const adPoolProviderProps: AdPoolProviderProps;
console.log(
  pooledStatusEqualsResult,
  pooledStatusEqualsExport,
  multiStatusEqualsResult,
  multiStatusEqualsExport,
  useAdPoolResultEqualsReturn,
  useAdPoolStatusEqualsResult,
  poolAvailabilityLocks,
  adPoolProviderProps.pools.length,
);

type PollOnlyStatus = 'polling' | 'filled' | 'empty' | 'timeout';
type LoadOnlyStatus = 'loading' | 'loaded' | 'loaded-partial';
type HookOnlyPooledStatus = 'consumed';
type PollWordsNotInMulti = AssertNever<Extract<UseMultiFormatAdStatus, PollOnlyStatus>>;
type LoadWordsNotInPooled = AssertNever<Extract<UsePooledAdStatus, LoadOnlyStatus>>;
type ConsumedNotInMulti = AssertNever<Extract<UseMultiFormatAdStatus, HookOnlyPooledStatus>>;
type SharedIdleOnBoth = Extract<UsePooledAdStatus & UseMultiFormatAdStatus, 'idle'>;
const sharedIdleOk: SharedIdleOnBoth = 'idle';
const ax1VocabLocks: [PollWordsNotInMulti, LoadWordsNotInPooled, ConsumedNotInMulti] = [
  undefined as never,
  undefined as never,
  undefined as never,
];
console.log(sharedIdleOk, ax1VocabLocks);

// Preset poolId equals the DisplayPoolId / FullscreenPoolId templates.
const displayPoolIdEqualsTemplate: Equal<
  typeof displayPoolConfig.poolId,
  DisplayPoolId<typeof TestIds.GAM_NATIVE>
> = true;
const fullscreenPoolIdEqualsTemplate: Equal<
  typeof fullscreenPoolConfig.poolId,
  FullscreenPoolId<AdFormat.INTERSTITIAL, typeof TestIds.INTERSTITIAL>
> = true;
console.log(displayPoolIdEqualsTemplate, fullscreenPoolIdEqualsTemplate);

// Consumed arm clears inventory when await show() fulfills (not
// OPENED/CLOSED/EARNED_REWARD); ad-already-used stays a show-phase reason;
// release() leaves status idle among current arms.
type ConsumedAdIsNull = PooledConsumed['ad'] extends null ? true : false;
type ConsumedErrorIsNull = PooledConsumed['error'] extends null ? true : false;
const consumedArmOk: [ConsumedAdIsNull, ConsumedErrorIsNull] = [true, true];
const alreadyUsedReason: KnownAdErrorReason = 'ad-already-used';
console.log(consumedArmOk, alreadyUsedReason);

// The load result narrows on status, and 'no-fill' is distinct from 'error'
declare const multiFormatLoadResult: MultiFormatLoadResult;
switch (multiFormatLoadResult.status) {
  case 'loaded':
    console.log(multiFormatLoadResult.ads[0]?.format, multiFormatLoadResult.errors.length);
    break;
  case 'loaded-partial':
    console.log(multiFormatLoadResult.ads[0]?.format);
    console.log(multiFormatLoadResult.errors.map(e => e.reason));
    break;
  case 'no-fill':
    // A clean no-fill carries no errors, so it cannot be confused with 'error'
    console.log(multiFormatLoadResult.ads.length, multiFormatLoadResult.errors.length);
    break;
  case 'error':
    console.log(multiFormatLoadResult.errors.map(e => e.phase));
    break;
}
// 'no-fill' and 'error' are separate arms: the no-fill arm cannot carry errors
type MultiFormatNoFillResult = Extract<MultiFormatLoadResult, { status: 'no-fill' }>;
type MultiFormatErrorResult = Extract<MultiFormatLoadResult, { status: 'error' }>;
const multiFormatNoFill: MultiFormatNoFillResult = {
  status: 'no-fill',
  ads: [],
  errors: [],
  // Present on every arm: a response record is not a failure, so it is not
  // smuggled into `errors`, and a clean no-fill still has a responseId.
  responseInfo: null,
};
declare const multiFormatError: MultiFormatErrorResult;
console.log(
  multiFormatNoFill.errors.length,
  multiFormatError.errors.map(e => e.reason),
);

// Multi-format handles carry the same identity + policy surface pooled ads do
declare const multiFormatHandle: MultiFormatAdHandle;
console.log(
  multiFormatHandle.adId,
  multiFormatHandle.observedAt,
  multiFormatHandle.provenance,
  multiFormatHandle.stalenessWindowMillis,
  multiFormatHandle.stalenessWindowSource,
);
console.log(multiFormatHandle.isStaleByPolicy());
multiFormatHandle.onStaleByPolicy(() => undefined)();
const handleExpiry: AdExpiry = multiFormatHandle;
const handleIdentity: AdIdentity = multiFormatHandle;
const pooledExpiry: AdExpiry = pooledAd;
const pooledIdentity: AdIdentity = pooledAd;
console.log(
  handleExpiry.stalenessWindowMillis,
  handleIdentity.adId,
  handleIdentity.observedAt,
  pooledExpiry.stalenessWindowSource,
  pooledIdentity.adId,
);

// Capability: maxManagedPoolAds is null; per-format preload + peek gates exist
const caps: AdCapabilities = getAdCapabilities();
console.log(caps.maxManagedPoolAds, caps.fullscreenPreloadFormats[AdFormat.REWARDED_INTERSTITIAL]);
console.log(caps.poolResponseInfoPeek);
const peekUnsupportedReason: KnownAdErrorReason = 'pool/peek-unsupported';
const formatPreloadUnsupportedReason: KnownAdErrorReason = 'pool/format-preload-unsupported';
console.log(peekUnsupportedReason, formatPreloadUnsupportedReason);
// Peek gate is a real AdCapabilities key, not a JSDoc claim.
type AdCapabilitiesHasPeekGate = Equal<
  AdCapabilities['poolResponseInfoPeek'],
  CapabilitySupport
>;
const adCapabilitiesPeekGate: AdCapabilitiesHasPeekGate = true;
console.log(adCapabilitiesPeekGate);

// A polled banner ad is structurally a MultiFormatBannerAdView handle
declare const pooledBannerAd: Extract<PooledAd, { format: AdFormat.BANNER }>;
const pooledBannerViewProps: MultiFormatBannerAdViewProps = { handle: pooledBannerAd };
const bannerHandleFromPool: MultiFormatBannerAdHandle = pooledBannerAd;
console.log(pooledBannerViewProps.handle.size, bannerHandleFromPool.adId);

// AdError is one type: a real Error that also carries the structured payload
declare const adError: AdError;
const adErrorAsError: Error = adError;
console.log(adError.reason, adError.phase, adError.message, adError.code);
console.log(adError.responseInfo?.responseId, adError.namespace, adError.jsStack);
console.log(adErrorAsError.name, adErrorAsError.stack);

const errorPayload: AdErrorPayload = {
  code: 'googleMobileAds/error-code-no-fill',
  message: 'no fill',
  reason: 'no-fill',
  phase: 'load',
};
const paid: PaidEvent = {
  currency: 'USD',
  precision: 3,
  value: 0.01,
  valueMicros: '10000',
};
// AdEventPayload maps PAID → PaidEvent (not undefined)
const paidPayload: AdEventPayload<AdEventType.PAID> = paid;
const paidPayloadIsPaid: PaidEvent = paidPayload;
console.log(paidPayloadIsPaid.valueMicros);
const responseInfo: ResponseInfo = {
  responseId: null,
  adapterClassName: null,
  loadedAdapterResponse: null,
  adapterResponses: [],
  extras: {},
};
console.log(errorPayload.reason, paid.valueMicros, responseInfo.extras);

// AdapterResponseInfo: `outcome` narrows adError, shared fields always present
declare const adapterRow: AdapterResponseInfo;
console.log(adapterRow.adapterClassName, adapterRow.latencyMillis);
if (adapterRow.outcome === 'error') {
  console.log(adapterRow.adError.domain, adapterRow.adError.code);
} else {
  const noError: null = adapterRow.adError;
  console.log(noError);
}

// The loaded row cannot carry an error
const loadedRow: LoadedAdapterResponseInfo = {
  adapterClassName: 'com.google.ads.mediation.admob.AdMobAdapter',
  adSourceName: null,
  adSourceId: null,
  adSourceInstanceName: null,
  adSourceInstanceId: null,
  latencyMillis: 42,
  outcome: 'success',
  adError: null,
};
console.log(loadedRow.adError, loadedRow.latencyMillis);

// =============================================================================
// Lock contract claims that regress silently
// (empty PAID handlers, ReturnType-only status probes, missing JSX coverage)
// =============================================================================

// PAID payload is exactly PaidEvent. Assignability alone is not enough: an empty
// listener stays assignable if the payload regresses to `undefined`.
type PaidPayloadIsPaidEvent = Equal<AdEventPayload<AdEventType.PAID>, PaidEvent>;
const paidPayloadExact: PaidPayloadIsPaidEvent = true;
const paidListener: AdEventListener<AdEventType.PAID> = (payload: PaidEvent) => {
  console.log(payload.currency, payload.valueMicros);
};
console.log(paidPayloadExact, paidListener);

// ERROR payload keeps structured AdErrorPayload fields on a real Error.
type ErrorPayloadIsStructured = Equal<AdEventPayload<AdEventType.ERROR>, Error & AdErrorPayload>;
const errorPayloadExact: ErrorPayloadIsStructured = true;
declare const errorFromEvent: AdEventPayload<AdEventType.ERROR>;
const errorReason: AdErrorPayload['reason'] = errorFromEvent.reason;
const errorPhase: AdErrorPayload['phase'] = errorFromEvent.phase;
console.log(errorPayloadExact, errorReason, errorPhase, errorFromEvent.message);

// Banner onAdFailedToLoad exposes the same structured fields (partial).
type BannerFailedLoadError = Parameters<
  NonNullable<import('./src').BannerAdProps['onAdFailedToLoad']>
>[0];
type BannerFailedLoadHasReason = BannerFailedLoadError extends {
  reason?: AdErrorPayload['reason'];
}
  ? true
  : false;
type BannerFailedLoadHasPhase = BannerFailedLoadError extends {
  phase?: AdErrorPayload['phase'];
}
  ? true
  : false;
const bannerFailedLoadLocks: [BannerFailedLoadHasReason, BannerFailedLoadHasPhase] = [true, true];
console.log(bannerFailedLoadLocks);

// Expiry policy + identity members stay present on the shared surfaces.
type AdExpiryKeys = Equal<
  keyof AdExpiry,
  'stalenessWindowMillis' | 'stalenessWindowSource' | 'isStaleByPolicy' | 'onStaleByPolicy'
>;
type AdIdentityKeys = Equal<keyof AdIdentity, 'adId' | 'observedAt'>;
const expiryIdentityLocks: [AdExpiryKeys, AdIdentityKeys] = [true, true];
// Exact millis are asserted at runtime in __tests__/typeContractLocks.test.tsx —
// barrel re-exports widen the `as const` literals to number for typeof probes.
type GuidanceKeys = Equal<keyof typeof AdStalenessGuidanceMillis, 'APP_OPEN' | 'OTHER'>;
const guidanceKeysLock: GuidanceKeys = true;
const guidanceAppOpenMs: number = AdStalenessGuidanceMillis.APP_OPEN;
const guidanceOtherMs: number = AdStalenessGuidanceMillis.OTHER;
console.log(expiryIdentityLocks, guidanceKeysLock, guidanceAppOpenMs, guidanceOtherMs);

// nativeOrBanner keeps the documented requestCount / adServer literals.
type NativeOrBannerOptions = ReturnType<typeof MultiFormatAdPresets.nativeOrBanner>;
type NativeOrBannerRequestCount = Equal<NonNullable<NativeOrBannerOptions['requestCount']>, 1>;
type NativeOrBannerAdServer = Equal<NonNullable<NativeOrBannerOptions['adServer']>, 'ad-manager'>;
const nativeOrBannerLocks: [NativeOrBannerRequestCount, NativeOrBannerAdServer] = [true, true];
const nativeOrBannerRuntime = MultiFormatAdPresets.nativeOrBanner([]);
console.log(
  nativeOrBannerLocks,
  nativeOrBannerRuntime.requestCount,
  nativeOrBannerRuntime.adServer,
  nativeOrBannerRuntime.formats,
);

// AdPool instance surface: availability count + the imperative methods docs rely on.
type AdPoolKeys = Equal<
  keyof AdPool,
  | 'poolId'
  | 'formats'
  | 'resolved'
  | 'getAvailability'
  | 'peekResponseInfo'
  | 'poll'
  | 'addListener'
  | 'destroy'
>;
const adPoolKeyLock: AdPoolKeys = true;
declare const adPoolInstance: AdPool;
adPoolInstance.getAvailability().then(availability => {
  const count: number = availability.observedCount;
  const ready: boolean = availability.available;
  console.log(adPoolKeyLock, count, ready);
});
adPoolInstance.peekResponseInfo().then(
  info => {
    // Supported path only: null means empty head, not unsupported.
    const emptyOrInfo: ResponseInfo | null = info;
    console.log(emptyOrInfo);
  },
  (err: AdError) => {
    // Unsupported backends reject with 'pool/peek-unsupported' (not null).
    console.log(err.reason === peekUnsupportedReason);
  },
);
adPoolInstance.poll().then(result => console.log(result.status));
adPoolInstance.addListener(event => console.log(event.type))();
adPoolInstance.destroy();

// Named status aliases stay the public source of truth (not ReturnType-only probes).
type PooledStatusAlias = Equal<UsePooledAdStatus, UsePooledAdResult['status']>;
type MultiStatusAlias = Equal<UseMultiFormatAdStatus, UseMultiFormatAdResult['status']>;
type AdPoolStatusAlias = Equal<UseAdPoolStatus, UseAdPoolResult['status']>;
const namedStatusAliasLocks: [PooledStatusAlias, MultiStatusAlias, AdPoolStatusAlias] = [
  true,
  true,
  true,
];
const consumedStatusLiteral: UsePooledAdStatus = 'consumed';
console.log(namedStatusAliasLocks, consumedStatusLiteral);

// ---------------------------------------------------------------------------
// Fullscreen ad hooks: both call forms resolve to different result shapes.
// ---------------------------------------------------------------------------

// Form 1, positional. Unchanged from v16, including the optional second
// argument and the documented `null` destroy value.
const legacyInterstitial = useInterstitialAd(TestIds.INTERSTITIAL);
const legacyInterstitialWithOptions = useInterstitialAd(TestIds.INTERSTITIAL, {
  keywords: ['games'],
});
const legacyInterstitialDestroyed = useInterstitialAd(null);
console.log(
  legacyInterstitial.isLoaded,
  legacyInterstitial.isShowing,
  legacyInterstitialWithOptions.isClosed,
  legacyInterstitialDestroyed.responseInfo,
);
legacyInterstitial.load();
legacyInterstitial.show();
legacyInterstitial.destroy();

// Form 2, options object. Discriminated by shape, so `null` cannot reach it.
const modernInterstitial = useInterstitialAd({
  adUnitId: TestIds.INTERSTITIAL,
  requestOptions: { keywords: ['games'] },
  autoLoad: true,
});
const modernInterstitialStatus: UseFullScreenAdStatus = modernInterstitial.status;
const modernInterstitialError: AdError | null = modernInterstitial.error;
const modernInterstitialResponse: ResponseInfo | null = modernInterstitial.responseInfo;
const modernInterstitialRevenue: PaidEvent | null = modernInterstitial.revenue;
console.log(
  modernInterstitialStatus,
  modernInterstitialError,
  modernInterstitialResponse,
  modernInterstitialRevenue,
  modernInterstitial.autoLoad,
  modernInterstitial.clicked,
  modernInterstitial.impression,
);
modernInterstitial.load();
modernInterstitial.retry();
modernInterstitial.show({ immersiveModeEnabled: true });
modernInterstitial.destroy();
if (modernInterstitial.status === 'error' || modernInterstitial.status === 'no-fill') {
  const narrowedError: AdError = modernInterstitial.error;
  console.log(narrowedError.reason, narrowedError.responseInfo?.responseId);
} else {
  const absentError: null = modernInterstitial.error;
  console.log(absentError);
}
// @ts-expect-error enabled was renamed to autoLoad on the options form
useInterstitialAd({ adUnitId: TestIds.INTERSTITIAL, enabled: false });
// @ts-expect-error enabled is not part of the options-form result
console.log(modernInterstitial.enabled);

// A deferred ad unit is legal in the options form and keeps the hook idle.
const deferredAppOpen = useAppOpenAd({ adUnitId: null, autoLoad: false });
console.log(deferredAppOpen.status, deferredAppOpen.autoLoad);

// The status union is exactly the derived lifecycle words, no more.
type FullScreenStatusLock = Equal<
  UseFullScreenAdStatus,
  'idle' | 'loading' | 'loaded' | 'showing' | 'closed' | 'no-fill' | 'error'
>;
const fullScreenStatusLock: FullScreenStatusLock = true;

// `closed` is this hook's word; `consumed` belongs to usePooledAd and must not
// leak across. The vocabularies mirror different surfaces on purpose.
type ClosedIsFullScreenStatus = 'closed' extends UseFullScreenAdStatus ? true : false;
type ConsumedIsNotFullScreenStatus = 'consumed' extends UseFullScreenAdStatus ? false : true;
const vocabularyLocks: [ClosedIsFullScreenStatus, ConsumedIsNotFullScreenStatus] = [true, true];

// Reward facts exist only on the rewarded hooks.
const modernRewarded = useRewardedAd({ adUnitId: TestIds.REWARDED });
const modernRewardedItem: RewardedAdReward | null = modernRewarded.reward;
const modernRewardedEarned: boolean = modernRewarded.earnedReward;
const modernRewardedInterstitial = useRewardedInterstitialAd({
  adUnitId: TestIds.REWARDED_INTERSTITIAL,
});
console.log(modernRewardedItem, modernRewardedEarned, modernRewardedInterstitial.reward);

type InterstitialOmitsReward = 'reward' extends keyof UseInterstitialAdResult ? false : true;
type AppOpenOmitsReward = 'earnedReward' extends keyof UseAppOpenAdResult ? false : true;
type RewardedKeepsReward = 'reward' extends keyof UseRewardedAdResult ? true : false;
const rewardShapeLocks: [InterstitialOmitsReward, AppOpenOmitsReward, RewardedKeepsReward] = [
  true,
  true,
  true,
];
console.log(fullScreenStatusLock, vocabularyLocks, rewardShapeLocks);

// Options types are shared across the four hooks, so `autoLoad` means one thing.
type OptionsAreShared = Equal<UseInterstitialAdOptions, UseRewardedAdOptions>;
const optionsSharedLock: OptionsAreShared = true;

// useMultiFormatAd takes exactly one object, and it is the imperative config
// plus `autoLoad`, so both paths accept the same request description.
const multiFormatConfig: MultiFormatAdConfig = {
  adUnitId: TestIds.GAM_NATIVE,
  requestOptions: multiFormatOptions,
};
const multiFormatFromConfig = useMultiFormatAd({ ...multiFormatConfig, autoLoad: false });
const multiFormatImperative = MultiFormatAdRequest.create(multiFormatConfig);
console.log(multiFormatFromConfig.autoLoad, multiFormatImperative.adUnitId);
multiFormatFromConfig.retry();
// @ts-expect-error MultiFormatAdConfig is shared with the imperative path and requires a string id
useMultiFormatAd({ ...multiFormatConfig, adUnitId: null });
// @ts-expect-error enabled was renamed to autoLoad on the hook-only extension
useMultiFormatAd({ ...multiFormatConfig, enabled: false });

type MultiFormatOptionsExtendConfig = MultiFormatAdConfig extends Omit<
  UseMultiFormatAdOptions,
  'autoLoad'
>
  ? true
  : false;
const multiFormatOptionsLock: MultiFormatOptionsExtendConfig = true;

// Every load-result arm carries the response record, including a clean no-fill.
type NoFillCarriesResponseInfo = Equal<
  MultiFormatNoFillResult['responseInfo'],
  ResponseInfo | null
>;
const noFillResponseInfoLock: NoFillCarriesResponseInfo = true;
console.log(optionsSharedLock, multiFormatOptionsLock, noFillResponseInfoLock);
