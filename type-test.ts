/* eslint-disable no-console */
import * as googleMobileAds from 'react-native-google-mobile-ads';

console.log(googleMobileAds.AdsConsentDebugGeography.DISABLED);
console.log(googleMobileAds.AdsConsentDebugGeography.EEA);
console.log(googleMobileAds.AdsConsentDebugGeography.NOT_EEA);
console.log(googleMobileAds.AdsConsentDebugGeography.DISABLED);
console.log(googleMobileAds.AdsConsentDebugGeography.EEA);
console.log(googleMobileAds.AdsConsentDebugGeography.NOT_EEA);

console.log(googleMobileAds.AdsConsentStatus.NON_PERSONALIZED);
console.log(googleMobileAds.AdsConsentStatus.PERSONALIZED);
console.log(googleMobileAds.AdsConsentStatus.UNKNOWN);
console.log(googleMobileAds.AdsConsentStatus.NON_PERSONALIZED);
console.log(googleMobileAds.AdsConsentStatus.PERSONALIZED);
console.log(googleMobileAds.AdsConsentStatus.UNKNOWN);

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
interstitial.onAdEvent((type, error, data) => {
  console.log(type);
  console.log(error && error.message);
  console.log(data && data.amount);
  console.log(data && data.type);
});

googleMobileAds.AdsConsent.addTestDevices(['1234']).then();
googleMobileAds.AdsConsent.getAdProviders().then(providers => {
  providers[0].companyId;
  providers[0].companyName;
  providers[0].privacyPolicyUrl;
});
googleMobileAds.AdsConsent.getStatus().then(status => console.log(status));
googleMobileAds.AdsConsent.requestInfoUpdate(['123']).then(info =>
  console.log(info.isRequestLocationInEeaOrUnknown),
);
googleMobileAds.AdsConsent.setTagForUnderAgeOfConsent(true).then();
googleMobileAds.AdsConsent.showForm({
  privacyPolicy: '123',
  withAdFree: true,
  withPersonalizedAds: true,
  withNonPersonalizedAds: true,
}).then();

// RewardedAd
const rewardedAd = googleMobileAds.RewardedAd.createForAdRequest('foo', {
  keywords: ['test'],
});

console.log(rewardedAd.adUnitId);

rewardedAd.load();
rewardedAd.show().then();
rewardedAd.onAdEvent((type, error, data) => {
  console.log(type);
  console.log(error && error.message);
  console.log(data && data.amount);
  console.log(data && data.type);
});

// checks module exists at root
console.log(googleAds().app.name);

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
