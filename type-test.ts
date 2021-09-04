/* eslint-disable no-console */
import * as googleAds from '@invertase/react-native-google-ads';

console.log(googleAds.AdsConsentDebugGeography.DISABLED);
console.log(googleAds.AdsConsentDebugGeography.EEA);
console.log(googleAds.AdsConsentDebugGeography.NOT_EEA);
console.log(googleAds.AdsConsentDebugGeography.DISABLED);
console.log(googleAds.AdsConsentDebugGeography.EEA);
console.log(googleAds.AdsConsentDebugGeography.NOT_EEA);

console.log(googleAds.AdsConsentStatus.NON_PERSONALIZED);
console.log(googleAds.AdsConsentStatus.PERSONALIZED);
console.log(googleAds.AdsConsentStatus.UNKNOWN);
console.log(googleAds.AdsConsentStatus.NON_PERSONALIZED);
console.log(googleAds.AdsConsentStatus.PERSONALIZED);
console.log(googleAds.AdsConsentStatus.UNKNOWN);

console.log(googleAds.MaxAdContentRating.G);
console.log(googleAds.MaxAdContentRating.MA);
console.log(googleAds.MaxAdContentRating.PG);
console.log(googleAds.MaxAdContentRating.T);
console.log(googleAds.MaxAdContentRating.G);
console.log(googleAds.MaxAdContentRating.MA);
console.log(googleAds.MaxAdContentRating.PG);
console.log(googleAds.MaxAdContentRating.T);

console.log(googleAds.AdEventType.CLICKED);
console.log(googleAds.AdEventType.CLOSED);
console.log(googleAds.AdEventType.ERROR);
console.log(googleAds.AdEventType.LEFT_APPLICATION);
console.log(googleAds.AdEventType.LOADED);
console.log(googleAds.AdEventType.OPENED);
console.log(googleAds.AdEventType.CLICKED);
console.log(googleAds.AdEventType.CLOSED);
console.log(googleAds.AdEventType.ERROR);
console.log(googleAds.AdEventType.LEFT_APPLICATION);
console.log(googleAds.AdEventType.LOADED);
console.log(googleAds.AdEventType.OPENED);

console.log(googleAds.RewardedAdEventType.LOADED);
console.log(googleAds.RewardedAdEventType.EARNED_REWARD);
console.log(googleAds.RewardedAdEventType.LOADED);
console.log(googleAds.RewardedAdEventType.EARNED_REWARD);

console.log(googleAds.BannerAdSize.BANNER);
console.log(googleAds.BannerAdSize.FLUID);
console.log(googleAds.BannerAdSize.FULL_BANNER);
console.log(googleAds.BannerAd);
console.log(googleAds.BannerAdSize.BANNER);
console.log(googleAds.BannerAdSize.FLUID);
console.log(googleAds.BannerAdSize.FULL_BANNER);

console.log(googleAds.TestIds.BANNER);
console.log(googleAds.TestIds.INTERSTITIAL);
console.log(googleAds.TestIds.REWARDED);
console.log(googleAds.TestIds.BANNER);
console.log(googleAds.TestIds.INTERSTITIAL);
console.log(googleAds.TestIds.REWARDED);

// InterstitialAd
const interstitial = googleAds.InterstitialAd.createForAdRequest('foo', {
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

googleAds.AdsConsent.addTestDevices(['1234']).then();
googleAds.AdsConsent.getAdProviders().then(providers => {
  providers[0].companyId;
  providers[0].companyName;
  providers[0].privacyPolicyUrl;
});
googleAds.AdsConsent.getStatus().then(status => console.log(status));
googleAds.AdsConsent.requestInfoUpdate(['123']).then(info =>
  console.log(info.isRequestLocationInEeaOrUnknown),
);
googleAds.AdsConsent.setTagForUnderAgeOfConsent(true).then();
googleAds.AdsConsent.showForm({
  privacyPolicy: '123',
  withAdFree: true,
  withPersonalizedAds: true,
  withNonPersonalizedAds: true,
}).then();

// RewardedAd
const rewardedAd = googleAds.RewardedAd.createForAdRequest('foo', {
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
console.log(googleAds.SDK_VERSION);

// checks statics exist on defaultExport
console.log(googleAds.default.SDK_VERSION);

// checks firebase named export exists on module
console.log(googleAds.firebase.SDK_VERSION);

// test banner sizes
console.log(googleAds.BannerAdSize.BANNER);
console.log(googleAds.BannerAdSize.FULL_BANNER);
console.log(googleAds.BannerAdSize.LARGE_BANNER);
console.log(googleAds.BannerAdSize.LEADERBOARD);
console.log(googleAds.BannerAdSize.MEDIUM_RECTANGLE);
console.log(googleAds.BannerAdSize.SMART_BANNER);
