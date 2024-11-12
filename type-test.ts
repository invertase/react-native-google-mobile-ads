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
console.log(AdEventType.LOADED);
console.log(AdEventType.OPENED);
console.log(AdEventType.PAID);

// BannerAdSize
console.log(BannerAdSize.ANCHORED_ADAPTIVE_BANNER);
console.log(BannerAdSize.BANNER);
console.log(BannerAdSize.FULL_BANNER);
console.log(BannerAdSize.INLINE_ADAPTIVE_BANNER);
console.log(BannerAdSize.LARGE_BANNER);
console.log(BannerAdSize.LEADERBOARD);
console.log(BannerAdSize.MEDIUM_RECTANGLE);
console.log(BannerAdSize.WIDE_SKYSCRAPER);
console.log(BannerAdSize.ADAPTIVE_BANNER);

// GAMBannerAdSize
console.log(GAMBannerAdSize.ANCHORED_ADAPTIVE_BANNER);
console.log(GAMBannerAdSize.BANNER);
console.log(GAMBannerAdSize.FLUID);
console.log(GAMBannerAdSize.FULL_BANNER);
console.log(GAMBannerAdSize.INLINE_ADAPTIVE_BANNER);
console.log(GAMBannerAdSize.LARGE_BANNER);
console.log(GAMBannerAdSize.LEADERBOARD);
console.log(GAMBannerAdSize.MEDIUM_RECTANGLE);
console.log(GAMBannerAdSize.WIDE_SKYSCRAPER);
console.log(GAMBannerAdSize.ADAPTIVE_BANNER);

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

appOpenAd.addAdEventListener(AdEventType.PAID, () => {});
appOpenAd.addAdEventsListener(({ type, payload }) => {
  if (payload) {
    console.log(type);
    console.log(payload instanceof Error && payload.message);
    console.log('amount' in payload && payload.amount);
    console.log('data' in payload && payload.data);
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

interstitial.addAdEventListener(AdEventType.PAID, () => {});
interstitial.addAdEventsListener(({ type, payload }) => {
  if (payload) {
    console.log(type);
    console.log(payload instanceof Error && payload.message);
    console.log('amount' in payload && payload.amount);
    console.log('data' in payload && payload.data);
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

rewardedAd.addAdEventListener(AdEventType.PAID, () => {});
rewardedAd.addAdEventsListener(({ type, payload }) => {
  if (payload) {
    console.log(type);
    console.log(payload instanceof Error && payload.message);
    console.log('amount' in payload && payload.amount);
    console.log('data' in payload && payload.data);
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

rewardedInterstitialAd.addAdEventListener(AdEventType.PAID, () => {});
rewardedInterstitialAd.addAdEventsListener(({ type, payload }) => {
  if (payload) {
    console.log(type);
    console.log(payload instanceof Error && payload.message);
    console.log('amount' in payload && payload.amount);
    console.log('data' in payload && payload.data);
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

gmaInterstitialAd.addAdEventListener(AdEventType.PAID, () => {});
gmaInterstitialAd.addAdEventsListener(({ type, payload }) => {
  if (payload) {
    console.log(type);
    console.log(payload instanceof Error && payload.message);
    console.log('amount' in payload && payload.amount);
    console.log('data' in payload && payload.data);
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
