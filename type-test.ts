/* eslint-disable no-console */
import * as googleMobileAds from 'react-native-google-mobile-ads';

console.log(googleMobileAds.AdsConsentDebugGeography.DISABLED);
console.log(googleMobileAds.AdsConsentDebugGeography.EEA);
console.log(googleMobileAds.AdsConsentDebugGeography.NOT_EEA);
console.log(googleMobileAds.AdsConsentDebugGeography.DISABLED);
console.log(googleMobileAds.AdsConsentDebugGeography.EEA);
console.log(googleMobileAds.AdsConsentDebugGeography.NOT_EEA);

console.log(googleMobileAds.AdsConsentStatus.UNKNOWN);
console.log(googleMobileAds.AdsConsentStatus.REQUIRED);
console.log(googleMobileAds.AdsConsentStatus.NOT_REQUIRED);
console.log(googleMobileAds.AdsConsentStatus.OBTAINED);
console.log(googleMobileAds.AdsConsentStatus.UNKNOWN);
console.log(googleMobileAds.AdsConsentStatus.REQUIRED);
console.log(googleMobileAds.AdsConsentStatus.NOT_REQUIRED);
console.log(googleMobileAds.AdsConsentStatus.OBTAINED);

console.log(googleMobileAds.MaxAdContentRating.G);
console.log(googleMobileAds.MaxAdContentRating.MA);
console.log(googleMobileAds.MaxAdContentRating.PG);
console.log(googleMobileAds.MaxAdContentRating.T);
console.log(googleMobileAds.MaxAdContentRating.G);
console.log(googleMobileAds.MaxAdContentRating.MA);
console.log(googleMobileAds.MaxAdContentRating.PG);
console.log(googleMobileAds.MaxAdContentRating.T);

console.log(googleMobileAds.AdEventType.CLICKED);
console.log(googleMobileAds.AdEventType.CLOSED);
console.log(googleMobileAds.AdEventType.ERROR);
console.log(googleMobileAds.AdEventType.LOADED);
console.log(googleMobileAds.AdEventType.OPENED);
console.log(googleMobileAds.AdEventType.CLICKED);
console.log(googleMobileAds.AdEventType.CLOSED);
console.log(googleMobileAds.AdEventType.ERROR);
console.log(googleMobileAds.AdEventType.LOADED);
console.log(googleMobileAds.AdEventType.OPENED);

console.log(googleMobileAds.RewardedAdEventType.LOADED);
console.log(googleMobileAds.RewardedAdEventType.EARNED_REWARD);
console.log(googleMobileAds.RewardedAdEventType.LOADED);
console.log(googleMobileAds.RewardedAdEventType.EARNED_REWARD);

console.log(googleMobileAds.BannerAdSize.BANNER);
console.log(googleMobileAds.BannerAdSize.FLUID);
console.log(googleMobileAds.BannerAdSize.FULL_BANNER);
console.log(googleMobileAds.BannerAd);
console.log(googleMobileAds.BannerAdSize.BANNER);
console.log(googleMobileAds.BannerAdSize.FLUID);
console.log(googleMobileAds.BannerAdSize.FULL_BANNER);

console.log(googleMobileAds.TestIds.BANNER);
console.log(googleMobileAds.TestIds.INTERSTITIAL);
console.log(googleMobileAds.TestIds.REWARDED);
console.log(googleMobileAds.TestIds.BANNER);
console.log(googleMobileAds.TestIds.INTERSTITIAL);
console.log(googleMobileAds.TestIds.REWARDED);

// InterstitialAd
const interstitial = googleMobileAds.InterstitialAd.createForAdRequest('foo', {
  keywords: ['test'],
});

console.log(interstitial.adUnitId);

interstitial.load();
interstitial.show().then();
interstitial.addAdEventsListener(({ type, payload }) => {
  console.log(type);
  console.log(payload instanceof Error && payload.message);
  console.log('amount' in payload && payload.amount);
  console.log('data' in payload && payload.type);
});

googleMobileAds.AdsConsent.requestInfoUpdate().then(info =>
  console.log(info.isConsentFormAvailable),
);
googleMobileAds.AdsConsent.showForm().then(info => console.log(info.status));
googleMobileAds.AdsConsent.reset();

// RewardedAd
const rewardedAd = googleMobileAds.RewardedAd.createForAdRequest('foo', {
  keywords: ['test'],
});

console.log(rewardedAd.adUnitId);

rewardedAd.load();
rewardedAd.show().then();
rewardedAd.addAdEventsListener(({ type, payload }) => {
  console.log(type);
  console.log(payload instanceof Error && payload.message);
  console.log('amount' in payload && payload.amount);
  console.log('data' in payload && payload.type);
});

// checks module exists at root
console.log(googleMobileAds().app.name);

// checks statics exist
console.log(googleMobileAds.SDK_VERSION);

// checks statics exist on defaultExport
console.log(googleMobileAds.default.SDK_VERSION);

// checks firebase named export exists on module
console.log(googleMobileAds.firebase.SDK_VERSION);

// test banner sizes
console.log(googleMobileAds.BannerAdSize.BANNER);
console.log(googleMobileAds.BannerAdSize.FULL_BANNER);
console.log(googleMobileAds.BannerAdSize.LARGE_BANNER);
console.log(googleMobileAds.BannerAdSize.LEADERBOARD);
console.log(googleMobileAds.BannerAdSize.MEDIUM_RECTANGLE);
